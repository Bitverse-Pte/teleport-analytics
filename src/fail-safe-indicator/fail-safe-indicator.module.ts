import { Module } from '@nestjs/common';
import { FailSafeIndicatorService } from './fail-safe-indicator.service';

@Module({
  providers: [FailSafeIndicatorService],
  exports: [FailSafeIndicatorService]
})
export class FailSafeIndicatorModule {}
