import { REST } from '@discordjs/rest';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DiscordGuildChannelStat } from '@prisma/client';
import { Client, Collection, GuildMember, Intents, Message, NonThreadGuildBasedChannel, ThreadMember, ThreadMemberManager } from 'discord.js';
import { PrismaService } from 'src/prisma/prisma.service';
import { getXDaysAgoAtMidnight, getYesterday } from 'src/utils/date';
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

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    private async syncMembersInChannels() {
        const guildInfo = await this.findGuildInDatabase();
        const guild = this.client.guilds.cache.get(guildInfo.id);
        const guildChannels = guild.channels.valueOf();
        const insertData = guildChannels.map((channel) => {
            const members = (channel.members as ThreadMemberManager).valueOf()?.toJSON() || (channel.members as Collection<string, GuildMember>).toJSON();
            return {
                id: channel.id,
                members: {
                    connect: members.map((m: ThreadMember | GuildMember) => ({
                        id: m.id
                    }))
                }
            }
        });

        for (const { id, members } of insertData) {
            await this.prisma.discordChannel.update({
                where: { id },
                data: {
                    members
                }
            })
        }
    }

    /** Analytic about guild / channel*/
    async getCurrentCountOfGuild(guildId: string): Promise<{ totalMemberCount: number, onlineMemberCount: number }> {
        const guild = this.client.guilds.cache.get(guildId);
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

    @Cron(CronExpression.EVERY_5_MINUTES)
    async storeCurrentCountOfGuilds() {
        this.logger.debug('Persist Listening Guilds Stats into Database.');
        const guildInfo = await this.findGuildInDatabase();

        const counts = await this.getCurrentCountOfGuild(guildInfo.id);
        console.debug('storeCurrentCountOfGuilds::counts', counts);

        await this.prisma.discordGuildStat.create({
            data: ({
                discordGuildId: guildInfo.id,
                totalMemberCount: counts.totalMemberCount,
                onlineMemberCount: counts.onlineMemberCount
            })
        })
        /** no online counter for this, since member status is universal, just use this */
        this._storeCurrentCountOfChannels(counts.onlineMemberCount)
    }

    private async _storeCurrentCountOfChannels(onlineMemberCount: number) {
        const channelsInfo = await this.prisma.discordChannel.findMany({
            include: {
                members: true
            }
        });
        for (const channel of channelsInfo) {
            await this.prisma.discordGuildChannelStat.create({
                data: {
                    totalMemberCount: channel.members.length,
                    onlineMemberCount,
                    channel: { connect: {
                        id: channel.id
                    } }
                }
            })
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
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
              
                highestOnlineMemberCount: dailyGuildStats.highestOnline.onlineMemberCount,
                lowestOnlineMemberCount: dailyGuildStats.lowestOnline.onlineMemberCount,
            }
        })
        
        /** count channel now */
        await this.countChannelsDailyAnalyticData();
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
                    startOnlineMemberCount: vals.dayStart.onlineMemberCount,
                    endOnlineMemberCount: vals.dayEnd.onlineMemberCount,
                    startTotalMemberCount: vals.dayStart.totalMemberCount,
                    endTotalMemberCount: vals.dayEnd.totalMemberCount,
                    lowestTotalMemberCount: vals.lowestMember.totalMemberCount,
                    highestTotalMemberCount: vals.highestMember.totalMemberCount,
                }
            })
        })
    }

    /** Export daily data into XLSX */
    async exportGuildDailyData() {
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
                entry.date.toDateString(),
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

    async exportChannelsDailyData() {
        let head: unknown[] = [
            'Channel Name',
            'Channel Type',
            'Date',
            'Online Member(Start)',
            'Online Member(End)',
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
            startOnlineMemberCount,
            endOnlineMemberCount,
            startTotalMemberCount,
            endTotalMemberCount,
            lowestTotalMemberCount,
            highestTotalMemberCount
        }) => {
            return [
                channel.name,
                channel.type,
                date.toDateString(),
                startOnlineMemberCount,
                endOnlineMemberCount,
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
}
