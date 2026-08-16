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
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Device, DeviceType } from '@prisma/client';

@Controller()
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('devices')
  async create(@Body() dto: CreateDeviceDto): Promise<Device> {
    return this.devicesService.create(dto);
  }

  @Get('devices')
  async findAll(
    @Query('roomId') roomId?: string,
    @Query('deviceType') deviceType?: DeviceType,
  ): Promise<Device[]> {
    return this.devicesService.findAll({
      roomId: roomId ? parseInt(roomId, 10) : undefined,
      deviceType,
    });
  }

  @Get('devices/:id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Device> {
    return this.devicesService.findOne(id);
  }

  @Patch('devices/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeviceDto,
  ): Promise<Device> {
    return this.devicesService.update(id, dto);
  }

  @Delete('devices/:id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; id: number }> {
    return this.devicesService.remove(id);
  }

  @Get('rooms/:roomId/devices')
  async findByRoomId(@Param('roomId', ParseIntPipe) roomId: number): Promise<Device[]> {
    return this.devicesService.findByRoomId(roomId);
  }
}
