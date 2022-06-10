import {Injectable, Logger} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {Cron, CronExpression} from "@nestjs/schedule";
import {auth, Client} from "twitter-api-sdk";
import {OAuth2User} from "twitter-api-sdk/dist/OAuth2User";
import {components} from "twitter-api-sdk/dist/gen/openapi-types";
import * as moment from 'moment-timezone'

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
        await this.logTweetsDailyStat()
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    private async syncAccountData() {
        this.logger.debug('start sync account data')
        let accounts = await this.prisma.twitterAccount.findMany();
        let ids = [];
        for await (const account of accounts) {
            ids.push(account.accountId)
        }
        await client.users.findUsersById({
            "ids": ids,
            "user.fields": ["public_metrics"]
        }).then(async (resp) => {
            for (const item of resp.data) {
                await this.updateTwitterAccountData(item)
                await this.insertTwitterAccountRealTimeData(item)
            }
        }).catch((error) => {
            this.logger.error(error)
        })
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    private async logTwitterDailyStat() {
        this.logger.debug('start log daily info')
        const accounts = await this.prisma.twitterAccount.findMany()
        const ids = [];
        for await (const account of accounts) {
            ids.push(account.accountId)
        }
        await client.users.findUsersById({
            "ids": ids,
            "user.fields": ["public_metrics"]
        }).then(async (resp) => {
            for (const item of resp.data) {
                let record = await this.prisma.twitterAccountDailyStat.findFirst({
                    where: {
                        twitterAccountId: item.id,
                    },
                    orderBy: [
                        {
                            date: "desc",
                        }
                    ],
                })
                if (record) {
                    await this.prisma.twitterAccountDailyStat.create({
                        data: {
                            twitterAccountId: item.id,
                            followersCount: item.public_metrics.followers_count,
                            tweetCount: item.public_metrics.tweet_count,
                            newFollowersCount: item.public_metrics.followers_count - record.followersCount,
                        }
                    }).then(() => {
                    }).catch((error) => {
                        this.logger.error(error)
                    })
                }else {
                    await this.prisma.twitterAccountDailyStat.create({
                        data: {
                            twitterAccountId: item.id,
                            followersCount: item.public_metrics.followers_count,
                            tweetCount: item.public_metrics.tweet_count,
                            newFollowersCount: 0,
                        }
                    }).then(() => {
                    }).catch((error) => {
                        this.logger.error(error)
                    })
                }
            }
        }).catch((error) => {
            this.logger.error(error)
        })
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async scanTweetList() {
        this.logger.debug('start scan new tweet')
        const accounts = await this.prisma.twitterAccount.findMany()
        for await (const account of accounts) {
            const clientWithAuth = new Client(this.getAccountAuthClient(account.accessToken, account.refreshToken, account.expiresAt))
            try {
                let resp = await clientWithAuth.tweets.usersIdTweets(account.accountId, {
                    max_results: 100,
                    exclude: ["replies", "retweets"],
                    "tweet.fields": ["public_metrics", "non_public_metrics", "created_at"],
                })
                for await (const tweet of resp.data) {
                    await this.insertOrUpdateTweetData(account.accountId, tweet)
                    await this.insertTweetRealTimeData(tweet)
                }
            } catch (error) {
                console.error(error)
                this.logger.error(error.toString())
            }
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async logTweetsDailyStat() {
        this.logger.debug('start daily tweets log')
        const accounts = await this.prisma.twitterAccount.findMany()
        let tweetsCount = 0
        let impressions = 0
        let retweets = 0
        let quoteTweets = 0
        let likes = 0
        let replies = 0
        let urlLinkClicks = 0
        let userProfileClicks = 0
        let videoViews = 0
        for await  (const account of accounts) {
            const clientWithAuth = new Client(this.getAccountAuthClient(account.accessToken, account.refreshToken, account.expiresAt))
            try {
                let resp = await clientWithAuth.tweets.usersIdTweets(account.accountId, {
                    max_results: 100,
                    "tweet.fields": ["public_metrics", "non_public_metrics", "created_at"],
                    exclude: ["replies", "retweets"],
                    start_time: moment().startOf('day').toISOString(),
                })
                console.log(resp)
                tweetsCount += resp.data.length
                for (const one of resp.data) {
                    impressions += one.non_public_metrics.impression_count
                    retweets += one.public_metrics.retweet_count
                    quoteTweets += one.public_metrics.quote_count
                    likes += one.public_metrics.like_count
                    replies += one.public_metrics.reply_count
                }
                await this.prisma.tweetsDailyStat.create({
                    data: {
                        tweetsCount: tweetsCount,
                        impressions: impressions,
                        urlLinkClicks: urlLinkClicks,
                        userProfileClicks: userProfileClicks,
                        retweets: retweets,
                        quoteTweets: quoteTweets,
                        likes: likes,
                        videoViews: videoViews,
                        replies: replies,
                    }
                }).then((resp) => {
                }).catch((error) => {
                    this.logger.error(error)
                })
            }catch (error) {
                console.error(error)
            }
        }
    }

    private async updateTwitterAccountData(twitter: components["schemas"]["User"]) {
        await this.prisma.twitterAccount.update({
            where: {
                accountId: twitter.id,
            },
            data: {
                followersCount: twitter.public_metrics.followers_count,
                tweetCount: twitter.public_metrics.tweet_count,
            },
        }).then(() => {

        }).catch((error) => {
            console.error(error)
        })
    }

    private async insertTwitterAccountRealTimeData(twitter: components["schemas"]["User"]) {
        await this.prisma.twitterAccountRealTimeStat.create({
            data: {
                twitterAccountId: twitter.id,
                followersCount: twitter.public_metrics.followers_count,
                followingCount: twitter.public_metrics.following_count,
                tweetCount: twitter.public_metrics.tweet_count,
                listedCount: twitter.public_metrics.listed_count,
            }
        }).then((resp) => {
        }).catch((error) => {
            this.logger.error(error)
        })
    }

    private async insertOrUpdateTweetData(accountId: string, tweet: components["schemas"]["Tweet"]) {
        let record = await this.prisma.tweet.findFirst({
            where: {
                tweetId: tweet.id,
            }
        })
        if (record) {
            await this.prisma.tweet.update({
                where: {
                    tweetId: tweet.id,
                },
                data: {
                    impressions: tweet.non_public_metrics.impression_count,
                    urlLinkClicks: 0, // item.non_public_metrics.url_link_clicks,
                    userProfileClicks: 0, // item.non_public_metrics.user_profile_clicks,
                    retweets: tweet.public_metrics.retweet_count,
                    quoteTweets: tweet.public_metrics.quote_count,
                    likes: tweet.public_metrics.like_count,
                    replies: tweet.public_metrics.reply_count,
                    videoViews: 0,
                }
            })
        }else {
            await this.prisma.tweet.create({
                data: {
                    tweetId: tweet.id,
                    createdAt: new Date(tweet.created_at),
                    twitterAccountId: accountId,
                    text: tweet.text,
                    impressions: tweet.non_public_metrics.impression_count,
                    urlLinkClicks: 0, // item.non_public_metrics.url_link_clicks,
                    userProfileClicks: 0, // item.non_public_metrics.user_profile_clicks,
                    retweets: tweet.public_metrics.retweet_count,
                    quoteTweets: tweet.public_metrics.quote_count,
                    likes: tweet.public_metrics.like_count,
                    replies: tweet.public_metrics.reply_count,
                    videoViews: 0,
                },
            }).then((resp) => {}).catch((error) => {})
        }
    }

    async insertTweetRealTimeData(tweet: components["schemas"]["Tweet"]) {
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
