import { Module } from '@nestjs/common';
import { SmartCurtainService } from './smart-curtain.service';

@Module({
  providers: [SmartCurtainService],
  exports: [SmartCurtainService],
})
export class SmartCurtainModule {}
