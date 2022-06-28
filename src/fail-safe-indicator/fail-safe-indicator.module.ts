import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FailSafeIndicatorService } from './fail-safe-indicator.service';

@Module({
  imports: [PrismaModule],
  providers: [FailSafeIndicatorService],
  exports: [FailSafeIndicatorService]
})
export class FailSafeIndicatorModule {}
