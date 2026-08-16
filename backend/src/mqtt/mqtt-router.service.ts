import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MqttService } from './mqtt.service';
import { ParsedMqttTopic } from './mqtt.types';
import { DevicesService } from '../devices/devices.service';
import { TempHumidityService } from '../temp-humidity/temp-humidity.service';
import { SmartDoorService } from '../smart-door/smart-door.service';
import { SmartDoorStateDto } from '../smart-door/dto/smart-door-state.dto';
import { SmartCurtainService } from '../smart-curtain/smart-curtain.service';
import { SmartCurtainStateDto } from '../smart-curtain/dto/smart-curtain-state.dto';
import { ExhaustFanService } from '../exhaust-fan/exhaust-fan.service';
import { ExhaustFanStateDto } from '../exhaust-fan/dto/exhaust-fan-state.dto';
import { EventsGateway } from '../websocket/events.gateway';
import { Device, DeviceType } from '@prisma/client';

@Injectable()
export class MqttRouterService implements OnModuleInit {
  private readonly logger = new Logger(MqttRouterService.name);

  constructor(
    private readonly mqttService: MqttService,
    private readonly devicesService: DevicesService,
    private readonly tempHumidityService: TempHumidityService,
    private readonly smartDoorService: SmartDoorService,
    private readonly smartCurtainService: SmartCurtainService,
    private readonly exhaustFanService: ExhaustFanService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  onModuleInit(): void {
    this.mqttService.registerHandler(this.routeMessage.bind(this));
    this.logger.log('MQTT message router registered.');
  }

  async routeMessage(
    parsedTopic: ParsedMqttTopic,
    rawTopic: string,
    payloadBuffer: Buffer,
  ): Promise<void> {
    // 1. Parse JSON safely
    let payload: Record<string, unknown>;
    try {
      const text = payloadBuffer.toString('utf-8');
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      this.logger.warn(`Invalid JSON payload received on topic "${rawTopic}". Message ignored.`);
      return;
    }

    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      this.logger.warn(
        `Payload on topic "${rawTopic}" is not a valid JSON object. Message ignored.`,
      );
      return;
    }

    // 2. Resolve device by deviceUid
    let device: Device;
    try {
      device = await this.devicesService.findByDeviceUid(parsedTopic.deviceUid);
    } catch {
      this.logger.warn(
        `Message received for unknown deviceUid "${parsedTopic.deviceUid}" on "${rawTopic}". Ignored.`,
      );
      return;
    }

    const now = new Date();

    // 3. Update device lastSeenAt & broadcast device.status online
    try {
      await this.devicesService.updateLastSeen(device.deviceUid);
      this.eventsGateway.emitDeviceStatus({
        deviceUid: device.deviceUid,
        status: 'online',
        lastSeenAt: now,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to update lastSeenAt for ${device.deviceUid}: ${message}`);
    }

    // 4. Delegate to specialized service based on DeviceType
    const messageType = parsedTopic.messageType;

    switch (device.deviceType) {
      case DeviceType.TEMP_HUMIDITY:
        if (messageType === 'telemetry' || messageType === 'state') {
          await this.tempHumidityService.handleState(device, payload);
        }
        break;

      case DeviceType.SMART_DOOR:
        if (messageType === 'state') {
          await this.handleSmartDoorState(device, payload, rawTopic);
        }
        break;

      case DeviceType.SMART_CURTAIN:
        if (messageType === 'state') {
          await this.handleSmartCurtainState(device, payload, rawTopic);
        }
        break;

      case DeviceType.EXHAUST_FAN:
        if (messageType === 'state') {
          await this.handleExhaustFanState(device, payload, rawTopic);
        }
        break;

      default:
        this.logger.warn(
          `Unhandled device type "${String(device.deviceType)}" for device "${device.deviceUid}".`,
        );
        break;
    }
  }

  private async handleSmartDoorState(
    device: Device,
    payload: Record<string, unknown>,
    rawTopic: string,
  ): Promise<void> {
    const stateDto = plainToInstance(SmartDoorStateDto, payload);
    const errors = await validate(stateDto);

    if (errors.length > 0) {
      this.logger.warn(
        `Invalid Smart Door state payload on topic "${rawTopic}": ${JSON.stringify(errors.map((e) => e.constraints))}`,
      );
      return;
    }

    await this.smartDoorService.updateState(device.deviceUid, stateDto);

    // Broadcast real-time device.state event
    this.eventsGateway.emitDeviceState({
      deviceUid: device.deviceUid,
      deviceType: 'SMART_DOOR',
      state: stateDto as unknown as Record<string, unknown>,
    });

    this.logger.log(
      `Smart Door [${device.deviceUid}] state updated: door=${stateDto.door}, lock=${stateDto.lock}`,
    );
  }

  private async handleSmartCurtainState(
    device: Device,
    payload: Record<string, unknown>,
    rawTopic: string,
  ): Promise<void> {
    const stateDto = plainToInstance(SmartCurtainStateDto, payload);
    const errors = await validate(stateDto);

    if (errors.length > 0) {
      this.logger.warn(
        `Invalid Smart Curtain state payload on topic "${rawTopic}": ${JSON.stringify(errors.map((e) => e.constraints))}`,
      );
      return;
    }

    await this.smartCurtainService.updateState(device.deviceUid, stateDto);

    // Broadcast real-time device.state event
    this.eventsGateway.emitDeviceState({
      deviceUid: device.deviceUid,
      deviceType: 'SMART_CURTAIN',
      state: stateDto as unknown as Record<string, unknown>,
    });

    this.logger.log(
      `Smart Curtain [${device.deviceUid}] state updated: position=${stateDto.position}%, state=${stateDto.state}`,
    );
  }

  private async handleExhaustFanState(
    device: Device,
    payload: Record<string, unknown>,
    rawTopic: string,
  ): Promise<void> {
    const stateDto = plainToInstance(ExhaustFanStateDto, payload);
    const errors = await validate(stateDto);

    if (errors.length > 0) {
      this.logger.warn(
        `Invalid Exhaust Fan state payload on topic "${rawTopic}": ${JSON.stringify(errors.map((e) => e.constraints))}`,
      );
      return;
    }

    await this.exhaustFanService.updateState(device.deviceUid, stateDto);

    // Broadcast real-time device.state event
    this.eventsGateway.emitDeviceState({
      deviceUid: device.deviceUid,
      deviceType: 'EXHAUST_FAN',
      state: stateDto as unknown as Record<string, unknown>,
    });

    this.logger.log(
      `Exhaust Fan [${device.deviceUid}] state updated: power=${stateDto.power}, speed=${stateDto.speed}`,
    );
  }
}
