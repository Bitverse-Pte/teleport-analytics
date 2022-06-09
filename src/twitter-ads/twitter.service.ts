import {Logger} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {Cron, CronExpression} from "@nestjs/schedule";
import {Client} from "twitter-api-sdk";
import {PrismaClient} from "@prisma/client";

const client = new Client(process.env.TWITTER_BEARER_TOKEN)

const prisma = new PrismaClient()

export class TwitterService {
    private readonly logger = new Logger(TwitterService.name);

    constructor(
        private prisma: PrismaService
    ) {
        this._init()
    }

    private async _init() {
        const a = this.prisma.twitterAccount.findFirst()
        console.log(a)
        await this.getUserInfo()
    }

    async getUserInfo() {
        console.log(1)
        const resp = await client.users.findUsersById({
            ids: ["1490559369498734593"],
            "user.fields": ["public_metrics"]
        })
        console.log(2, resp)
        for await (const account of resp.data) {
            console.log(account.name, account.id)
            console.log(account.public_metrics)
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async syncAccountData() {
        this.logger.debug('start sync account data')
        const accounts = await this.prisma.twitterAccount.findMany();

    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async logTwitterDailyStat() {
        this.logger.debug('start log daily info')
    }

    async setAccount(username: string): Promise<string> {
        console.log(username)
        const resp = await client.users.findUserByUsername(
            username,
            {
                "user.fields": ["public_metrics"]
            }
        )
        const accountId = resp.data.id
        const name = resp.data.name
        if (resp.data.id !== "") {
            const result = this.prisma.twitterAccount.create({
                data: {
                    name,
                    username,
                    accountId,
                }
            })
            this.logger.debug(`create new account ${result}`)
        }
        return ""
    }

}
