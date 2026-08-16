import { Module } from '@nestjs/common';
import { SmartDoorService } from './smart-door.service';

@Module({
  providers: [SmartDoorService],
  exports: [SmartDoorService],
})
export class SmartDoorModule {}
