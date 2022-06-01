import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TelegramGroupService } from './telegram-group.service';

@Module({
  imports: [PrismaModule],
  providers: [TelegramGroupService]
})
export class TelegramGroupModule {}
