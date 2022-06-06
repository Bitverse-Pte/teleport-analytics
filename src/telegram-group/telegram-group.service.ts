import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { PrismaService } from 'src/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
require('dotenv').config();

type ListeningMessageTypes = 'text' | 'voice' | 'video' | 'sticker' | 'photo'

@Injectable()
export class TelegramGroupService {
    private readonly logger = new Logger(TelegramGroupService.name);

    private bot: Telegraf;

    /**
     * 
     * daily counters
     */
    private dailyNewMemberCount: Record<number, number> = {};
    private dailyMessageCount: Record<number, number> = {};
    private activeMemberCount: Record<number, number> = {};
    private listeningChats: number[] = [];

    constructor(
        private prisma: PrismaService
    ) {
        this.bot = new Telegraf(process.env.TELEGRAM_BOT_ACCESS_TOKEN, {
            telegram: {
                agent: new SocksProxyAgent(process.env.PROXY_SETTINGS)
            }
        });
       this._init();
    }

    private async _init() {
        const listeningChats = await this.prisma.telegramGroup.findMany();
        this.listeningChats = listeningChats.map(c => c.chatId.toNumber());
        this.logger.debug(`Listening chats ${this.listeningChats.join(', ')}`);
        this.listeningChats.forEach(this._resetCounter.bind(this));
        this.bot.use(async (ctx, next) => {
            const currentChatId = ctx.chat.id;
            if (!this.listeningChats.includes(currentChatId)) {
                this.logger.warn(`attempt to use bot in chat id ${currentChatId}, will be ignored.`);
                // skip if this chat was not listening
                return;
            }
            // skip if it was bot message
            if (ctx.message.from.is_bot) return;
            this.logger.debug('ctx.message', ctx.message);
            // fallthrough here if no problems at all!
            await next();
        });
        this._registerListener();
        this.bot.launch();
        // Enable graceful stop
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }

    private _resetCounter(chatId: number) {
        console.debug('chatId', chatId);
        console.info(`Before: this.dailyNewMemberCount ${this.dailyNewMemberCount[chatId]} this.dailyMessageCount ${this.dailyMessageCount[chatId]} this.activeMemberCount ${this.activeMemberCount[chatId]}`)
        this.dailyNewMemberCount[chatId] = 0;
        this.dailyMessageCount[chatId] = 0;
        this.activeMemberCount[chatId] = 0;
    }

    /**
     * Where heavy jobs were done.
     */
    private _registerListener() {
        /**
         * Listening on text
         * @TODO use batch request instead, to avoid DB too many connections error
         */
        (['text', 'voice', 'video', 'sticker', 'photo'] as const).forEach(type => this._listenOnGeneralMessage(type));
        this.bot.on('new_chat_members', async (ctx) => {
            const newMembers = ctx.message.new_chat_members;
            this.dailyNewMemberCount[ctx.message.chat.id] += 1;
            await this.prisma.telegramChatMember.createMany({
                data: newMembers.map(m => ({
                    userId: m.id,
                    groupId: ctx.message.chat.id,
                    messageCount: 0,
                    activeDays: 0,
                    lastSeen: new Date(0)
                }))
            });
        });
        this.bot.on('left_chat_member', async (ctx) => {
            const target = await this.prisma.telegramChatMember.findFirst({
                where: { userId: ctx.message.from.id, groupId: ctx.message.chat.id }
            });
            /** ignore deletion if not exist */
            if (target)
                await this.prisma.telegramChatMember.delete({
                    where: {
                        id: target.id
                    }
                });
        })
    }

    private async _listenOnGeneralMessage(type: ListeningMessageTypes) {
        this.bot.on(type, async (ctx) => {
            const chatId = ctx.message.chat.id;
            const userId = ctx.message.from.id;
            await this.addMessageCountForUser(userId, chatId, type, ctx.message.date);
        });
    }

    /**
     * needed for daily member's count
     * @param groupId the group's chat id
     * @returns the current number of members in this chat
     */
    async countGroupMembers(groupId: number) {
        if (groupId > 0) {
            groupId = groupId * -1;
        }
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
       this.dailyMessageCount[chatId] += 1;
       if (!member) {
           this.dailyNewMemberCount[chatId] += 1;
           member = await this.prisma.telegramChatMember.create({
               data: {
                   userId,
                   groupId: chatId,
                   messageCount: 1,
                   activeDays: 1,
                   lastSeen: messageSentAt
               }
           });
       } else {
            const isLastSeenToday = member.lastSeen.toDateString() == messageSentAt.toDateString();
            const updateData: Partial<typeof member> = { messageCount: member.messageCount + 1, lastSeen: messageSentAt };
            console.debug('member.lastSeen', member.lastSeen);
            console.debug('isLastSeenToday', isLastSeenToday);
            if (!isLastSeenToday) {
                updateData.activeDays = member.activeDays + 1;
                this.activeMemberCount[chatId] += 1;
            }
            await this.prisma.telegramChatMember.update({
                where: { id: member.id },
                data: updateData
            });
       }
   }

   /**
    * Daily jobs
    */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async logAllTelegramGroupDailyStats() {
        const totalMemberCounts = await Promise.all(this.listeningChats.map(this.countGroupMembers));
        const groupStats = this.listeningChats.map((groupId, idx) => ({
            groupId,
            newMemberCount: this.dailyNewMemberCount[groupId],
            messageCount: this.dailyMessageCount[groupId],
            // active member means anyone that send at least 1 message in group
            activeMemberCount: this.activeMemberCount[groupId],
            totalMemberCount: totalMemberCounts[idx]
        }))
        await this.prisma.telegramGroupDailyStat.createMany({
            data: groupStats
        });
        this.listeningChats.forEach(this._resetCounter);
    }
}
