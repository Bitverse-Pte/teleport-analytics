import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { PrismaService } from 'src/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailService } from 'src/email/email.service';
import { getYesterday } from 'src/utils/date';
import type { Message } from 'telegraf/typings/core/types/typegram';
import { TelegramGroupStats } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime';
require('dotenv').config();

type ListeningMessageTypes = 'text' | 'voice' | 'video' | 'sticker' | 'photo'

type MessageQueueItem = {
    type: ListeningMessageTypes;
    msg: Message;
}
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

    private messageToBeHandled: MessageQueueItem[] = [];

    constructor(
        private prisma: PrismaService,
    ) {
        const agent = process.env.PROXY_SETTINGS ? new SocksProxyAgent(process.env.PROXY_SETTINGS) : undefined;
        this.bot = new Telegraf(process.env.TELEGRAM_BOT_ACCESS_TOKEN, {
            telegram: {
                agent: agent
            }
        });
       this._init();
    }

    private async _init() {
        const listeningChats = await this.prisma.telegramGroup.findMany();
        this.listeningChats = listeningChats.map(c => c.chatId.toNumber());
        this.logger.debug(`Listening chats ${this.listeningChats.join(', ')}`);
        this.bot.use(async (ctx, next) => {
            const currentChatId = ctx.chat.id;
            if (!this.listeningChats.includes(currentChatId)) {
                this.logger.warn(`attempt to use bot in chat id ${currentChatId}, will be ignored.`);
                // skip if this chat was not listening
                return;
            }
            // skip if no message (like edited_message)
            if (!ctx.message) return;
            // skip if it was bot message
            if (ctx.message.from.is_bot) return;
            // skip if from id was not number
            if (isNaN(ctx.message.from.id)) return;

            this.logger.debug('ctx.message', ctx.message);
            // fallthrough here if no problems at all!
            await next();
        });
        this._registerListener();
        this.bot.launch();
        // Enable graceful stop
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
        // recover status in case of restart
        this._recoverCounterFromDB();
    }

    private _resetCounter(chatId: number) {
        this.logger.debug('_resetCounter::chatId' + chatId);
        this.logger.log(`Before: this.dailyNewMemberCount ${this.dailyNewMemberCount[chatId]} this.dailyMessageCount ${this.dailyMessageCount[chatId]} this.activeMemberCount ${this.activeMemberCount[chatId]}`)
        this.dailyNewMemberCount[chatId] = 0;
        this.dailyMessageCount[chatId] = 0;
        this.activeMemberCount[chatId] = 0;
    }

    private async _getLatestCounterFromDB(): Promise<{
        groupId: TelegramGroupStats['groupId'];
        activeMemberCount: TelegramGroupStats['activeMemberCount'];
        newMemberCount: TelegramGroupStats['newMemberCount'];
        messageCount: TelegramGroupStats['messageCount']
    }[]> {
        
        const latestCounter = await this.prisma.telegramGroupStats.findMany({
            where: {
                groupId: { in: this.listeningChats },
                date: {
                    gte: getYesterday()
                }
            },
            orderBy: {
                id: 'desc'
            }
        });
        return this.listeningChats.map((chatId) => {
            return latestCounter.filter((c) => c.groupId.toNumber() === chatId)[0] || {
                groupId: new Decimal(chatId),
                activeMemberCount: 0,
                newMemberCount: 0,
                messageCount: 0
            }
        })
    }

    private async _recoverCounterFromDB() {
        const latestCounters = await this._getLatestCounterFromDB();
        latestCounters.forEach(stat => {
            this.dailyNewMemberCount[stat.groupId.toNumber()] = stat.newMemberCount;
            this.dailyMessageCount[stat.groupId.toNumber()] = stat.messageCount;
            this.activeMemberCount[stat.groupId.toNumber()] = stat.activeMemberCount;
        });   
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

    private _listenOnGeneralMessage(type: ListeningMessageTypes) {
        this.bot.on(type, (ctx) => {
            this.messageToBeHandled.push({
                type,
                msg: ctx.message
            })
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
     * Update message count or create a chatmember in DB
     * @param chatId the telegram id of group chat
     * @param userId the telegram id of user
     * @param newMessageCount qty of new message that user was sent
     * @returns a updated or created chat member
     */
    private async _upsertMemberForMessage(chatId: number, userId: number, newMessageCount: number) {
        const nowSeen = new Date();

        let member = await this.prisma.telegramChatMember.findFirst({
            where: {
                userId,
                groupId: chatId
            }
        });

        if (!member) {
            /**
             * Create new Member if not exist
             */
            this.dailyNewMemberCount[chatId] += 1;
            return this.prisma.telegramChatMember.create({
                data: {
                    userId,
                    groupId: chatId,
                    messageCount: newMessageCount,
                    activeDays: 1,
                    lastSeen: nowSeen
                }
            })
        } else {
            /**
             * Member exist in DB, update this entity
             */
            const isLastSeenToday = member.lastSeen.toDateString() == nowSeen.toDateString();
            const updateData: any = { messageCount: {
                increment: newMessageCount
            }, lastSeen: nowSeen };
            if (!isLastSeenToday) {
                updateData.activeDays = {
                    increment: 1
                };
                this.activeMemberCount[chatId] += 1;
            }
            return this.prisma.telegramChatMember.update({
                where: { id: member.id },
                data: updateData
            });
        };
    }

    /** Work as a lock */
    private isMessageQueueHandling = false;

    @Cron(CronExpression.EVERY_MINUTE)
    async handleMessageQueue() {
        if (this.isMessageQueueHandling) {
            this.logger.warn(`handleMessageQueue was skipped since the lock was on`);
            return;
        }
        this.isMessageQueueHandling = true;
        try {
            const { messageToBeHandled } = this;
            const messageCount: Record<number, Record<number, number>> = {};
            for (const msg of messageToBeHandled) {
                /**
                 * open object if not exist
                 */
                if (!messageCount[msg.msg.chat.id]) messageCount[msg.msg.chat.id] = {};
                /**
                 * increment on counter
                 */
                if (messageCount[msg.msg.chat.id][msg.msg.from.id]) {
                    messageCount[msg.msg.chat.id][msg.msg.from.id] += 1;
                } else {
                    messageCount[msg.msg.chat.id][msg.msg.from.id] = 1;
                }
            }
            /**
             * Update dailyMessageCount[chatId]
             */
            for (const chatId in messageCount) {
                if (Object.prototype.hasOwnProperty.call(messageCount, chatId)) {
                    const element = messageCount[chatId];
                    const newMsgQtyInGroup = Object.values(element).reduce((prevVal, curVal) => prevVal + curVal);
                    this.dailyMessageCount[chatId] += newMsgQtyInGroup;
                }
            }
            /** Update ChatMember stat */
            for (const chatId in messageCount) {
                for (const userId in messageCount[chatId]) {
                    const userNewMsgInGroupCount = messageCount[chatId][userId];
                    await this._upsertMemberForMessage(Number(chatId), Number(userId), userNewMsgInGroupCount)
                }
            }

            // clear the queue after finish
            this.messageToBeHandled = [];
        } catch (error) {
            this.logger.error(`handleMessageQueue::Error happened:`, error);
        } finally {
            /**
             * Release the lock no matter what
             */
            this.isMessageQueueHandling = false;
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async saveCurrentTelegramStat() {
        const totalMemberCounts: number[] = await Promise.all(this.listeningChats.map(this.countGroupMembers.bind(this)));

        this.logger.debug('saveCurrentTelegramStat::counting groupStats');
        const groupStats = this.listeningChats.map((groupId, idx) => {
            return {
                groupId,
                newMemberCount: this.dailyNewMemberCount[groupId],
                messageCount: this.dailyMessageCount[groupId],
                // active member means anyone that send at least 1 message in group
                activeMemberCount: this.activeMemberCount[groupId],
                totalMemberCount: totalMemberCounts[idx]
            };
        })
        await this.prisma.telegramGroupStats.createMany({
            data: groupStats
        });
    }
   /**
    * Save yesterday's stat and reset the counter
    */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
        timeZone: 'Asia/Shanghai'
    })
    async logAllTelegramGroupDailyStats() {
        const totalMemberCounts: number[] = await Promise.all(this.listeningChats.map(this.countGroupMembers.bind(this)));
        const yesterday = getYesterday();
        const activeNewMembers = await this.prisma.telegramChatMember.findMany({
            where: {
                activeDays: 1,
                joinAt: {
                    gte: yesterday
                }
            }
        });
        const activeNewMembersCounter: Record<number, number> = {};
        activeNewMembers.forEach((user) => {
            const chatId = user.groupId.toNumber();
            if (activeNewMembersCounter[chatId]) {
                activeNewMembersCounter[chatId] += 1;
            } else {
                activeNewMembersCounter[chatId] = 1;
            }
        });
        this.logger.debug('logAllTelegramGroupDailyStats::counting groupStats');
        const groupStats = this.listeningChats.map((groupId, idx) => {
            return {
                groupId,
                newMemberCount: this.dailyNewMemberCount[groupId],
                messageCount: this.dailyMessageCount[groupId],
                date: yesterday,
                // active member means anyone that send at least 1 message in group
                activeMemberCount: this.activeMemberCount[groupId],
                activeNewMemberCount: activeNewMembersCounter[groupId] || 0,
                totalMemberCount: totalMemberCounts[idx]
            };
        })
        await this.prisma.telegramGroupDailyStat.createMany({
            data: groupStats
        });
        this.listeningChats.forEach(this._resetCounter.bind(this));
    }

   async exportDailyData() {
    let head: unknown[] = [
            'Group ID',
            'Date',
            'Active Member',
            'Total Message(s)',
            'New Member',
            'Conversion Rate',
            'Total Member'
    ];
    const yesterday = getYesterday();
    const entries = await this.prisma.telegramGroupDailyStat.findMany({
        where: {
            date: yesterday
        }
    })

    const datas = entries.map((entry) => {
        const newMemberConversionRate = `${((entry.activeNewMemberCount / entry.newMemberCount) * 100).toFixed(2)} %`;
        return [
            entry.groupId.toString(),
            entry.date.toDateString(),
            entry.activeMemberCount,
            entry.messageCount,
            entry.newMemberCount,
            newMemberConversionRate,
            entry.totalMemberCount
        ]
    });

    return {
        name: "Telegram Group Daily Stats",
        data: [head, ...datas],
        options: {},
    }
  }
}
