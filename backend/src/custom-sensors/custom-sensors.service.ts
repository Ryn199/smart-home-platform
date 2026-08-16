import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { GetReadingsQueryDto } from './dto/get-readings-query.dto';
import { Device, Prisma, Sensor, SensorReading } from '@prisma/client';

function getDefaultUnit(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('temp')) return '°C';
  if (lower.includes('humid')) return '%';
  if (lower.includes('press')) return 'hPa';
  if (lower.includes('light') || lower.includes('lux')) return 'lx';
  if (lower.includes('co2')) return 'ppm';
  if (lower.includes('voltage') || lower.includes('volt')) return 'V';
  if (lower.includes('current') || lower.includes('amp')) return 'A';
  if (lower.includes('power') || lower.includes('watt')) return 'W';
  return '';
}

function formatSensorName(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

export interface SensorReadingsResponse {
  sensor: Sensor;
  total: number;
  readings: SensorReading[];
}

@Injectable()
export class CustomSensorsService {
  private readonly logger = new Logger(CustomSensorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DevicesService))
    private readonly devicesService: DevicesService,
  ) {}

  async getSensorsByDeviceId(deviceId: number): Promise<Sensor[]> {
    // Validate device exists
    await this.devicesService.findOne(deviceId);

    return this.prisma.sensor.findMany({
      where: { deviceId },
      include: {
        readings: {
          take: 1,
          orderBy: { recordedAt: 'desc' },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async getSensorById(sensorId: number): Promise<Sensor> {
    const sensor = await this.prisma.sensor.findUnique({
      where: { id: sensorId },
      include: {
        device: {
          include: {
            room: true,
          },
        },
        readings: {
          take: 1,
          orderBy: { recordedAt: 'desc' },
        },
      },
    });

    if (!sensor) {
      throw new NotFoundException(`Sensor with ID ${sensorId} not found`);
    }

    return sensor;
  }

  async getSensorReadings(
    sensorId: number,
    query: GetReadingsQueryDto,
  ): Promise<SensorReadingsResponse> {
    const sensor = await this.getSensorById(sensorId);

    const where: Prisma.SensorReadingWhereInput = {
      sensorId,
    };

    if (query.from || query.to) {
      where.recordedAt = {};
      if (query.from) {
        where.recordedAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.recordedAt.lte = new Date(query.to);
      }
    }

    const limit = Math.min(query.limit ?? 100, 1000);

    const readings = await this.prisma.sensorReading.findMany({
      where,
      take: limit,
      orderBy: { recordedAt: 'desc' },
    });

    return {
      sensor,
      total: readings.length,
      readings,
    };
  }

  async handleTelemetry(device: Device, payload: Record<string, unknown>): Promise<void> {
    const entries = Object.entries(payload);

    for (const [key, rawValue] of entries) {
      if (typeof rawValue !== 'number' || isNaN(rawValue)) {
        continue;
      }

      const sensorType = key.toLowerCase();
      const value = rawValue;

      try {
        // Find existing sensor for this device or create it
        let sensor = await this.prisma.sensor.findFirst({
          where: {
            deviceId: device.id,
            type: sensorType,
          },
        });

        if (!sensor) {
          sensor = await this.prisma.sensor.create({
            data: {
              deviceId: device.id,
              type: sensorType,
              name: formatSensorName(key),
              unit: getDefaultUnit(sensorType),
            },
          });
          this.logger.log(
            `Created new sensor "${sensor.name}" (${sensor.type}) for device ${device.deviceUid}`,
          );
        }

        // Save reading
        await this.prisma.sensorReading.create({
          data: {
            sensorId: sensor.id,
            value,
            recordedAt: new Date(),
          },
        });

        this.logger.debug?.(
          `Stored reading for device ${device.deviceUid} [${sensor.type}]: ${value} ${sensor.unit}`,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to save sensor reading for ${device.deviceUid} [${key}]: ${message}`,
        );
      }
    }
  }
}
