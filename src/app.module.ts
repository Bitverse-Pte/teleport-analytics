import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmailModule } from './email/email.module';
import { TelegramGroupModule } from './telegram-group/telegram-group.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EmailModule,
    TelegramGroupModule,
    PrismaModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
