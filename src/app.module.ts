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

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EmailModule,
    TelegramGroupModule,
    TwitterModule,
    PrismaModule,
    DiscordModule
  ],
  controllers: [AppController, TwitterController],
  providers: [AppService],
})
export class AppModule {}
