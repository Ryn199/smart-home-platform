import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttRouterService } from './mqtt-router.service';
import { DevicesModule } from '../devices/devices.module';
import { TempHumidityModule } from '../temp-humidity/temp-humidity.module';
import { SmartDoorModule } from '../smart-door/smart-door.module';
import { SmartCurtainModule } from '../smart-curtain/smart-curtain.module';
import { ExhaustFanModule } from '../exhaust-fan/exhaust-fan.module';

@Global()
@Module({
  imports: [
    DevicesModule,
    TempHumidityModule,
    SmartDoorModule,
    SmartCurtainModule,
    ExhaustFanModule,
  ],
  providers: [MqttService, MqttRouterService],
  exports: [MqttService, MqttRouterService],
})
export class MqttModule {}
