import {Logger} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
const TwitterAdsAPI = require('twitter-ads');

export class TwitterService {
    private readonly logger = new Logger(TwitterService.name);
    private client = new TwitterAdsAPI({
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        access_token: process.env.TWITTER_ACCESS_TOKEN,
        access_token_secret: process.env.TWITTER_ACCESS_SECRET,
        sandbox: process.env.TWITTER_SANDBOX,
        api_version: process.env.TWITTER_API_VERSION
    })

    constructor(
        private prisma: PrismaService
    ) {
        this._init()
    }

    private async _init() {
        this.client.get('accounts/:account_id', {account_id: 'xxx'}, function (error, resp, body) {
            if (error) {
                return console.error(error)
            }
        })
    }

}
