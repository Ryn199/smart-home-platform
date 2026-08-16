import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { DevicesService } from '../devices/devices.service';
import { EventsGateway } from '../websocket/events.gateway';
import { AutomationService } from '../automation/automation.service';
import { TempHumidityStateDto } from './dto/temp-humidity-state.dto';
import { Device } from '@prisma/client';

@Injectable()
export class TempHumidityService {
  private readonly logger = new Logger(TempHumidityService.name);

  constructor(
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
    const updatedMetadata: Record<string, unknown> = {
      ...currentMetadata,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(humidity !== undefined ? { humidity } : {}),
      lastUpdated: new Date().toISOString(),
    };

    // Update in database
    await this.devicesService.updateMetadata(device.id, updatedMetadata);

    // Emit real-time WebSocket state event
    this.eventsGateway.emitDeviceState({
      deviceUid: device.deviceUid,
      deviceType: 'TEMP_HUMIDITY',
      state: updatedMetadata,
    });

    // Evaluate automation triggers
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
      `Updated Temp/Humidity for ${device.deviceUid}: Temp=${temperature}°C, Hum=${humidity}%`,
    );
  }
}
