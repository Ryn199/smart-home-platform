import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { CustomSensorsService, SensorReadingsResponse } from './custom-sensors.service';
import { GetReadingsQueryDto } from './dto/get-readings-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Sensor } from '@prisma/client';

@Controller()
@UseGuards(JwtAuthGuard)
export class CustomSensorsController {
  constructor(private readonly customSensorsService: CustomSensorsService) {}

  @Get('devices/:deviceId/sensors')
  async getSensorsByDeviceId(@Param('deviceId', ParseIntPipe) deviceId: number): Promise<Sensor[]> {
    return this.customSensorsService.getSensorsByDeviceId(deviceId);
  }

  @Get('sensors/:sensorId')
  async getSensorById(@Param('sensorId', ParseIntPipe) sensorId: number): Promise<Sensor> {
    return this.customSensorsService.getSensorById(sensorId);
  }

  @Get('sensors/:sensorId/readings')
  async getSensorReadings(
    @Param('sensorId', ParseIntPipe) sensorId: number,
    @Query() query: GetReadingsQueryDto,
  ): Promise<SensorReadingsResponse> {
    return this.customSensorsService.getSensorReadings(sensorId, query);
  }
}
