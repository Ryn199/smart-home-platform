import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CustomSensorsService, SensorReadingsResponse } from './custom-sensors.service';
import { GetReadingsQueryDto } from './dto/get-readings-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Sensor } from '@prisma/client';

@ApiTags('Sensors')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(JwtAuthGuard)
export class CustomSensorsController {
  constructor(private readonly customSensorsService: CustomSensorsService) {}

  @Get('devices/:deviceId/sensors')
  @ApiOperation({ summary: 'List all custom sensors for a device with latest readings' })
  @ApiResponse({ status: 200, description: 'List of sensors' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async getSensorsByDeviceId(@Param('deviceId', ParseIntPipe) deviceId: number): Promise<Sensor[]> {
    return this.customSensorsService.getSensorsByDeviceId(deviceId);
  }

  @Get('sensors/:sensorId')
  @ApiOperation({ summary: 'Get sensor details by ID' })
  @ApiResponse({ status: 200, description: 'Sensor details' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async getSensorById(@Param('sensorId', ParseIntPipe) sensorId: number): Promise<Sensor> {
    return this.customSensorsService.getSensorById(sensorId);
  }

  @Get('sensors/:sensorId/readings')
  @ApiOperation({
    summary: 'Query historical sensor telemetry readings with time filtering and limit',
  })
  @ApiResponse({ status: 200, description: 'Historical readings' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async getSensorReadings(
    @Param('sensorId', ParseIntPipe) sensorId: number,
    @Query() query: GetReadingsQueryDto,
  ): Promise<SensorReadingsResponse> {
    return this.customSensorsService.getSensorReadings(sensorId, query);
  }
}
