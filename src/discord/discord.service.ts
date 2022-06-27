import { REST } from '@discordjs/rest';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DiscordGuildChannelStat } from '@prisma/client';
import { throws } from 'assert';
import { Client, Collection, GuildMember, Intents, Message, NonThreadGuildBasedChannel, ThreadMember, ThreadMemberManager } from 'discord.js';
import { PrismaService } from 'src/prisma/prisma.service';
import { getXDaysAgoAtMidnight, getYesterday } from 'src/utils/date';
import * as Sentry from '@sentry/node';
import type { WorkSheet } from 'node-xlsx';
import * as moment from 'moment-timezone';

require('dotenv').config();

@Injectable()
export class DiscordService {
    private logger = new Logger(DiscordService.name);
    private rest: REST;
    private client: Client;

    constructor(private readonly prisma: PrismaService) {
        this.rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN);
        this.client = new Client({ intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            /** Privacy related permissions */
            Intents.FLAGS.GUILD_MEMBERS,
            Intents.FLAGS.GUILD_PRESENCES,
            // maybe avaliable after aug 31 2022
            // Intents.FLAGS.MESSAGE_CONTENT
        ] });
        this._setupListeners();
        this.client.on('ready', this._afterDiscordBotReady.bind(this));
    }

    private async _afterDiscordBotReady() {
        this.logger.debug('Discord bot is ready');
        /**
         * Here we import all guild data and it's members
         */
        const listeningGuildInfo = await this.findGuildInDatabase();
        const guild = this.client.guilds.cache.get(listeningGuildInfo.id);

        const allGuildMembers = guild.members.valueOf().toJSON();
        const allGuildMemberIds = allGuildMembers.map(m => m.id);
        const recordedGuildMembers = await this.prisma.discordGuildMember.findMany({
            where: {
                AND: {
                    id: {
                        in: allGuildMemberIds
                    },
                    discordGuildId: guild.id
                }
            }
        });
        const recordedGuildMemberIds = recordedGuildMembers.map(m => m.id);
        const newGuildMembers = allGuildMembers.filter(member => !recordedGuildMemberIds.includes(member.id));
        await this.prisma.discordGuildMember.createMany({
            data: newGuildMembers.map(newMember => ({
                id: newMember.id,
                discordGuildId: guild.id,
                messageQty: 0
            }))
        });
        this.logger.debug(`Create ${newGuildMembers.length} users for Guild ${guild.name}`);

        /**
         * After guilds are saved to DB, we sync the channels
         */
        this.syncChannelsFromGuilds()
    }

    private async _setupListeners() {
        /**
         * Listening Messages
         */
        this.client.on('messageCreate', this.handleNewMessage.bind(this));

        /**
         * Listening new member join to guild
         */
        this.client.on('guildMemberAdd', this.handleNewMemberInGuild.bind(this))

        this.client.on('channelCreate', this.handleNewChannelCreatedInGuild.bind(this));

        // after finished
        this.client.login(process.env.DISCORD_BOT_TOKEN);
    }

    findGuildInDatabase() {
        return this.prisma.discordGuild.findFirst();
    }

    async throwErrorOnNonListeningGuild(guildId: string) {
        const guildInfo = await this.findGuildInDatabase();
        if (guildInfo.id !== guildId) {
            this.logger.warn(`message ignored since from guild ${guildId}`);
            throw new Error(`message ignored since from guild ${guildId}`)
        }
    }

    /**
     * Listener handlers
     */
    async handleNewMessage(msg: Message<boolean>) {
        this.logger.debug('_setupListeners::onMessage');
        /** ignore on bot msg */
        if (msg.author.bot) return;
        /** see it's from listening guild */
        await this.throwErrorOnNonListeningGuild(msg.guildId);
    }

    async handleNewChannelCreatedInGuild(channel: NonThreadGuildBasedChannel) {
        this.logger.debug('channelCreate triggered');
        const guildInfo = await this.findGuildInDatabase();
        // ignore if not exist
        if (guildInfo.id !== channel.guildId) return;
        const guildMemberInChannels = channel.members.map((m) => ({
            id: m.id,
        }));

        await this.prisma.discordChannel.create({
            data: {
                id: channel.id,
                name: channel.name,
                type: channel.type,
                createdAt: channel.createdAt,
                discordGuildId: channel.guildId,
                members: {
                    connect: guildMemberInChannels
                }
            }
        });
        this.logger.debug(`New Channel "${channel.name}"(${channel.id}) created in Guild ${channel.guild.name}`);
    }

    async handleNewMemberInGuild(newMember: GuildMember) {
        const isMemberJoinBefore = await this.prisma.discordGuildMember.findUnique({ where: { id: newMember.id }});
        if (isMemberJoinBefore) {
            /** ignore on duplicated record */
            return;
        }
        await this.prisma.discordGuildMember.create({
            data: {
                id: newMember.id,
                discordGuildId: newMember.guild.id,
                messageQty: 0
            }
        })
    }

    /**
     * data syncing
     */
    async syncChannelsFromGuilds() {
        const { id: guildId } = await this.findGuildInDatabase();
        await this.syncChannelsFromGuild(guildId);
    }

    async syncChannelsFromGuild(guildId: string) {
        const guild = this.client.guilds.cache.get(guildId);
        const guildChannels = guild.channels.valueOf();
        const channelIds = guildChannels.map((v) => v.id);
        const foundChannelInfos = await this.prisma.discordChannel.findMany({
            where: {
                id: {
                    in: channelIds
                }
            }
        });
        const foundChannelIds = foundChannelInfos.map(c => c.id);
        console.debug('foundChannelIds', foundChannelIds);
        const notInsertedChannels = guildChannels.filter((guild) => !foundChannelIds.includes(guild.id)).toJSON();

        console.debug('notInsertedChannels', notInsertedChannels);
        await this.prisma.discordChannel.createMany({
            data: notInsertedChannels.map(channel => ({
                    id: channel.id,
                    name: channel.name,
                    type: channel.type,
                    createdAt: channel.createdAt,
                    discordGuildId: guildId,
            }))
        })
        await this.syncMembersInChannels();
    }

    /**
     * Member <=> Channel relationship only updated once a day
     * and should do it at 6AM
     */
    @Cron(CronExpression.EVERY_DAY_AT_6AM, {
        timeZone: 'Asia/Shanghai'
    })
    private async syncMembersInChannels() {
        const guildInfo = await this.findGuildInDatabase();
        const guild = this.client.guilds.cache.get(guildInfo.id);
        const guildChannels = guild.channels.valueOf();
        const guildMembersInDB = await this.prisma.discordGuildMember.findMany({
            where: {
                discordGuildId: guildInfo.id
            }
        });
        const guildMemberIdsInDB = guildMembersInDB.map(m => m.id);
        const insertData = guildChannels.map((channel) => {
            const members = (channel.members as ThreadMemberManager).valueOf()?.toJSON() || (channel.members as Collection<string, GuildMember>).toJSON();
            const memberIds = members
                .map((m: ThreadMember | GuildMember) => ({
                    id: m.id
                }))
                /** Fix: only connect existed members in DB */
                .filter(({ id }) => guildMemberIdsInDB.includes(id));
            return {
                id: channel.id,
                members: {
                    connect: memberIds
                }
            }
        });
        await this.prisma.$transaction(insertData.map(({ id, members }) => this.prisma.discordChannel.update({
                where: { id },
                data: {
                    members
                },
            })
        ));
        // for (const { id, members } of insertData) {
        //     await this.prisma.discordChannel.update({
        //         where: { id },
        //         data: {
        //             members
        //         },
        //     })
        // }
    }

    /** Analytic about guild / channel*/
    async getCurrentCountOfGuild(guildId: string): Promise<{ totalMemberCount: number, onlineMemberCount: number }> {
        const guild = await this.client.guilds.fetch({
            guild: guildId,
            withCounts: true
        })
        const totalMemberCount = guild.memberCount;
        const fetchedMembers = await guild.members.fetch({
            withPresences: true,
            force: true,
        });
        const onlineMemberCount = fetchedMembers.filter(m => {
            // if m.presence == null, then it's offline too 😅
            return m.presence && !['offline', 'invisible'].includes(m.presence?.status)
        }).size;
        return { totalMemberCount, onlineMemberCount }
    }

    @Cron(CronExpression.EVERY_HOUR)
    async storeCurrentCountOfGuilds() {
        try {
            this.logger.debug('Persist Listening Guilds Stats into Database.');
            const guildInfo = await this.findGuildInDatabase();

            const counts = await this.getCurrentCountOfGuild(guildInfo.id);
            await this.prisma.discordGuildStat.create({
                data: ({
                    discordGuildId: guildInfo.id,
                    totalMemberCount: counts.totalMemberCount,
                    onlineMemberCount: counts.onlineMemberCount
                })
            })
            await this._storeCurrentCountOfChannels();
        } catch (error) {
            Sentry.captureException(error);
            this.logger.error('storeCurrentCountOfGuilds::error:', error);
        }
        this.logger.verbose('storeCurrentCountOfGuilds::finished');
    }

    private async _storeCurrentCountOfChannels() {
        const channelsInfo = await this.prisma.discordChannel.findMany({
            include: {
                members: true
            }
        });
        /** use transaction to batch those create */
        await this.prisma.$transaction(
            channelsInfo.map(channel => this.prisma.discordGuildChannelStat.create({
                data: {
                    totalMemberCount: channel.members.length,
                    channel: { connect: {
                        id: channel.id
                    } }
                }
            }))
        );
    }
    /**
     * Fail safe protocol
     */
    private isExecuted = false;
    @Cron(`14 08 * * *`)
    private  _countGuildDailyAnalyticDataFailSafe() {
        /** ignore if it was executed already */
        if (this.isExecuted) {
            // resetting indicator
            this.isExecuted = false;
            return;
        };
        /** Otherwise run this incase of ungraceful reboot */
        this.countGuildDailyAnalyticData();
    }

    @Cron(`2 08 * * *`, {
        timeZone: 'Asia/Shanghai'
    })
    async countGuildDailyAnalyticData() {
        const guildInfo = await this.findGuildInDatabase()
        const counts = await this.prisma.discordGuildStat.findMany({
            where: {
                AND: {
                    discordGuildId: guildInfo.id,
                    createdAt: {
                        gte: getYesterday()
                    }
                }
            }
        });

        /** sort from small to large */
        const sortedByOnlineCount = counts.sort((a, b) => a.onlineMemberCount - b.onlineMemberCount);

        const dailyGuildStats = {
            dayStart: counts[0],
            dayEnd: counts[counts.length - 1],
            highestOnline: sortedByOnlineCount[sortedByOnlineCount.length - 1],
            lowestOnline: sortedByOnlineCount[0]
        };

        await this.prisma.discordGuildDailyStat.create({
            data: {
                discordGuildId: guildInfo.id,
                startTotalMemberCount: dailyGuildStats.dayStart.totalMemberCount,
                startOnlineMemberCount: dailyGuildStats.dayStart.onlineMemberCount,
                endTotalMemberCount: dailyGuildStats.dayEnd.totalMemberCount,
                endOnlineMemberCount: dailyGuildStats.dayEnd.onlineMemberCount,
                date: getYesterday(),
                highestOnlineMemberCount: dailyGuildStats.highestOnline.onlineMemberCount,
                lowestOnlineMemberCount: dailyGuildStats.lowestOnline.onlineMemberCount,
            }
        })

        /** count channel now */
        await this.countChannelsDailyAnalyticData();
        
        /** after what have done, setting the isExecuted to true */
        this.isExecuted = true;
    }

    async countChannelsDailyAnalyticData() {
        const channelIdToStats = new Map<string, {
            dayStart: DiscordGuildChannelStat;
            dayEnd: DiscordGuildChannelStat;
            highestMember: DiscordGuildChannelStat;
            lowestMember: DiscordGuildChannelStat;
        }>();
        const channelInfos = await this.prisma.discordChannel.findMany();

        /**
         * get all channel stats from yesterday
         */
        const channelsCounts = await this.prisma.discordGuildChannelStat.findMany({
            where: {
                createdAt: {
                    gte: getYesterday()
                }
            },
            include: {
                channel: true
            }
        });

        channelInfos.forEach(({ id: channelId }) => {
            const channelCounts = channelsCounts
                                    .filter((stats) => stats.channel.id === channelId)
                                    /** sort from small to large */
                                    .sort((a, b) => a.totalMemberCount - b.totalMemberCount);
            const dailyChannelStats = {
                dayStart: channelCounts[0],
                dayEnd: channelCounts[channelCounts.length - 1],
                highestMember: channelCounts[channelCounts.length - 1],
                lowestMember: channelCounts[0]
            };
            channelIdToStats.set(
                channelId,
                dailyChannelStats
            );
        })

        await this.prisma.discordGuildChannelDailyStat.createMany({
            data: channelInfos.map(({ id }) => {
                const vals = channelIdToStats.get(id);
                return {
                    discordChannelId: id,
                    date: getYesterday(),
                    startTotalMemberCount: vals.dayStart.totalMemberCount,
                    endTotalMemberCount: vals.dayEnd.totalMemberCount,
                    lowestTotalMemberCount: vals.lowestMember.totalMemberCount,
                    highestTotalMemberCount: vals.highestMember.totalMemberCount,
                }
            })
        })
    }

    /** Export daily data into XLSX */
    async exportGuildDailyData(): Promise<WorkSheet> {
        let head: unknown[] = [
                'Date',
                'Total Member(Start)',
                'Total Member(End)',
                'Online Member(Lowest)',
                'Online Member(Highest)',
                'Online Member(Start)',
                'Online Member(End)',
        ];
        const weekBefore = getXDaysAgoAtMidnight(7);
        const entries = await this.prisma.discordGuildDailyStat.findMany({
            where: {
                date: {
                    gte: weekBefore
                }
            }
        })
        const datas = entries.map((entry) => {
            return [
                moment(entry.date).tz('Asia/Shanghai').format('MMDD'),
                entry.startTotalMemberCount,
                entry.endTotalMemberCount,
                entry.lowestOnlineMemberCount,
                entry.highestOnlineMemberCount,
                entry.startOnlineMemberCount,
                entry.endOnlineMemberCount
            ]
        });
        return {
            name: "Discord Server Daily Stats",
            data: [head, ...datas],
            options: {},
        }
    }

    async exportChannelsDailyData(): Promise<WorkSheet> {
        let head: unknown[] = [
            'Channel Name',
            'Channel Type',
            'Date',
            'Total Member(Start)',
            'Total Member(End)',
            'Total Member(Lowest)',
            'Total Member(Highest)',
        ];
        const weekBefore = getXDaysAgoAtMidnight(7);
        const entries = await this.prisma.discordGuildChannelDailyStat.findMany({
            where: {
                date: {
                    gte: weekBefore
                },
            },
            include: {
                channel: true
            }
        })
        const datas = entries.map(({
            channel,
            date,
            startTotalMemberCount,
            endTotalMemberCount,
            lowestTotalMemberCount,
            highestTotalMemberCount
        }) => {
            return [
                channel.name,
                channel.type,
                moment(date).tz('Asia/Shanghai').format('MMDD'),
                startTotalMemberCount,
                endTotalMemberCount,
                lowestTotalMemberCount,
                highestTotalMemberCount
            ]
        });
        return {
            name: "Discord Channels Daily Stats",
            data: [head, ...datas],
            options: {},
        }
    }

    async exportGuildCurrentStat(laterThan = getXDaysAgoAtMidnight(7)): Promise<WorkSheet> {
        let head: unknown[] = [
            'Date',
            'Online Member',
            'Total Member',
        ];
        const entries = await this.prisma.discordGuildStat.findMany({
            where: {
                createdAt: {
                    gte: laterThan
                },
            },
            include: {
                guild: true
            }
        })
        const datas = entries.map((entry) => {
            return [
                moment(entry.createdAt).tz('Asia/Shanghai').format('MMDD HH:mm'),
                entry.onlineMemberCount,
                entry.totalMemberCount,
            ]
        });
        return {
            name: "Discord Server Hourly Stats",
            data: [head, ...datas],
            options: {},
        }
    }

    async exportChannelsCurrentStat() {
        let head: unknown[] = [
            'Channel Name',
            'Channel Type',
            'Date',
            'Total Member',
        ];
        const entries = await this.prisma.discordGuildChannelStat.findMany({
            include: {
                channel: true
            }
        });
        const datas = entries.map((entry) => {
            return [
                entry.channel.name,
                entry.channel.type,
                entry.createdAt.toString(),
                entry.totalMemberCount,
            ]
        });
        return {
            name: "Discord Channel Current Stats",
            data: [head, ...datas],
            options: {},
        }
    }

    exportGuildYesterdayHourStats() {
        return this.exportGuildCurrentStat(getYesterday());
    }
}
