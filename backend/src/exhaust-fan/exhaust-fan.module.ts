import { Module } from '@nestjs/common';
import { ExhaustFanService } from './exhaust-fan.service';

@Module({
  providers: [ExhaustFanService],
  exports: [ExhaustFanService],
})
export class ExhaustFanModule {}
