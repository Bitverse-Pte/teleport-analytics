import { Module } from '@nestjs/common';
import { TelegramGroupService } from './telegram-group.service';

@Module({
  providers: [TelegramGroupService]
})
export class TelegramGroupModule {}
