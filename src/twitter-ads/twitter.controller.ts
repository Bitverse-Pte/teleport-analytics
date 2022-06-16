import {Controller, Get, HttpStatus, Query, Res} from "@nestjs/common";
import { TwitterService } from "./twitter.service";
import { Response } from "express";
import {auth, Client} from "twitter-api-sdk";
import {PrismaService} from "../prisma/prisma.service";

require('dotenv').config();

const authClient = new auth.OAuth2User({
    client_id: process.env.TWITTER_CLIENT_ID,
    client_secret: process.env.TWITTER_CLIENT_SECRET,
    callback: `${process.env.TWITTER_CALLBACK_URL}/twitter/callback`,
    scopes: ["tweet.read", "users.read", "offline.access"],
})
const client = new Client(process.env.TWITTER_BEARER_TOKEN)

@Controller('/twitter')
export class TwitterController {
    constructor(private readonly twitterService: TwitterService, private prisma: PrismaService) {}

    @Get('/login')
    async login(@Query() query, @Res() res: Response) {
        if (!query.username) {
            res.status(HttpStatus.BAD_REQUEST).send('need username')
            return
        }
        const authUrl = authClient.generateAuthURL({
            state: query.username,
            code_challenge: "challenge",
            code_challenge_method: "plain",
        })
        res.redirect(authUrl)
    }

    @Get('callback')
    async callback(@Query() query, @Res() res: Response) {
        let username = query.state
        await authClient.requestAccessToken(query.code).then(async (resp) => {
            let account = await this.prisma.twitterAccount.findFirst({
                where: {
                    username: username
                }
            })
            if (account) {
                await this.prisma.twitterAccount.update({
                    where: {
                        accountId: account.accountId,
                    },
                    data: {
                        accessToken: resp.token.access_token,
                        refreshToken: resp.token.refresh_token,
                        expiresAt: resp.token.expires_at,
                    },
                }).catch((error) => {
                    console.log(error)
                })
                return res.status(HttpStatus.OK).send('Update twitter account success')
            }else {
                const accountInfo = await client.users.findUserByUsername(
                    username,
                    {
                        "user.fields": ["public_metrics"]
                    }
                )
                await this.prisma.twitterAccount.create({
                    data: {
                        name: accountInfo.data.name,
                        username: accountInfo.data.username,
                        accountId: accountInfo.data.id,
                        accessToken: resp.token.access_token,
                        refreshToken: resp.token.refresh_token,
                        expiresAt: resp.token.expires_at,
                        followersCount: 0,
                        tweetCount: 0,
                    }
                }).catch((error) => {
                    console.error(error)
                })
                return res.status(HttpStatus.OK).send('Create twitter account success')
            }
        }).catch((error) => {
            return res.status(HttpStatus.BAD_REQUEST).send(error.toString())
        })

        return res.status(HttpStatus.OK).send()
    }
}
