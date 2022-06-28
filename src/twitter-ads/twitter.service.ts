import {Injectable, Logger} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {Cron, CronExpression} from "@nestjs/schedule";
import {auth, Client} from "twitter-api-sdk";
import {OAuth2User} from "twitter-api-sdk/dist/OAuth2User";
import {components} from "twitter-api-sdk/dist/gen/openapi-types";
import * as moment from 'moment-timezone'
import {EmailService} from "../email/email.service";
import {WorkSheet} from "node-xlsx";
import * as Sentry from '@sentry/node';
import {getYesterday} from "../utils/date";

require('dotenv').config();

const publicClient = new Client(process.env.TWITTER_BEARER_TOKEN)

@Injectable()
export class TwitterService {
    private readonly logger = new Logger(TwitterService.name);

    constructor(
        private prisma: PrismaService,
    ) {
        this._init()
    }
    private async _init() {}

    /**
     * request account information every 30 minutes,
     * record a real time record and update the Twitter account information
     * @private
     */
    @Cron(CronExpression.EVERY_30_MINUTES)
    private async syncAccountData() {
        this.logger.verbose('start sync account data')
        let accounts = await this.prisma.twitterAccount.findMany()
        let ids = accounts.map(one => one.accountId)
        if (ids.length === 0) {
            return
        }
        await publicClient.users.findUsersById({
            "ids": ids,
            "user.fields": ["public_metrics"]
        }).then(async (resp) => {
            for (const item of resp.data) {
                this.logger.debug(`get twitter account info ${item.name}`)
                await this.updateTwitterAccountData(item)
                await this.insertTwitterAccountRealTimeData(item)
            }
        }).catch((error) => {
            console.error(error.msg)
            Sentry.captureException(error);
        })
        this.logger.verbose('syncAccountData::finished');
    }

    /**
     * generate a daily log for Twitter accounts
     * @private
     */
    @Cron(CronExpression.EVERY_DAY_AT_8AM, {
        timeZone: 'Asia/Shanghai'
    })
    private async logTwitterDailyStat() {
        this.logger.verbose('start log daily info')
        const accounts = await this.prisma.twitterAccount.findMany()
        const ids = [];
        for await (const account of accounts) {
            ids.push(account.accountId)
        }
        await publicClient.users.findUsersById({
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
                let newFollowers = 0
                let newPosts = 0
                if (record) {
                    newFollowers = item.public_metrics.followers_count - record.followersCount
                }
                await this.prisma.twitterAccountDailyStat.create({
                    data: {
                        twitterAccountId: item.id,
                        followersCount: item.public_metrics.followers_count,
                        tweetCount: item.public_metrics.tweet_count,
                        newFollowersCount: newFollowers,
                        newTweetCount: newPosts,
                    }
                }).then(() => {
                }).catch((error) => {
                    this.logger.error(error)
                    Sentry.captureException(error);
                })
            }
        }).catch((error) => {
            this.logger.error(error)
            Sentry.captureException(error);
        });
        this.logger.verbose('logTwitterDailyStat::exectued');
    }

    /**
     * scanTweetList sync every account for the latest 1 month tweets information
     * @private
     */
    @Cron(`30 */30 * * * *`)
    async scanTweetList() {
        const startTime = moment(new Date()).subtract(1, 'months').toISOString()
        this.logger.verbose(`start scan new tweet since ${startTime}`)
        const accounts = await this.prisma.twitterAccount.findMany()
        for (const account of accounts) {
            await this.getAccountAuthClient(
                account.accountId,
                account.accessToken,
                account.refreshToken,
                account.expiresAt,
            ).then(async (authClient) => {
                let client = new Client(authClient)
                try {
                    let tweets: components["schemas"]["Tweet"][] = []
                    let hasNextPage = true
                    let nextToken = null
                    while (hasNextPage) {
                        let resp = await client.tweets.usersIdTweets(account.accountId, {
                            max_results: 100,
                            exclude: ["replies", "retweets"],
                            "tweet.fields": ["public_metrics", "non_public_metrics", "created_at"],
                            pagination_token: nextToken ? nextToken : "",
                            start_time: startTime,
                        })
                        if (resp && resp.meta && resp.meta.result_count && resp.meta.result_count > 0) {
                            if (resp.data) {
                                tweets.push.apply(tweets, resp.data)
                            }
                            if (resp.meta.next_token) {
                                nextToken = resp.meta.next_token
                            } else {
                                hasNextPage = false
                            }
                        } else {
                            hasNextPage = false
                        }
                    }

                    this.logger.debug(`get ${tweets.length} tweet info`)
                    const multiUpdate = tweets.map((tweet) => {
                        return this.prisma.tweet.upsert({
                            where: {
                                tweetId: tweet.id,
                            },
                            update: {
                                impressions: tweet.non_public_metrics.impression_count,
                                urlLinkClicks: 0, // item.non_public_metrics.url_link_clicks,
                                userProfileClicks: 0, // item.non_public_metrics.user_profile_clicks,
                                retweets: tweet.public_metrics.retweet_count,
                                quoteTweets: tweet.public_metrics.quote_count,
                                likes: tweet.public_metrics.like_count,
                                replies: tweet.public_metrics.reply_count,
                                videoViews: 0,
                            },
                            create: {
                                tweetId: tweet.id,
                                createdAt: new Date(tweet.created_at),
                                twitterAccountId: account.accountId,
                                text: tweet.text.length > 100 ? tweet.text.substring(0, 100) : tweet.text,
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
                    })
                    await this.prisma.$transaction(multiUpdate).then().catch((error) => {
                        Sentry.captureException(error)
                        this.logger.error(error)
                    })
                    // Insert realtime tweet records
                    const multiInsert = tweets.map((tweet, idx) => {
                        return {
                            tweetId: tweet.id,
                            impressions: tweet.non_public_metrics.impression_count,
                            urlLinkClicks: 0,// tweet.non_public_metrics.url_link_clicks,
                            userProfileClicks: 0,// tweet.non_public_metrics.user_profile_clicks,
                            retweets: tweet.public_metrics.retweet_count,
                            quoteTweets: tweet.public_metrics.quote_count,
                            likes: tweet.public_metrics.like_count,
                            replies: tweet.public_metrics.reply_count,
                            videoViews: 0,
                        };
                    })
                    await this.prisma.tweetRealTimeStat.createMany({
                        data: multiInsert,
                        skipDuplicates: true,
                    }).then().catch((error) => {
                        Sentry.captureException(error)
                        this.logger.error(error)
                    })
                } catch (error) {
                    Sentry.captureException(error);
                    this.logger.error(error.toString())
                }
            }).catch((error) => {
                this.logger.error(error)
            })
        }
        this.logger.verbose('scanTweetList::finished');
    }

    /**
     * Fail safe protocol
     */
    private islogTweetsDailyStatExecuted = false;
    @Cron(`12 08 * * *`)
    private async _logTweetsDailyStatFailSafe() {
        /** ignore if it was executed already */
        if (this.islogTweetsDailyStatExecuted) {
            // resetting indicator
            this.islogTweetsDailyStatExecuted = false;
            return;
        }
        ;
        /** Otherwise run this incase of ungraceful reboot */
        await this.logTweetsDailyStat();
    }


    /**
     * logTweetsDailyStat sync every account for the daily tweet summary
     * @private
     */
    @Cron(CronExpression.EVERY_DAY_AT_8AM, {
        timeZone: 'Asia/Shanghai'
    })
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
        for (const account of accounts) {
            const clientWithAuth = new Client(await this.getAccountAuthClient(
                account.accountId,
                account.accessToken,
                account.refreshToken,
                account.expiresAt,
            ))
            try {
                const startTime = moment(new Date()).subtract(1, 'months').toISOString()
                let hasNextPage = true
                let nextToken = null
                while (hasNextPage) {
                    let resp = await clientWithAuth.tweets.usersIdTweets(account.accountId, {
                        max_results: 100,
                        "tweet.fields": ["public_metrics", "non_public_metrics", "created_at"],
                        "media.fields": ["public_metrics"],
                        exclude: ["replies", "retweets"],
                        pagination_token: nextToken ? nextToken : "",
                        start_time: startTime,
                    })
                    if (resp && resp.meta && resp.meta.result_count && resp.meta.result_count > 0) {
                        console.log(resp)
                        if (resp.meta.next_token) {
                            nextToken = resp.meta.next_token
                        }else {
                            hasNextPage = false
                        }
                        tweetsCount += resp.data.length
                        for (const one of resp.data) {
                            impressions += one.non_public_metrics.impression_count
                            retweets += one.public_metrics.retweet_count
                            quoteTweets += one.public_metrics.quote_count
                            likes += one.public_metrics.like_count
                            replies += one.public_metrics.reply_count
                        }
                    }else {
                        hasNextPage = false
                    }
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
                })
            } catch (error) {
                Sentry.captureException(error);
                console.error(error)
            }
        }
        this.logger.verbose('logTweetsDailyStat::executed')
        this.islogTweetsDailyStatExecuted = true;
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
            Sentry.captureException(error);
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
            Sentry.captureException(error);
            this.logger.error(error)
        })
    }

    private async getAccountAuthClient(accountId: string, accessToken: string, refreshToken: string, expiredAt: Date): Promise<OAuth2User> {
        return new Promise(async (resolve, reject) => {
            let authClient = new auth.OAuth2User({
                client_id: process.env.TWITTER_CLIENT_ID,
                client_secret: process.env.TWITTER_CLIENT_SECRET,
                callback: `${process.env.TWITTER_CALLBACK_URL}/twitter/callback`,
                scopes: ["tweet.read", "users.read", "offline.access"],
            })
            authClient.token = {
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: expiredAt,
            }
            if (expiredAt <= new Date(Date.now())) {
                this.logger.verbose('access token expired, refresh new one')
                await authClient.refreshAccessToken().then(async (resp) => {
                    await this.prisma.twitterAccount.update({
                        where: {
                            accountId: accountId,
                        },
                        data: {
                            accessToken: resp.token.access_token,
                            refreshToken: resp.token.refresh_token,
                            expiresAt: resp.token.expires_at,
                        },
                    }).then((resp) => {
                        this.logger.verbose('get new token')
                        resolve(authClient)
                    }).catch((error) => {
                        console.error("=====>", error)
                        reject(error)
                    })
                }).catch((error) => {
                    console.error("======>", error)
                    reject(error)
                })
            }
            resolve(authClient)
        })
    }

    public async exportAccountData(): Promise<WorkSheet> {
        let data: unknown[][] = [
            ["Account", "Date", "Tweets", "New Tweets", "Followers", "New Followers"]
        ]

        const records = await this.prisma.twitterAccountDailyStat.findMany({
            where: {
                date: {
                    gte: getYesterday()
                }
            }
        })
        const accounts = await this.prisma.twitterAccount.findMany()
        let accountDic: {[id: string]:string} = {}
        for (const account of accounts) {
            accountDic[account.accountId] = account.name
        }
        for (const record of records) {
            data.push([
                accountDic[record.twitterAccountId],
                record.date,
                record.tweetCount,
                record.newTweetCount,
                record.followersCount,
                record.newFollowersCount,
            ])
        }

        return {
            name: "Twitter Account",
            data: data,
            options: {},
        }
    }

    public async exportTweetData(): Promise<WorkSheet> {
        let data: unknown[][] = [
            ["Date", "Tweet ID", "Content", "Impressions", "Retweets", "Quote Tweets", "Likes", "Replies", "User Profile Clicks", "Url Link Clicks"],
        ]
        const records = await this.prisma.tweet.findMany({
            orderBy: {
                createdAt: "desc",
            }
        })
        let tweetsCount = records.length
        let impressions = 0
        let retweets = 0
        let quoteTweets = 0
        let likes = 0
        let replies = 0
        let urlLinkClicks = 0
        let userProfileClicks = 0
        let videoViews = 0
        for (const record of records) {
            impressions+=record.impressions
            retweets+=record.retweets
            quoteTweets+=record.quoteTweets
            likes+=record.likes
            replies+=record.replies
            urlLinkClicks+=record.urlLinkClicks
            userProfileClicks+=record.userProfileClicks
            data.push([
                record.createdAt,
                record.tweetId,
                record.text,
                record.impressions,
                record.retweets,
                record.quoteTweets,
                record.likes,
                record.replies,
                record.userProfileClicks,
                record.urlLinkClicks,
            ])
        }
        data.push([
            "In Total",
            ` ${tweetsCount} tweets`,
            "",
            impressions,
            retweets,
            quoteTweets,
            likes,
            replies,
            userProfileClicks,
            urlLinkClicks,
        ])

        return {
            name: "Tweets",
            data: data,
            options: {},
        }
    }
}
