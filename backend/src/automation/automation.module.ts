import { forwardRef, Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { HomesModule } from '../homes/homes.module';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [HomesModule, forwardRef(() => DevicesModule)],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
