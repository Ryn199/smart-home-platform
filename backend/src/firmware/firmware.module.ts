import { Module, forwardRef } from '@nestjs/common';
import { FirmwareController } from './firmware.controller';
import { FirmwareService } from './firmware.service';
import { DatabaseModule } from '../database/database.module';
import { DevicesModule } from '../devices/devices.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => DevicesModule),
    WebsocketModule,
  ],
  controllers: [FirmwareController],
  providers: [FirmwareService],
  exports: [FirmwareService],
})
export class FirmwareModule {}
