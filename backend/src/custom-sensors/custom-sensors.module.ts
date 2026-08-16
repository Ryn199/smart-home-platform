import { forwardRef, Module } from '@nestjs/common';
import { CustomSensorsService } from './custom-sensors.service';
import { CustomSensorsController } from './custom-sensors.controller';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [forwardRef(() => DevicesModule)],
  controllers: [CustomSensorsController],
  providers: [CustomSensorsService],
  exports: [CustomSensorsService],
})
export class CustomSensorsModule {}
