import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
/** Load env from `.env` */
require('dotenv').config();

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: 465,
            secure: true, // true for 465, false for other ports
            auth: {
              user: process.env.MAIL_ACCOUNT,
              pass: process.env.MAIL_PASSWORD,
            },
          });
    }

    @Cron(CronExpression.EVERY_DAY_AT_8AM)
    async sendAnalytic() {
        this.logger.debug('sending email');

        try {
            // send mail with defined transport object
            let info = await this.transporter.sendMail({
                from: `"Analytic Bot by Frank Wei👻" <${process.env.MAIL_ACCOUNT}>`, // sender address
                to: `${process.env.MAIL_ACCOUNT}`, // list of receivers
                subject: "Test send email from server", // Subject line
                text: "Where is my attachment?", // plain text body
            });

            console.log("Message sent: %s", info.messageId);
        } catch (error) {
            this.logger.error('sendAnalytic::error: ', error);
        }
    }
}
