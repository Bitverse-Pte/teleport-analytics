import {Injectable, Logger} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {Cron, CronExpression} from "@nestjs/schedule";
import {auth, Client} from "twitter-api-sdk";
import {OAuth2User} from "twitter-api-sdk/dist/OAuth2User";
import {components} from "twitter-api-sdk/dist/gen/openapi-types";

const client = new Client(process.env.TWITTER_BEARER_TOKEN)

@Injectable()
export class TwitterService {
    private readonly logger = new Logger(TwitterService.name);

    constructor(
        private prisma: PrismaService
    ) {
        this._init()
    }

    private async _init() {
        await this.scanTweetList()
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
    async scanTweetList() {
        this.logger.debug('start scan new tweet')
        const accounts = await this.prisma.twitterAccount.findMany();
        for await (const account of accounts) {
            const clientWithAuth = new Client(this.getAccountAuthClient(account.accessToken, account.refreshToken, account.expiresAt))
            const resp = await clientWithAuth.tweets.usersIdTweets(account.accountId, {
                max_results: 100,
                "tweet.fields": ["public_metrics", "non_public_metrics"],
            })
            for (const tweet of resp.data) {
                await this.insertTweetData(account.id, tweet)
                await this.insertTweetRealTimeData(tweet)
            }
        }
    }

    private async insertTweetData(accountId: number, tweet: components["schemas"]["Tweet"]) {
        this.prisma.tweet.create({
            data: {
                tweetId: tweet.id,
                createdAt: tweet.created_at,
                twitterAccountId: accountId,
                text: tweet.text,
            }
        })
    }

    private async insertTweetRealTimeData(tweet: components["schemas"]["Tweet"]) {
        await this.prisma.tweetRealTimeStat.create({
            data: {
                tweetId: tweet.id,
                impressions: tweet.non_public_metrics.impression_count,
                urlLinkClicks: 0, // item.non_public_metrics.url_link_clicks,
                userProfileClicks: 0, // item.non_public_metrics.user_profile_clicks,
                retweets: tweet.public_metrics.retweet_count,
                quoteTweets: tweet.public_metrics.quote_count,
                likes: tweet.public_metrics.like_count,
                replies: tweet.public_metrics.reply_count,
                videoViews: 0,
            }
        }).then((resp) => {
        }).catch((error) => {
            this.logger.error(error)
        })
    }

    private getAccountAuthClient(accessToken: string, refreshToken: string, expiredAt: Date): OAuth2User {
        let authClient = new auth.OAuth2User({
            client_id: process.env.TWITTER_CLIENT_ID,
            client_secret: process.env.TWITTER_CLIENT_SECRET,
            callback: "http://127.0.0.1:3000/twitter/callback",
            scopes: ["tweet.read", "offline.access"],
        })
        authClient.token = {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiredAt,
        }
        return authClient
    }
}
