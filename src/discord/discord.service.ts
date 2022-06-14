import { REST } from '@discordjs/rest';
import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DiscordGuild, DiscordGuildMember } from '@prisma/client';
import { Client, Collection, GuildMember, Intents, Message, NonThreadGuildBasedChannel, Presence, ThreadMember, ThreadMemberManager } from 'discord.js';
import { PrismaService } from 'src/prisma/prisma.service';
import { getYesterday } from 'src/utils/date';
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
        const listeningGuildInfos = await this.findGuildsInDatabase();
        const matchedGuilds = listeningGuildInfos.map((ginfo) => this.client.guilds.cache.get(ginfo.id));

        for (const guild of matchedGuilds) {
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
        }

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

    findGuildInDatabase(id: string) {
        return this.prisma.discordGuild.findFirst({
            where: { id }
        });
    }

    findGuildsInDatabase() {
        /** return all listening guilds */
        return this.prisma.discordGuild.findMany();
    }

    async throwErrorOnNonListeningGuild(guildId: string) {
        const guildInfo = await this.findGuildInDatabase(guildId);
        if (!guildInfo) {
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
        const guildInfo = await this.findGuildInDatabase(channel.guildId);
        // ignore if not exist
        if (!guildInfo) return;
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
        const guildsInfo = await this.findGuildsInDatabase();
        for (const { id: guildId } of guildsInfo) {
            await this.syncChannelsFromGuild(guildId);
        }
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
        await this.syncMembersInChannels(guildId);
    }

    private async syncMembersInChannels(guildId: string) {
        const guild = this.client.guilds.cache.get(guildId);
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

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    private async _syncMembersInChannelsInGuilds() {
        const guildInfos = await this.findGuildsInDatabase();
        for (const g of guildInfos) {
            await this.syncMembersInChannels(g.id);
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
        const guildInfos = await this.findGuildsInDatabase();

        const counts = await Promise.all(guildInfos.map(({ id }) => {
            return this.getCurrentCountOfGuild(id);
        }));
        console.debug('storeCurrentCountOfGuilds::counts', counts);

        await this.prisma.discordGuildStat.createMany({
            data: guildInfos.map(({ id }, idx) => ({
                discordGuildId: id,
                totalMemberCount: counts[idx].totalMemberCount,
                onlineMemberCount: counts[idx].onlineMemberCount
            }))
        })
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async countGuildDailyAnalyticData() {
        const infos = await this.findGuildsInDatabase()
        const counts = await this.prisma.discordGuildStat.findMany({
            where: {
                AND: {
                    discordGuildId: { in: infos.map(g => g.id) },
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
        console.debug('dailyGuildStats', dailyGuildStats);
        return dailyGuildStats;
    }


}
