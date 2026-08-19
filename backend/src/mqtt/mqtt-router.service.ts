import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
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
import { FirmwareService } from '../firmware/firmware.service';
import { EventsGateway } from '../websocket/events.gateway';
import { Device, DeviceType, Home, Room } from '@prisma/client';

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
    @Inject(forwardRef(() => FirmwareService))
    private readonly firmwareService: FirmwareService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  onModuleInit(): void {
    this.mqttService.registerHandler(this.routeMessage.bind(this));
    this.logger.log('MQTT message router registered.');
  }

  private normalizeMac(mac?: string | null): string {
    if (!mac) return '';
    return mac.replace(/[:-]/g, '').toUpperCase().trim();
  }

  async routeMessage(
    parsedTopic: ParsedMqttTopic,
    rawTopic: string,
    payloadBuffer: Buffer,
  ): Promise<void> {
    // 0. Ignore outgoing command topics (commands are sent to devices, not from devices)
    if (parsedTopic.messageType === 'command') {
      return;
    }

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

    // Handle OTA status reports directly
    if (rawTopic.includes('ota/status') || parsedTopic.messageType === 'ota_status') {
      await this.firmwareService.handleOTAStatusReport(payload);
      return;
    }

    // 2. Extract credentials & identifiers
    const payloadPairingCode =
      typeof payload.pairingCode === 'string'
        ? payload.pairingCode.trim()
        : typeof payload.code === 'string'
          ? payload.code.trim()
          : typeof payload.pairing === 'string'
            ? payload.pairing.trim()
            : '';

    const payloadMac =
      typeof payload.macAddress === 'string'
        ? payload.macAddress.trim()
        : typeof payload.mac === 'string'
          ? payload.mac.trim()
          : '';

    const candidateUid =
      (typeof payload.deviceUid === 'string' ? payload.deviceUid.trim() : '') ||
      parsedTopic.deviceUid;

    // 3. Resolve device (Priority 1: Pairing Code, Priority 2: Device UID)
    let device: (Device & { room: Room & { home: Home } }) | null = null;

    if (payloadPairingCode) {
      device = await this.devicesService.findByPairingCode(payloadPairingCode);
      if (!device) {
        this.logger.warn(
          `[SECURITY] Telemetry received with unregistered pairing code "${payloadPairingCode}" on topic "${rawTopic}". Ignored.`,
        );
        return;
      }
    } else if (candidateUid) {
      try {
        device = await this.devicesService.findByDeviceUid(candidateUid);
      } catch {
        this.logger.warn(
          `Message received for unknown deviceUid "${candidateUid}" on "${rawTopic}". Ignored.`,
        );
        return;
      }
    } else {
      this.logger.warn(
        `Received unidentifiable MQTT message without pairingCode or deviceUid on topic "${rawTopic}". Ignored.`,
      );
      return;
    }

    // 4. Hardware Authentication & Auto-Binding
    if (payloadPairingCode) {
      if (!device.macAddress) {
        // First connection with this pairingCode: Auto-bind the hardware MAC address!
        if (payloadMac) {
          device = await this.devicesService.bindMacAddress(device.id, payloadMac);
          this.logger.log(
            `[SECURITY] Device "${device.name}" (${device.deviceUid}) successfully bound to hardware MAC "${payloadMac}".`,
          );
        }
      } else {
        // Device is already bound to a hardware MAC address: Enforce strict MAC matching!
        const expectedMac = this.normalizeMac(device.macAddress);
        const actualMac = this.normalizeMac(payloadMac);

        if (!actualMac || expectedMac !== actualMac) {
          this.logger.warn(
            `[SECURITY] ACCESS DENIED for device "${device.name}" (${device.deviceUid}). Pairing code "${payloadPairingCode}" is already bound to MAC "${device.macAddress}", but received unauthorized packet from MAC "${payloadMac || 'UNKNOWN'}". Message rejected.`,
          );
          return;
        }
      }
    } else if (device.pairingCode && !device.macAddress) {
      // Device has a pairing code configured in DB but has not yet bound a MAC address.
      // Unbound devices MUST provide the pairing code on first connection.
      this.logger.warn(
        `[SECURITY] Device "${device.deviceUid}" is not yet bound to a MAC address and requires pairing code for authentication. Packet rejected.`,
      );
      return;
    } else if (device.macAddress && payloadMac) {
      const expectedMac = this.normalizeMac(device.macAddress);
      const actualMac = this.normalizeMac(payloadMac);
      if (expectedMac !== actualMac) {
        this.logger.warn(
          `[SECURITY] MAC address mismatch for device "${device.deviceUid}". Expected "${device.macAddress}", received "${payloadMac}". Message rejected.`,
        );
        return;
      }
    }

    const now = new Date();

    // 5. Update device lastSeenAt & broadcast device.status online
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

    // 6. Handle internal ESP hardware system diagnostics
    const messageType = parsedTopic.messageType;
    const isDiagnostics =
      messageType === 'diagnostics' ||
      messageType === 'system' ||
      payload.freeHeap !== undefined ||
      payload.flashChipSize !== undefined ||
      payload.sketchSize !== undefined ||
      payload.cpuFreq !== undefined ||
      payload.cpuFreqMHz !== undefined ||
      payload.resetReason !== undefined;

    if (isDiagnostics) {
      await this.handleDiagnostics(device, payload);
    }

    // 7. Delegate to specialized domain service
    switch (device.deviceType) {
      case DeviceType.TEMP_HUMIDITY:
        if (messageType === 'telemetry' || messageType === 'state' || !messageType || messageType === 'diagnostics') {
          // If pure diagnostics message without temperature/humidity, ignore domain telemetry
          if (payload.temperature !== undefined || payload.humidity !== undefined) {
            await this.tempHumidityService.handleState(device, payload);
          }
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

  private async handleDiagnostics(
    device: Device,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const diagnosticsData: Record<string, unknown> = {
        macAddress: payload.macAddress || payload.mac || device.macAddress || null,
        ipAddress: payload.ipAddress || payload.ip || device.ipAddress || null,
        freeHeap: payload.freeHeap !== undefined ? Number(payload.freeHeap) : undefined,
        minFreeHeap: payload.minFreeHeap !== undefined ? Number(payload.minFreeHeap) : undefined,
        rssi: payload.rssi !== undefined ? Number(payload.rssi) : undefined,
        internalTemp:
          payload.internalTemp !== undefined
            ? Number(payload.internalTemp)
            : payload.internalTemperature !== undefined
              ? Number(payload.internalTemperature)
              : undefined,
        uptime:
          payload.uptime !== undefined
            ? Number(payload.uptime)
            : payload.millis !== undefined
              ? Number(payload.millis)
              : undefined,
        resetReason: payload.resetReason ? String(payload.resetReason) : undefined,
        firmwareVersion: payload.firmwareVersion
          ? String(payload.firmwareVersion)
          : payload.firmware
            ? String(payload.firmware)
            : device.firmwareVersion || null,
        flashChipSize: payload.flashChipSize !== undefined ? Number(payload.flashChipSize) : undefined,
        sketchSize: payload.sketchSize !== undefined ? Number(payload.sketchSize) : undefined,
        cpuFreq:
          payload.cpuFreq !== undefined
            ? Number(payload.cpuFreq)
            : payload.cpuFreqMHz !== undefined
              ? Number(payload.cpuFreqMHz)
              : undefined,
        updatedAt: new Date().toISOString(),
      };

      // Filter undefined values
      Object.keys(diagnosticsData).forEach(
        (key) => diagnosticsData[key] === undefined && delete diagnosticsData[key],
      );

      await this.devicesService.updateDiagnostics(device.id, diagnosticsData);

      // Verify ground-truth firmware version reported by ESP
      if (diagnosticsData.firmwareVersion) {
        await this.firmwareService.handleFirmwareConfirmed(
          device.id,
          String(diagnosticsData.firmwareVersion),
        );
      }

      // Emit real-time WebSocket event
      this.eventsGateway.emitDeviceDiagnostics({
        deviceUid: device.deviceUid,
        diagnostics: diagnosticsData,
        timestamp: new Date(),
      });

      this.logger.log(
        `Diagnostics updated for device [${device.deviceUid}]: freeHeap=${diagnosticsData.freeHeap}, rssi=${diagnosticsData.rssi}, ip=${diagnosticsData.ipAddress}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to handle diagnostics for device ${device.deviceUid}: ${msg}`);
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
    // Delegate to ExhaustFanService.handleState which safely merges partial updates
    await this.exhaustFanService.handleState(device.deviceUid, payload);

    // Broadcast real-time device.state event with the full raw payload so UI can react immediately
    this.eventsGateway.emitDeviceState({
      deviceUid: device.deviceUid,
      deviceType: 'EXHAUST_FAN',
      state: payload,
    });

    this.logger.log(
      `[EXHAUST] State received & stored for ${device.deviceUid} from topic "${rawTopic}": ` +
        `power=${payload.power}, direction=${payload.direction}, duct=${payload.ductPosition ?? payload.duct_position}, ` +
        `state=${payload.operationState ?? payload.operation_state}`,
    );
  }
}

