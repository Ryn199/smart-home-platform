import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  Body,
  UseGuards,
  Req,
  StreamableFile,
  Header,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FirmwareService, FirmwareSummary } from './firmware.service';
import { UploadFirmwareDto } from './dto/upload-firmware.dto';
import { DeviceCommand } from '@prisma/client';
import { FastifyRequest } from 'fastify';

@ApiTags('Firmware')
@Controller()
export class FirmwareController {
  constructor(private readonly firmwareService: FirmwareService) {}

  @Post('devices/:deviceId/firmware')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Upload a new firmware binary (.bin) for a device' })
  @ApiResponse({ status: 201, description: 'Firmware uploaded successfully and ready for deployment' })
  @ApiResponse({ status: 409, description: 'Firmware version already exists for this device' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async upload(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Body() dto: UploadFirmwareDto,
  ): Promise<FirmwareSummary> {
    return this.firmwareService.upload(deviceId, dto);
  }

  @Get('devices/:deviceId/firmware')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all uploaded firmwares for a device' })
  @ApiResponse({ status: 200, description: 'List of firmwares' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async findAll(
    @Param('deviceId', ParseIntPipe) deviceId: number,
  ): Promise<FirmwareSummary[]> {
    return this.firmwareService.findAllByDevice(deviceId);
  }

  @Post('devices/:deviceId/firmware/:id/deploy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Flash / Deploy firmware to ESP node via OTA over MQTT' })
  @ApiResponse({ status: 200, description: 'OTA update command dispatched' })
  @ApiResponse({ status: 404, description: 'Device or firmware not found' })
  async deploy(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest,
  ): Promise<{ message: string; firmware: FirmwareSummary; command: DeviceCommand }> {
    const protocol = req.protocol || 'http';
    const host = req.headers.host || `localhost:${process.env.PORT || 3000}`;
    const hostUrl = `${protocol}://${host}`;
    return this.firmwareService.deploy(deviceId, id, hostUrl);
  }

  @Post('devices/:deviceId/firmware/rollback')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '1-Click rollback to the previous firmware version' })
  @ApiResponse({ status: 200, description: 'Rollback OTA update command dispatched' })
  @ApiResponse({ status: 400, description: 'No previous firmware available for rollback' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async rollback(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Req() req: FastifyRequest,
  ): Promise<{ message: string; firmware: FirmwareSummary; command: DeviceCommand }> {
    const protocol = req.protocol || 'http';
    const host = req.headers.host || `localhost:${process.env.PORT || 3000}`;
    const hostUrl = `${protocol}://${host}`;
    return this.firmwareService.rollback(deviceId, hostUrl);
  }

  @Delete('devices/:deviceId/firmware/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a firmware file' })
  @ApiResponse({ status: 200, description: 'Firmware deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete active firmware' })
  @ApiResponse({ status: 404, description: 'Firmware not found' })
  async delete(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; id: number }> {
    return this.firmwareService.delete(deviceId, id);
  }

  @Get('firmware/:id/download')
  @ApiOperation({ summary: 'Download raw firmware binary (.bin) for ESP OTA flashing or browser download' })
  @ApiResponse({ status: 200, description: 'Raw binary stream' })
  @ApiResponse({ status: 404, description: 'Firmware not found' })
  async download(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    const binary = await this.firmwareService.getBinary(id);
    return new StreamableFile(binary.fileData, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${binary.fileName}"`,
      length: binary.fileSize,
    });
  }
}
