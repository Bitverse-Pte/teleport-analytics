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

}
