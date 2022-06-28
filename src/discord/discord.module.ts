import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DiscordService } from './discord.service';
import { DiscordController } from './discord.controller';
import { FailSafeIndicatorModule } from 'src/fail-safe-indicator/fail-safe-indicator.module';

@Module({
  imports: [PrismaModule, FailSafeIndicatorModule],
  providers: [DiscordService],
  exports: [DiscordService],
  controllers: [DiscordController]
})
export class DiscordModule {}
