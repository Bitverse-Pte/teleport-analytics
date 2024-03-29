import { Module } from '@nestjs/common';
import { EmailModule } from 'src/email/email.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TelegramGroupService } from './telegram-group.service';
import { TelegramGroupController } from './telegram-group.controller';
import { UptimeModule } from 'src/uptime/uptime.module';
import { FailSafeIndicatorModule } from 'src/fail-safe-indicator/fail-safe-indicator.module';

@Module({
  imports: [PrismaModule, EmailModule, UptimeModule, FailSafeIndicatorModule],
  providers: [TelegramGroupService],
  exports: [TelegramGroupService],
  controllers: [TelegramGroupController]
})
export class TelegramGroupModule {}
