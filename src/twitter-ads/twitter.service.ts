import {Injectable, Logger} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {Cron, CronExpression} from "@nestjs/schedule";
import {auth, Client} from "twitter-api-sdk";

const client = new Client(process.env.TWITTER_BEARER_TOKEN)
const authClient = new Client(new auth.OAuth2User({
    client_id: process.env.TWITTER_CLIENT_ID,
    client_secret: process.env.TWITTER_CLIENT_SECRET,
    callback: "http://127.0.0.1:3000/callback",
    scopes: ["tweet.read", "offline.access"],
}))

@Injectable()
export class TwitterService {
    private readonly logger = new Logger(TwitterService.name);

    constructor(
        private prisma: PrismaService
    ) {
        this._init()
    }

    private async _init() {
        await this.syncAccountData()
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async syncAccountData() {
        this.logger.debug('start sync account data')
        const accounts = await this.prisma.twitterAccount.findMany();
        const ids = [];
        for await (const account of accounts) {
            ids.push(account.accountId)
        }
        await client.users.findUsersById({
            "ids": ids,
            "user.fields": ["public_metrics"]
        }).then(async (resp) => {
            this.logger.debug(resp)
            for (const item of resp.data) {
                await this.prisma.twitterAccountRealTimeStat.create({
                    data: {
                        twitterAccountId: item.id,
                        followersCount: item.public_metrics.followers_count,
                        followingCount: item.public_metrics.following_count,
                        tweetCount: item.public_metrics.tweet_count,
                        listedCount: item.public_metrics.listed_count,
                    }
                }).then((resp) => {
                }).catch((error) => {
                    this.logger.error(error)
                })
            }
        }).catch((error) => {
            this.logger.error(error)
        })
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async logTwitterDailyStat() {
        this.logger.debug('start log daily info')
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async syncTweetData() {
        this.logger.debug('start sync tweet data')
        const tweets = await this.prisma.tweet.findMany();
        const ids = [];
        for await (const tweet of tweets) {
            ids.push(tweet.tweetId)
        }
        await authClient.tweets.findTweetsById({
            "ids": ids,
            "tweet.fields": ["public_metrics", "non_public_metrics"]
        }).then(async (resp) => {
            this.logger.debug(resp)
            for (const item of resp.data) {
                await this.prisma.tweetRealTimeStat.create({
                    data: {
                        tweetId: item.id,
                        impressions: item.non_public_metrics.impression_count,
                        urlLinkClicks: 0, // item.non_public_metrics.url_link_clicks,
                        userProfileClicks: 0, // item.non_public_metrics.user_profile_clicks,
                        retweets: item.public_metrics.retweet_count,
                        quoteTweets: item.public_metrics.quote_count,
                        likes: item.public_metrics.like_count,
                        replies: item.public_metrics.reply_count,
                        videoViews: 0,
                    }
                }).then((resp) => {
                }).catch((error) => {
                    this.logger.error(error)
                })
            }
        }).catch((error) => {
            this.logger.error(error)
        })
    }

    async apiSetAccount(username: string): Promise<string> {
        const resp = await client.users.findUserByUsername(
            username,
            {
                "user.fields": ["public_metrics"]
            }
        )
        const accountId = resp.data.id
        const name = resp.data.name
        if (resp.data.id !== "") {
            await this.prisma.twitterAccount.create({
                data: {
                    name,
                    username,
                    accountId,
                }
            }).then((resp) => {
                this.logger.debug(`setAccount success: ${resp.id}, ${resp.name}`)
            }).catch((error) => {
                this.logger.error(error)
            })
        }
        return ""
    }

}
