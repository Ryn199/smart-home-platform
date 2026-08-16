import { forwardRef, Module } from '@nestjs/common';
import { TempHumidityService } from './temp-humidity.service';
import { DevicesModule } from '../devices/devices.module';
import { AutomationModule } from '../automation/automation.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    forwardRef(() => DevicesModule),
    forwardRef(() => AutomationModule),
    WebsocketModule,
  ],
  providers: [TempHumidityService],
  exports: [TempHumidityService],
})
export class TempHumidityModule {}
