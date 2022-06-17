import { Controller, Get } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('discord')
export class DiscordController {
    constructor(
        private readonly prisma: PrismaService
    ) {

    }
    @Get('/channels/stat')
    async getChannelStats() {
        const stats = await this.prisma.discordGuildChannelStat.findMany();
        return { stats }
    }

    @Get('/channels/dailyStat')
    async getChannelDailyStats() {
        const stats = await this.prisma.discordGuildChannelDailyStat.findMany();
        return { stats }
    }

    @Get('/guild/stat')
    async getGuildStats() {
        const stats = await this.prisma.discordGuildStat.findMany();
        return { stats }
    }

    @Get('/guild/dailyStat')
    async getGuildDailyStats() {
        const stats = await this.prisma.discordGuildDailyStat.findMany();
        return { stats }
    }
}
