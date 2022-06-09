import { REST } from '@discordjs/rest';
import { Injectable, Logger } from '@nestjs/common';
import { Client, Intents } from 'discord.js';
import { PrismaService } from 'src/prisma/prisma.service';
require('dotenv').config();

@Injectable()
export class DiscordService {
    private logger = new Logger(DiscordService.name);
    private rest: REST;
    private client: Client;

    /** analytic related */
    private dailyNewMemberCount: Record<string, number> = {};
    private dailyMessageCount: Record<string, number> = {};
    private activeMemberCount: Record<string, number> = {};
    /** @TODO listeningChats in DB */
    private listeningChats: string[] = [];


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
        this._setupListeners()
    }

    private async _setupListeners() {
        /**
         * Listening Messages
         */
        this.client.on('messageCreate', async (msg) => {
            this.logger.debug('_setupListeners::onMessage');
            console.debug('onMessage::msg', msg)
            /** ignore on bot msg */
            if (msg.author.bot) return;
            /** uncle roger coming now */
            if (msg.content.includes('MSG')) {
                await msg.reply('Fuiyoh, MSG\'s the BEST');
            } else {
                await msg.reply('haiyaa');
            }
        })

        /**
         * Listening new member join to guild
         */
        this.client.on('guildMemberAdd', (e) => {
            this.logger.debug('_setupListeners::guildMemberAdd');
            console.debug('guildMemberAdd::e:', e);
        }) 

        this.client.on('channelCreate', async (channel) => {
            this.logger.debug('channelCreate triggered');
            const guildInfo = await this.findGuildInDatabase(channel.guildId);
            // ignore if not exist
            if (!guildInfo) return;
            const guildMemberInChannels = channel.members.map((m) => ({
                id: m.id,
                discordGuildId: m.guild.id
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
        });
        /**
         * Listening member's presence
         */
        this.client.on('presenceUpdate', (e) => {
            this.logger.debug('_setupListeners::presenceUpdate');
            console.debug('presenceUpdate::e:', e);
        })

        // after finished
        this.client.login(process.env.DISCORD_BOT_TOKEN);
    }
}
