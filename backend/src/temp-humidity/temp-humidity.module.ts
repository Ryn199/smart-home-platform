import { forwardRef, Module } from '@nestjs/common';
import { TempHumidityService } from './temp-humidity.service';
import { TempHumidityController } from './temp-humidity.controller';
import { DevicesModule } from '../devices/devices.module';
import { AutomationModule } from '../automation/automation.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => DevicesModule),
    forwardRef(() => AutomationModule),
    WebsocketModule,
  ],
  controllers: [TempHumidityController],
  providers: [TempHumidityService],
  exports: [TempHumidityService],
})
export class TempHumidityModule {}
