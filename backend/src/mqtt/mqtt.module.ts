import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttRouterService } from './mqtt-router.service';
import { DevicesModule } from '../devices/devices.module';
import { CustomSensorsModule } from '../custom-sensors/custom-sensors.module';
import { SmartDoorModule } from '../smart-door/smart-door.module';
import { SmartCurtainModule } from '../smart-curtain/smart-curtain.module';
import { ExhaustFanModule } from '../exhaust-fan/exhaust-fan.module';

@Global()
@Module({
  imports: [
    DevicesModule,
    CustomSensorsModule,
    SmartDoorModule,
    SmartCurtainModule,
    ExhaustFanModule,
  ],
  providers: [MqttService, MqttRouterService],
  exports: [MqttService, MqttRouterService],
})
export class MqttModule {}
