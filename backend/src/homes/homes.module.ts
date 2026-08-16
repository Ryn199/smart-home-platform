import { Module } from '@nestjs/common';
import { HomesService } from './homes.service';
import { HomesController } from './homes.controller';

@Module({
  controllers: [HomesController],
  providers: [HomesService],
  exports: [HomesService],
})
export class HomesModule {}
