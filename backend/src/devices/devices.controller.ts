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
import { DevicePresenceInfo, DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { ExecuteCommandDto } from './dto/execute-command.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Device, DeviceCommand, DeviceStatus, DeviceType } from '@prisma/client';

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
    @Query('status') status?: DeviceStatus,
  ): Promise<Device[]> {
    return this.devicesService.findAll({
      roomId: roomId ? parseInt(roomId, 10) : undefined,
      deviceType,
      status,
    });
  }

  @Get('devices/:id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Device> {
    return this.devicesService.findOne(id);
  }

  @Get('devices/:id/presence')
  async getPresence(@Param('id', ParseIntPipe) id: number): Promise<DevicePresenceInfo> {
    return this.devicesService.getPresence(id);
  }

  @Post('devices/:id/commands')
  async executeCommand(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExecuteCommandDto,
  ): Promise<DeviceCommand> {
    return this.devicesService.executeCommand(id, dto);
  }

  @Get('devices/:id/commands')
  async getCommands(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ): Promise<DeviceCommand[]> {
    return this.devicesService.getCommands(id, limit ? parseInt(limit, 10) : undefined);
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
