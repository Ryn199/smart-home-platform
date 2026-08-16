import { Module } from '@nestjs/common';
import { CustomSensorsService } from './custom-sensors.service';

@Module({
  providers: [CustomSensorsService],
  exports: [CustomSensorsService],
})
export class CustomSensorsModule {}
