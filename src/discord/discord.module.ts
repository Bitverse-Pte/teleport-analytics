import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DiscordService } from './discord.service';

@Module({
  imports: [PrismaModule],
  providers: [DiscordService]
})
export class DiscordModule {}
