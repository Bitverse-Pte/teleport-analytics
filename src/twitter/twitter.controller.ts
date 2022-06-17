import { Controller, Get } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('twitter')
export class TwitterController {
    constructor(
        private readonly prisma: PrismaService
    ) {}

    @Get('/account/list')
    async getAccountList() {
        const stats = await this.prisma.twitterAccount.findMany();
        return { stats }
    }

    @Get('/account/realTimeStat')
    async getAccountStats() {
        const stats = await this.prisma.twitterAccountRealTimeStat.findMany();
        return { stats }
    }

    @Get('/account/dailyStat')
    async getAccountDailyStats() {
        const stats = await this.prisma.twitterAccountDailyStat.findMany();
        return { stats }
    }

    @Get('/tweet/realTimeStat')
    async getTweetStats() {
        const stats = await this.prisma.tweetRealTimeStat.findMany();
        return { stats }
    }

    @Get('/tweet/dailyStat')
    async getGuildDailyStats() {
        const stats = await this.prisma.tweetsDailyStat.findMany();
        return { stats }
    }

    @Get('/tweet')
    async getTweet() {
        const stats = await this.prisma.tweet.findMany();
        return { stats }
    }

}
