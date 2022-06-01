import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { EmailModule } from './email/email.module';
import { TelegramGroupModule } from './telegram-group/telegram-group.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EmailModule,
    TelegramGroupModule
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
