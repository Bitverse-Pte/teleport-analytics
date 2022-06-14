import { Module } from '@nestjs/common';
import { EmailModule } from 'src/email/email.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TelegramGroupService } from './telegram-group.service';

@Module({
  imports: [PrismaModule, EmailModule],
  providers: [TelegramGroupService],
  exports: [TelegramGroupService]
})
export class TelegramGroupModule {}
