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
import { DevicePresenceInfo, DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { ExecuteCommandDto } from './dto/execute-command.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Device, DeviceCommand, DeviceStatus, DeviceType } from '@prisma/client';

@ApiTags('Devices')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('devices')
  @ApiOperation({ summary: 'Register a new device' })
  @ApiResponse({ status: 201, description: 'Device registered successfully' })
  @ApiResponse({ status: 409, description: 'Device UID already exists' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async create(@Body() dto: CreateDeviceDto): Promise<Device> {
    return this.devicesService.create(dto);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List all devices with optional room, type, and status filtering' })
  @ApiResponse({ status: 200, description: 'List of devices' })
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
  @ApiOperation({ summary: 'Get device details by ID' })
  @ApiResponse({ status: 200, description: 'Device details' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Device> {
    return this.devicesService.findOne(id);
  }

  @Get('devices/:id/presence')
  @ApiOperation({ summary: 'Get dynamic online/offline presence status for device' })
  @ApiResponse({ status: 200, description: 'Presence information' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async getPresence(@Param('id', ParseIntPipe) id: number): Promise<DevicePresenceInfo> {
    return this.devicesService.getPresence(id);
  }

  @Post('devices/:id/commands')
  @ApiOperation({ summary: 'Execute specialized device command and publish to MQTT' })
  @ApiResponse({ status: 201, description: 'Command executed and dispatched to MQTT' })
  @ApiResponse({ status: 400, description: 'Invalid action or parameters for device type' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async executeCommand(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExecuteCommandDto,
  ): Promise<DeviceCommand> {
    return this.devicesService.executeCommand(id, dto);
  }

  @Get('devices/:id/commands')
  @ApiOperation({ summary: 'Get command execution history for device' })
  @ApiResponse({ status: 200, description: 'List of executed commands' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async getCommands(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ): Promise<DeviceCommand[]> {
    return this.devicesService.getCommands(id, limit ? parseInt(limit, 10) : undefined);
  }

  @Patch('devices/:id')
  @ApiOperation({ summary: 'Update device details' })
  @ApiResponse({ status: 200, description: 'Device updated successfully' })
  @ApiResponse({ status: 404, description: 'Device or Room not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeviceDto,
  ): Promise<Device> {
    return this.devicesService.update(id, dto);
  }

  @Delete('devices/:id')
  @ApiOperation({ summary: 'Delete a device' })
  @ApiResponse({ status: 200, description: 'Device deleted successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; id: number }> {
    return this.devicesService.remove(id);
  }

  @Post('devices/:id/reset-auth')
  @ApiOperation({ summary: 'Reset device hardware MAC address binding so a new ESP hardware can pair' })
  @ApiResponse({ status: 200, description: 'Device authentication reset successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async resetAuth(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; device: Device }> {
    const device = await this.devicesService.resetAuth(id);
    return {
      message: `Authentication reset for device "${device.name}". MAC address binding removed.`,
      device,
    };
  }

  @Get('rooms/:roomId/devices')
  @ApiOperation({ summary: 'List all devices in a room' })
  @ApiResponse({ status: 200, description: 'List of devices in room' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async findByRoomId(@Param('roomId', ParseIntPipe) roomId: number): Promise<Device[]> {
    return this.devicesService.findByRoomId(roomId);
  }
}
