import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { PrismaService } from 'src/prisma/prisma.service';
require('dotenv').config();

type ListeningMessageTypes = 'text' | 'voice' | 'video' | 'sticker' | 'photo'

@Injectable()
export class TelegramGroupService {
    private readonly logger = new Logger(TelegramGroupService.name);

    private bot: Telegraf;
    constructor(
        private prisma: PrismaService
    ) {
        this.bot = new Telegraf(process.env.TELEGRAM_BOT_ACCESS_TOKEN, {
            telegram: {
                agent: new SocksProxyAgent(process.env.PROXY_SETTINGS)
            }
        });
        this._registerListener();
        this.bot.launch();
        // Enable graceful stop
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }

    /**
     * Where heavy jobs were done.
     */
    private _registerListener() {
        /**
         * Listening on text
         */
        (['text', 'voice', 'video', 'sticker', 'photo'] as const).forEach(type => this._listenOnGeneralMessage(type))
    }

    private async _listenOnGeneralMessage(type: ListeningMessageTypes) {
        this.bot.on(type, async (ctx) => {
            console.log('ctx.message', ctx.message);
            // skip if it was bot message
            if (ctx.message.from.is_bot) return;
            const chatId = ctx.message.chat.id;
            if (!process.env.TELEGRAM_LISTENING_GROUP_IDS.split(',').map(s => Number(s) * -1).includes(chatId)) {
                // skip if this chat was not listening
                return;
            }
            const userId = ctx.message.from.id;
            await this.addMessageCountForUser(userId, chatId, type, ctx.message.date);
        });
    }

    /**
     * needed for daily member's count
     * @param groupId the group's chat id
     * @returns the current number of members in this chat
     */
    async countGroupMembers(groupId: string | number) {
        return this.bot.telegram.getChatMembersCount(groupId);
    }
    /**
     * Add message count for user
     */
   async addMessageCountForUser(userId: number, chatId: number, type: ListeningMessageTypes, date: number) {
       this.logger.debug('addMessageCountForUser', {
           userId,
           chatId,
           type,
           date
       });
       const messageSentAt = new Date(date * 1000);
       console.debug('messageSentAt', messageSentAt);
       let member = await this.prisma.telegramChatMember.findFirst({
           where: {
               userId,
               groupId: chatId
           }
       });
       if (!member) {
           member = await this.prisma.telegramChatMember.create({
               data: {
                   userId,
                   groupId: chatId,
                   messageCount: 1,
                   activeDays: 1,
                   lastSeen: messageSentAt
               }
           })
       } else {
            const isLastSeenToday = member.lastSeen.toDateString() == messageSentAt.toDateString();
            const updateData: Partial<typeof member> = { messageCount: member.messageCount + 1, lastSeen: messageSentAt };
            console.debug('member.lastSeen', member.lastSeen);
            console.debug('isLastSeenToday', isLastSeenToday);
            if (!isLastSeenToday) {
                updateData.activeDays = member.activeDays + 1;
            }
            await this.prisma.telegramChatMember.update({
                where: { id: member.id },
                data: updateData
            });
       }
   }
}
