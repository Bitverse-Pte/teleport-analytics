import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DiscordService } from './discord.service';
import { DiscordController } from './discord.controller';

@Module({
  imports: [PrismaModule],
  providers: [DiscordService],
  exports: [DiscordService],
  controllers: [DiscordController]
})
export class DiscordModule {}
