import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { EventsGateway } from '../websocket/events.gateway';
import { UploadFirmwareDto } from './dto/upload-firmware.dto';
import { Firmware, FirmwareStatus, DeviceCommand } from '@prisma/client';

export type FirmwareSummary = Omit<Firmware, 'fileData'>;

@Injectable()
export class FirmwareService {
  private readonly logger = new Logger(FirmwareService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DevicesService))
    private readonly devicesService: DevicesService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * Upload and register a new .bin firmware file for a device.
   */
  async upload(deviceId: number, dto: UploadFirmwareDto): Promise<FirmwareSummary> {
    // 1. Verify device exists
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }

    // 2. Validate version
    const cleanVersion = dto.version.trim();
    if (!cleanVersion) {
      throw new BadRequestException('Firmware version string cannot be empty');
    }

    const existingVersion = await this.prisma.firmware.findFirst({
      where: { deviceId, version: cleanVersion },
    });
    if (existingVersion) {
      throw new ConflictException(
        `Firmware version "${cleanVersion}" already exists for device "${device.name}"`,
      );
    }

    // 3. Decode base64 binary content
    let buffer: Buffer;
    try {
      // Remove any data URL prefix if present (e.g. data:application/octet-stream;base64,...)
      const rawBase64 = dto.fileData.includes(',')
        ? dto.fileData.split(',')[1]
        : dto.fileData;
      buffer = Buffer.from(rawBase64, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 encoding for firmware file data');
    }

    if (buffer.length === 0) {
      throw new BadRequestException('Firmware binary file is empty (0 bytes)');
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (buffer.length > MAX_SIZE) {
      throw new BadRequestException(
        `Firmware file exceeds maximum allowed size of 10MB (got ${(buffer.length / (1024 * 1024)).toFixed(2)}MB)`,
      );
    }

    // 4. Calculate SHA-256 checksum
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // 5. Save to database
    const firmware = await this.prisma.firmware.create({
      data: {
        deviceId,
        version: cleanVersion,
        fileName: dto.fileName.trim() || `firmware_${cleanVersion}.bin`,
        fileSize: buffer.length,
        fileData: buffer as any,
        checksum,
        changelog: dto.changelog?.trim() || null,
        isCurrent: false,
        status: FirmwareStatus.READY,
      },
      select: {
        id: true,
        deviceId: true,
        version: true,
        fileName: true,
        fileSize: true,
        checksum: true,
        changelog: true,
        isCurrent: true,
        uploadedAt: true,
        deployedAt: true,
        status: true,
      },
    });

    this.logger.log(
      `Firmware v${cleanVersion} (${buffer.length} bytes, SHA: ${checksum.substring(0, 8)}) uploaded for device [${device.deviceUid}].`,
    );

    return firmware;
  }

  /**
   * List all uploaded firmwares for a given device, sorted by upload date.
   */
  async findAllByDevice(deviceId: number): Promise<FirmwareSummary[]> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }

    return this.prisma.firmware.findMany({
      where: { deviceId },
      select: {
        id: true,
        deviceId: true,
        version: true,
        fileName: true,
        fileSize: true,
        checksum: true,
        changelog: true,
        isCurrent: true,
        uploadedAt: true,
        deployedAt: true,
        status: true,
      },
      orderBy: [{ isCurrent: 'desc' }, { uploadedAt: 'desc' }],
    });
  }

  /**
   * Retrieve raw firmware binary data for ESP OTA download or browser download.
   */
  async getBinary(id: number): Promise<{
    fileName: string;
    fileSize: number;
    fileData: Buffer;
    checksum: string | null;
    version: string;
  }> {
    const firmware = await this.prisma.firmware.findUnique({
      where: { id },
    });

    if (!firmware || !firmware.fileData) {
      throw new NotFoundException(`Firmware with ID ${id} not found or has no binary data`);
    }

    return {
      fileName: firmware.fileName,
      fileSize: firmware.fileSize,
      fileData: firmware.fileData as unknown as Buffer,
      checksum: firmware.checksum,
      version: firmware.version,
    };
  }

  /**
   * Deploy/Flash a selected firmware to the ESP device via MQTT OTA update.
   */
  async deploy(
    deviceId: number,
    firmwareId: number,
    hostUrl?: string,
  ): Promise<{ message: string; firmware: FirmwareSummary; command: DeviceCommand }> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: { room: { include: { home: true } } },
    });
    if (!device) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }

    const targetFirmware = await this.prisma.firmware.findUnique({
      where: { id: firmwareId },
    });
    if (!targetFirmware || targetFirmware.deviceId !== deviceId) {
      throw new NotFoundException(`Firmware with ID ${firmwareId} not found for this device`);
    }

    // 1. Mark target firmware as FLASHING (awaiting ESP confirmation)
    const updatedFirmware = await this.prisma.firmware.update({
      where: { id: firmwareId },
      data: {
        status: FirmwareStatus.FLASHING,
      },
      select: {
        id: true,
        deviceId: true,
        version: true,
        fileName: true,
        fileSize: true,
        checksum: true,
        changelog: true,
        isCurrent: true,
        uploadedAt: true,
        deployedAt: true,
        status: true,
      },
    });

    // 2. Construct OTA download URL (supports separate backend server from MQTT broker)
    const baseUrl =
      process.env.BACKEND_URL?.trim() ||
      hostUrl ||
      `http://localhost:${process.env.PORT || 3000}`;
    const downloadUrl = `${baseUrl.replace(/\/+$/, '')}/api/firmware/${firmwareId}/download`;

    // 3. Dispatch OTA update command via MQTT
    const command = await this.devicesService.executeCommand(deviceId, {
      action: 'ota_update',
      payload: {
        url: downloadUrl,
        version: targetFirmware.version,
        fileName: targetFirmware.fileName,
        fileSize: targetFirmware.fileSize,
        checksum: targetFirmware.checksum,
      },
    });

    this.logger.log(
      `OTA Firmware update v${targetFirmware.version} dispatched to device [${device.deviceUid}]. Status: FLASHING. URL: ${downloadUrl}`,
    );

    return {
      message: `Perintah OTA firmware v${targetFirmware.version} telah dikirim ke perangkat ${device.name}. Menunggu konfirmasi unduh dan flash dari ESP...`,
      firmware: updatedFirmware,
      command,
    };
  }

  /**
   * Handle real-time OTA progress / error report from ESP (from topic iot/ota/status).
   */
  async handleOTAStatusReport(payload: Record<string, unknown>): Promise<void> {
    try {
      const pairingCode = typeof payload.pairingCode === 'string' ? payload.pairingCode.trim() : '';
      const macAddress = typeof payload.macAddress === 'string' ? payload.macAddress.trim() : '';
      const status = typeof payload.status === 'string' ? payload.status.trim() : '';
      const targetVersion = typeof payload.targetVersion === 'string' ? payload.targetVersion.trim() : '';
      const errorMsg = typeof payload.error === 'string' ? payload.error.trim() : '';

      let device = null;
      if (pairingCode) {
        device = await this.devicesService.findByPairingCode(pairingCode);
      }
      if (!device && macAddress) {
        device = await this.prisma.device.findFirst({
          where: { macAddress: { equals: macAddress, mode: 'insensitive' } },
        });
      }

      if (!device) return;

      if (status === 'FAILED') {
        this.logger.warn(
          `OTA Failed on device [${device.deviceUid}] for target version v${targetVersion}. Error: ${errorMsg}`,
        );

        // Mark target firmware as FAILED
        await this.prisma.firmware.updateMany({
          where: {
            deviceId: device.id,
            status: FirmwareStatus.FLASHING,
            ...(targetVersion ? { version: targetVersion } : {}),
          },
          data: { status: FirmwareStatus.FAILED },
        });

        // Broadcast failure via WebSocket to web-admin
        this.eventsGateway.emitDeviceDiagnostics({
          deviceUid: device.deviceUid,
          diagnostics: {
            otaStatus: 'FAILED',
            otaError: errorMsg || 'Gagal flashing firmware pada ESP',
            targetVersion,
          },
          timestamp: new Date(),
        });
      } else if (status === 'FLASHING' || status === 'DOWNLOADING') {
        this.logger.log(`Device [${device.deviceUid}] is currently downloading & flashing firmware v${targetVersion}...`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error handling OTA status report: ${msg}`);
    }
  }

  /**
   * Confirm and activate firmware based on real ground-truth version reported by ESP diagnostics upon boot.
   */
  async handleFirmwareConfirmed(deviceId: number, reportedVersion: string): Promise<void> {
    try {
      if (!reportedVersion || reportedVersion === 'unknown') return;

      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
      });
      if (!device) return;

      // 1. Find if there is a matching firmware in database
      const matchingFirmware = await this.prisma.firmware.findFirst({
        where: {
          deviceId,
          version: reportedVersion,
        },
      });

      if (matchingFirmware) {
        // If it was not already ACTIVE, activate it now!
        if (!matchingFirmware.isCurrent || matchingFirmware.status !== FirmwareStatus.ACTIVE) {
          // Demote all other firmwares to PREVIOUS
          await this.prisma.firmware.updateMany({
            where: {
              deviceId,
              id: { not: matchingFirmware.id },
            },
            data: {
              isCurrent: false,
              status: FirmwareStatus.PREVIOUS,
            },
          });

          // Promote matched firmware to ACTIVE
          await this.prisma.firmware.update({
            where: { id: matchingFirmware.id },
            data: {
              isCurrent: true,
              status: FirmwareStatus.ACTIVE,
              deployedAt: new Date(),
            },
          });

          // Update device table firmwareVersion
          await this.prisma.device.update({
            where: { id: deviceId },
            data: { firmwareVersion: reportedVersion },
          });

          this.logger.log(
            `Firmware Ground-Truth Verified! Device [${device.deviceUid}] successfully activated firmware v${reportedVersion}.`,
          );
        }
      } else {
        // Firmware name in ESP (e.g. "First Firmware") is not yet in database table.
        // Update device record so it reflects the actual running version
        if (device.firmwareVersion !== reportedVersion) {
          await this.prisma.device.update({
            where: { id: deviceId },
            data: { firmwareVersion: reportedVersion },
          });
        }
      }

      // 2. Mark any remaining FLASHING firmwares with different version as FAILED (because ESP booted with different version)
      await this.prisma.firmware.updateMany({
        where: {
          deviceId,
          status: FirmwareStatus.FLASHING,
          version: { not: reportedVersion },
        },
        data: {
          status: FirmwareStatus.FAILED,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error handling firmware confirmation for device ${deviceId}: ${msg}`);
    }
  }

  /**
   * 1-Click Rollback to the previous firmware version.
   */
  async rollback(
    deviceId: number,
    hostUrl?: string,
  ): Promise<{ message: string; firmware: FirmwareSummary; command: DeviceCommand }> {
    // Find the most recently active previous firmware
    const previousFirmware = await this.prisma.firmware.findFirst({
      where: {
        deviceId,
        isCurrent: false,
        status: FirmwareStatus.PREVIOUS,
      },
      orderBy: { deployedAt: 'desc' },
    });

    if (!previousFirmware) {
      // Fallback: any previous firmware ordered by upload date
      const fallback = await this.prisma.firmware.findFirst({
        where: {
          deviceId,
          isCurrent: false,
        },
        orderBy: { uploadedAt: 'desc' },
      });

      if (!fallback) {
        throw new BadRequestException('No previous firmware available for rollback on this device');
      }

      return this.deploy(deviceId, fallback.id, hostUrl);
    }

    return this.deploy(deviceId, previousFirmware.id, hostUrl);
  }

  /**
   * Delete an uploaded firmware (only allowed if not currently active).
   */
  async delete(deviceId: number, firmwareId: number): Promise<{ message: string; id: number }> {
    const firmware = await this.prisma.firmware.findUnique({
      where: { id: firmwareId },
    });

    if (!firmware || firmware.deviceId !== deviceId) {
      throw new NotFoundException(`Firmware with ID ${firmwareId} not found for this device`);
    }

    if (firmware.isCurrent || firmware.status === FirmwareStatus.ACTIVE || firmware.status === FirmwareStatus.FLASHING) {
      throw new BadRequestException(
        'Cannot delete currently active or flashing firmware. Please switch/rollback to another firmware first.',
      );
    }

    await this.prisma.firmware.delete({
      where: { id: firmwareId },
    });

    return {
      message: `Firmware v${firmware.version} deleted successfully`,
      id: firmwareId,
    };
  }
}
