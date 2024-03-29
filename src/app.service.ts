import {Injectable, Logger} from '@nestjs/common';
import xlsx from "node-xlsx";
import * as moment from "moment-timezone";
import * as fs from "fs";
import {Cron, CronExpression} from "@nestjs/schedule";
import {PrismaService} from "./prisma/prisma.service";
import {EmailService} from "./email/email.service";
import {TwitterService} from "./twitter-ads/twitter.service";
import { DiscordService } from './discord/discord.service';
import { TelegramGroupService } from './telegram-group/telegram-group.service';
import { EMAIL_REPORT_RECIPIENTS } from './constant/email_report_receipts';
import * as Sentry from '@sentry/node';
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
      private prisma: PrismaService,
      private emailService: EmailService,
      private twitter: TwitterService,
      private discordService: DiscordService,
      private telegramService: TelegramGroupService
  ) {
  }

  getHello(): string {
    return 'Hello World!';
  }

  // @Cron(CronExpression.EVERY_5_MINUTES)
  @Cron(CronExpression.EVERY_DAY_AT_10AM, {
    timeZone: 'Asia/Shanghai'
  })
  async sendReport() {
    const {
        twitterAccountSheet,
        tweetsSheets,
        telegramSheets,
        discordGuildSheets,
        discordGuildChannelsSheets,
        discordYesterdayHourStatSheets,
        discordGuildRolesSheets,
    } = await this.getReportData();

    let buffer = xlsx.build([
      twitterAccountSheet,
      tweetsSheets,
      telegramSheets,
      discordGuildSheets,
      discordYesterdayHourStatSheets,
      discordGuildChannelsSheets,
      discordGuildRolesSheets
    ])
    let filename = `TeleportChain-Analytics-${moment().format('YYYYMMDD')}.xlsx`
    fs.writeFile(filename, buffer, async err => {
      if (err) {
        console.error(err)
        Sentry.captureException(err);
        return
      }
      try {
        // send mail with defined transport object
        let info = await this.emailService.transporter.sendMail({
          from: `"Teleport Analytic Bot" <${process.env.MAIL_ACCOUNT}>`, // sender address
          to: EMAIL_REPORT_RECIPIENTS.join(', '), // list of receivers
          subject: "每日运营数据报告", // Subject line
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

  async getReportData() {
    let twitterAccountSheet = await this.twitter.exportAccountData()
    let tweetsSheets = await this.twitter.exportTweetData()
    let telegramSheets = await this.telegramService.exportDailyData();

    let discordGuildSheets = await this.discordService.exportGuildDailyData();
    let discordYesterdayHourStatSheets = await this.discordService.exportGuildYesterdayHourStats()
    let discordGuildChannelsSheets = await this.discordService.exportChannelsDailyData();
    let discordGuildRolesSheets = await this.discordService.exportRolesStat();

    return {
      twitterAccountSheet,
      tweetsSheets,
      telegramSheets,
      discordGuildSheets,
      discordGuildChannelsSheets,
      discordYesterdayHourStatSheets,
      discordGuildRolesSheets
    }
  }
}
