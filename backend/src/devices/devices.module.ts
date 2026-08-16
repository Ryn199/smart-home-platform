import { forwardRef, Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { RoomsModule } from '../rooms/rooms.module';
import { SmartDoorModule } from '../smart-door/smart-door.module';
import { SmartCurtainModule } from '../smart-curtain/smart-curtain.module';
import { ExhaustFanModule } from '../exhaust-fan/exhaust-fan.module';

@Module({
  imports: [
    RoomsModule,
    forwardRef(() => SmartDoorModule),
    forwardRef(() => SmartCurtainModule),
    forwardRef(() => ExhaustFanModule),
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
