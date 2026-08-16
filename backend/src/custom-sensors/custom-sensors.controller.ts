import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CustomSensorsService, SensorReadingsResponse } from './custom-sensors.service';
import { GetReadingsQueryDto } from './dto/get-readings-query.dto';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Sensor } from '@prisma/client';

@ApiTags('Sensors')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(JwtAuthGuard)
export class CustomSensorsController {
  constructor(private readonly customSensorsService: CustomSensorsService) {}

  @Post('sensors')
  @ApiOperation({ summary: 'Register a new custom sensor for a device' })
  @ApiResponse({ status: 201, description: 'Sensor registered successfully' })
  async create(@Body() dto: CreateSensorDto): Promise<Sensor> {
    return this.customSensorsService.create(dto);
  }

  @Get('sensors')
  @ApiOperation({ summary: 'List all custom sensors across all devices' })
  @ApiResponse({ status: 200, description: 'List of all sensors' })
  async findAll(): Promise<Sensor[]> {
    return this.customSensorsService.findAll();
  }

  @Get('devices/:deviceId/sensors')
  @ApiOperation({ summary: 'List all custom sensors for a specific device' })
  @ApiResponse({ status: 200, description: 'List of sensors for device' })
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

  @Patch('sensors/:sensorId')
  @ApiOperation({ summary: 'Update sensor details' })
  @ApiResponse({ status: 200, description: 'Sensor updated successfully' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async update(
    @Param('sensorId', ParseIntPipe) sensorId: number,
    @Body() dto: UpdateSensorDto,
  ): Promise<Sensor> {
    return this.customSensorsService.update(sensorId, dto);
  }

  @Delete('sensors/:sensorId')
  @ApiOperation({ summary: 'Delete a sensor and its telemetry readings' })
  @ApiResponse({ status: 200, description: 'Sensor deleted successfully' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async remove(@Param('sensorId', ParseIntPipe) sensorId: number): Promise<{ message: string; id: number }> {
    return this.customSensorsService.remove(sensorId);
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
