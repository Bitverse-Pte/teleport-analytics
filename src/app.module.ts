import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmailModule } from './email/email.module';
import { TelegramGroupModule } from './telegram-group/telegram-group.module';
import { TwitterModule } from './twitter-ads/twitter.module';
import { PrismaModule } from './prisma/prisma.module';
import { DiscordModule } from './discord/discord.module';
import { TwitterController } from './twitter/twitter.controller';
import { SentryModule } from './sentry/sentry.module';
import { UptimeModule } from './uptime/uptime.module';
import { FailSafeIndicatorModule } from './fail-safe-indicator/fail-safe-indicator.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SentryModule.forRoot({
      dsn: 'https://85896bf421aa4c2c90416f113812daeb@o1290716.ingest.sentry.io/6511932',
      tracesSampleRate: 1.0,
      debug: true,
    }),
    EmailModule,
    TelegramGroupModule,
    TwitterModule,
    PrismaModule,
    DiscordModule,
    UptimeModule,
    FailSafeIndicatorModule,
  ],
  controllers: [AppController, TwitterController],
  providers: [AppService],
})
export class AppModule {}
