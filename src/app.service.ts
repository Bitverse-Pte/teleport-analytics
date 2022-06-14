import {Injectable, Logger} from '@nestjs/common';
import axios from 'axios';
import { CombotAnalyticResult } from './typing/Combot';
import xlsx from "node-xlsx";
import * as moment from "moment-timezone";
import fs from "fs";
import {Cron, CronExpression} from "@nestjs/schedule";
import {PrismaService} from "./prisma/prisma.service";
import {EmailService} from "./email/email.service";
import {TwitterService} from "./twitter-ads/twitter.service";

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
      private prisma: PrismaService,
      private emailService: EmailService,
      private twitter: TwitterService,
  ) {
  }

  getHello(): string {
    return 'Hello World!';
  }

  async getTelegramGroupStatFromCombot(groupId: string) {
    const response = await axios.get<CombotAnalyticResult>(`https://combot.org/c/${groupId}/a/json`, {
      headers: {
        Cookie: process.env.COMBOT_COOKIES_STR
      }
    });
    console.info('response', response);
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  private async sendReport() {
    let twitterAccountSheet = await this.twitter.exportAccountData()
    let tweetsSheets = await this.twitter.exportTweetData()
    let buffer = xlsx.build([
      twitterAccountSheet,
      tweetsSheets,
    ])
    let filename = `TeleportChain-Analytics-${moment().format('YYYYMMDD')}.xlsx`
    fs.writeFile(filename, buffer, async err => {
      if (err) {
        console.error(err)
        return
      }
      try {
        // send mail with defined transport object
        let info = await this.emailService.transporter.sendMail({
          from: `"Analytic Bot by Frank Wei👻" <${process.env.MAIL_ACCOUNT}>`, // sender address
          to: `${process.env.MAIL_ACCOUNT}`, // list of receivers
          subject: "Operating Platform Statistics", // Subject line
          attachments: [
            {
              filename: filename,
              path: filename,
            }
          ]
        });

        this.logger.log("Message sent: %s", info.messageId);
      } catch (error) {
        this.logger.error('sendAnalytic::error: ', error);
      }
    })
  }
}
