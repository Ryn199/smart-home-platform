import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { EventsGateway } from '../websocket/events.gateway';
import { AutomationService } from '../automation/automation.service';
import { GetHistoryQueryDto } from './dto/get-history-query.dto';
import { Device, TempHumidityReading } from '@prisma/client';

export interface TempHumidityStats {
  deviceUid: string;
  current: {
    temperature: number | null;
    humidity: number | null;
    recordedAt: Date | null;
  };
  stats: {
    tempMin: number | null;
    tempMax: number | null;
    tempAvg: number | null;
    humMin: number | null;
    humMax: number | null;
    humAvg: number | null;
    totalReadings: number;
  };
}

@Injectable()
export class TempHumidityService {
  private readonly logger = new Logger(TempHumidityService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DevicesService))
    private readonly devicesService: DevicesService,
    @Inject(forwardRef(() => AutomationService))
    private readonly automationService: AutomationService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async handleState(device: Device, payload: Record<string, unknown>): Promise<void> {
    const temperature =
      typeof payload.temperature === 'number'
        ? payload.temperature
        : typeof payload.temp === 'number'
          ? payload.temp
          : undefined;

    const humidity =
      typeof payload.humidity === 'number'
        ? payload.humidity
        : typeof payload.hum === 'number'
          ? payload.hum
          : undefined;

    const currentMetadata = (device.metadata as Record<string, unknown>) || {};
    const now = new Date();
    const updatedMetadata: Record<string, unknown> = {
      ...currentMetadata,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(humidity !== undefined ? { humidity } : {}),
      lastUpdated: now.toISOString(),
    };

    // 1. Update live metadata on Device record
    await this.devicesService.updateMetadata(device.id, updatedMetadata);

    // 2. Persist historical telemetry record if valid temperature and humidity numbers are present
    if (temperature !== undefined && humidity !== undefined) {
      await this.prisma.tempHumidityReading.create({
        data: {
          deviceId: device.id,
          temperature,
          humidity,
          recordedAt: now,
        },
      });
    }

    // 3. Emit real-time WebSocket state event
    this.eventsGateway.emitDeviceState({
      deviceUid: device.deviceUid,
      deviceType: 'TEMP_HUMIDITY',
      state: updatedMetadata,
    });

    // 4. Evaluate automation triggers
    const homeId = (device as Device & { room?: { homeId?: number } }).room?.homeId;
    if (homeId) {
      if (temperature !== undefined) {
        this.automationService.evaluateSensorRules(homeId, 'temperature', temperature).catch((err) => {
          this.logger.error(`Error in temperature automation: ${err.message}`);
        });
      }
      if (humidity !== undefined) {
        this.automationService.evaluateSensorRules(homeId, 'humidity', humidity).catch((err) => {
          this.logger.error(`Error in humidity automation: ${err.message}`);
        });
      }
    }

    this.logger.log(
      `Saved & Streamed Temp/Humidity for ${device.deviceUid}: Temp=${temperature}°C, Hum=${humidity}%`,
    );
  }

  async getHistory(deviceUid: string, query: GetHistoryQueryDto): Promise<TempHumidityReading[]> {
    const device = await this.devicesService.findByDeviceUid(deviceUid);

    const now = new Date();
    let startDate: Date | undefined;

    switch (query.timeframe) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        startDate = undefined;
        break;
    }

    const readings = await this.prisma.tempHumidityReading.findMany({
      where: {
        deviceId: device.id,
        ...(startDate ? { recordedAt: { gte: startDate } } : {}),
      },
      orderBy: { recordedAt: 'asc' },
      take: query.limit || 100,
    });

    return readings;
  }

  async getStats(deviceUid: string): Promise<TempHumidityStats> {
    const device = await this.devicesService.findByDeviceUid(deviceUid);

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const readings = await this.prisma.tempHumidityReading.findMany({
      where: {
        deviceId: device.id,
        recordedAt: { gte: last24h },
      },
      orderBy: { recordedAt: 'desc' },
    });

    const latest = readings[0] || null;

    if (readings.length === 0) {
      const meta = (device.metadata as Record<string, unknown>) || {};
      return {
        deviceUid,
        current: {
          temperature: typeof meta.temperature === 'number' ? meta.temperature : null,
          humidity: typeof meta.humidity === 'number' ? meta.humidity : null,
          recordedAt: meta.lastUpdated ? new Date(String(meta.lastUpdated)) : null,
        },
        stats: {
          tempMin: null,
          tempMax: null,
          tempAvg: null,
          humMin: null,
          humMax: null,
          humAvg: null,
          totalReadings: 0,
        },
      };
    }

    const temps = readings.map((r) => r.temperature);
    const hums = readings.map((r) => r.humidity);

    const tempMin = Math.min(...temps);
    const tempMax = Math.max(...temps);
    const tempAvg = parseFloat((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1));

    const humMin = Math.min(...hums);
    const humMax = Math.max(...hums);
    const humAvg = parseFloat((hums.reduce((a, b) => a + b, 0) / hums.length).toFixed(1));

    return {
      deviceUid,
      current: {
        temperature: latest.temperature,
        humidity: latest.humidity,
        recordedAt: latest.recordedAt,
      },
      stats: {
        tempMin,
        tempMax,
        tempAvg,
        humMin,
        humMax,
        humAvg,
        totalReadings: readings.length,
      },
    };
  }
}
