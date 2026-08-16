import { Test, TestingModule } from '@nestjs/testing';
import { MqttRouterService } from './mqtt-router.service';
import { MqttService } from './mqtt.service';
import { DevicesService } from '../devices/devices.service';
import { TempHumidityService } from '../temp-humidity/temp-humidity.service';
import { SmartDoorService } from '../smart-door/smart-door.service';
import { SmartCurtainService } from '../smart-curtain/smart-curtain.service';
import { ExhaustFanService } from '../exhaust-fan/exhaust-fan.service';
import { EventsGateway } from '../websocket/events.gateway';
import { NotFoundException } from '@nestjs/common';
import { Device, DeviceStatus, DeviceType } from '@prisma/client';

describe('MqttRouterService', () => {
  let service: MqttRouterService;
  let mqttService: { registerHandler: jest.Mock };
  let devicesService: { findByDeviceUid: jest.Mock; updateLastSeen: jest.Mock };
  let tempHumidityService: { handleState: jest.Mock };
  let smartDoorService: { updateState: jest.Mock };
  let smartCurtainService: { updateState: jest.Mock };
  let exhaustFanService: { updateState: jest.Mock };

  beforeEach(async () => {
    mqttService = { registerHandler: jest.fn() };
    devicesService = {
      findByDeviceUid: jest.fn(),
      updateLastSeen: jest.fn().mockResolvedValue({}),
    };
    tempHumidityService = { handleState: jest.fn() };
    smartDoorService = { updateState: jest.fn() };
    smartCurtainService = { updateState: jest.fn() };
    exhaustFanService = { updateState: jest.fn() };

    const eventsGateway = {
      emitTelemetry: jest.fn(),
      emitDeviceState: jest.fn(),
      emitDeviceStatus: jest.fn(),
      emitCommandExecuted: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MqttRouterService,
        { provide: MqttService, useValue: mqttService },
        { provide: DevicesService, useValue: devicesService },
        { provide: TempHumidityService, useValue: tempHumidityService },
        { provide: SmartDoorService, useValue: smartDoorService },
        { provide: SmartCurtainService, useValue: smartCurtainService },
        { provide: ExhaustFanService, useValue: exhaustFanService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<MqttRouterService>(MqttRouterService);
  });

  it('should register handler on init', () => {
    service.onModuleInit();
    expect(mqttService.registerHandler).toHaveBeenCalled();
  });

  it('should ignore malformed JSON without crashing', async () => {
    const parsedTopic = {
      homeId: '1',
      roomId: '1',
      deviceUid: 'esp-001',
      messageType: 'telemetry',
    };
    const payload = Buffer.from('invalid-json{');

    await expect(
      service.routeMessage(parsedTopic, 'home/1/1/esp-001/telemetry', payload),
    ).resolves.not.toThrow();

    expect(devicesService.findByDeviceUid).not.toHaveBeenCalled();
  });

  it('should safely ignore unknown devices without crashing', async () => {
    devicesService.findByDeviceUid.mockRejectedValue(new NotFoundException());

    const parsedTopic = {
      homeId: '1',
      roomId: '1',
      deviceUid: 'unknown-001',
      messageType: 'telemetry',
    };
    const payload = Buffer.from(JSON.stringify({ temp: 25 }));

    await expect(
      service.routeMessage(parsedTopic, 'home/1/1/unknown-001/telemetry', payload),
    ).resolves.not.toThrow();

    expect(tempHumidityService.handleState).not.toHaveBeenCalled();
  });

  it('should reject telemetry if MAC address does not match', async () => {
    const mockDevice: Device = {
      id: 1,
      roomId: 1,
      name: 'Temp Sensor',
      deviceUid: 'th-001',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      pairingCode: 'SECRET-123',
      deviceType: DeviceType.TEMP_HUMIDITY,
      status: DeviceStatus.ONLINE,
      lastSeenAt: new Date(),
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devicesService.findByDeviceUid.mockResolvedValue(mockDevice);

    const parsedTopic = {
      homeId: '1',
      roomId: '1',
      deviceUid: 'th-001',
      messageType: 'telemetry',
    };
    const payload = Buffer.from(
      JSON.stringify({
        macAddress: '11:22:33:44:55:66',
        pairingCode: 'SECRET-123',
        temperature: 28.4,
        humidity: 72.1,
      }),
    );

    await service.routeMessage(parsedTopic, 'home/1/1/th-001/telemetry', payload);

    expect(tempHumidityService.handleState).not.toHaveBeenCalled();
    expect(devicesService.updateLastSeen).not.toHaveBeenCalled();
  });

  it('should reject telemetry if pairing code does not match', async () => {
    const mockDevice: Device = {
      id: 1,
      roomId: 1,
      name: 'Temp Sensor',
      deviceUid: 'th-001',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      pairingCode: 'SECRET-123',
      deviceType: DeviceType.TEMP_HUMIDITY,
      status: DeviceStatus.ONLINE,
      lastSeenAt: new Date(),
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devicesService.findByDeviceUid.mockResolvedValue(mockDevice);

    const parsedTopic = {
      homeId: '1',
      roomId: '1',
      deviceUid: 'th-001',
      messageType: 'telemetry',
    };
    const payload = Buffer.from(
      JSON.stringify({
        macAddress: 'AA:BB:CC:DD:EE:FF',
        pairingCode: 'WRONG-CODE',
        temperature: 28.4,
        humidity: 72.1,
      }),
    );

    await service.routeMessage(parsedTopic, 'home/1/1/th-001/telemetry', payload);

    expect(tempHumidityService.handleState).not.toHaveBeenCalled();
    expect(devicesService.updateLastSeen).not.toHaveBeenCalled();
  });

  it('should accept and route TEMP_HUMIDITY telemetry when credentials match', async () => {
    const mockDevice: Device = {
      id: 1,
      roomId: 1,
      name: 'Temp Sensor',
      deviceUid: 'sensor-001',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      pairingCode: 'PAIR-123',
      deviceType: DeviceType.TEMP_HUMIDITY,
      status: DeviceStatus.ONLINE,
      lastSeenAt: new Date(),
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devicesService.findByDeviceUid.mockResolvedValue(mockDevice);

    const parsedTopic = {
      homeId: '1',
      roomId: '1',
      deviceUid: 'sensor-001',
      messageType: 'telemetry',
    };
    const data = {
      macAddress: 'aabbccddeeff',
      pairingCode: 'PAIR-123',
      temperature: 28.4,
      humidity: 72.1,
    };
    const payload = Buffer.from(JSON.stringify(data));

    await service.routeMessage(parsedTopic, 'home/1/1/sensor-001/telemetry', payload);

    expect(devicesService.updateLastSeen).toHaveBeenCalledWith('sensor-001');
    expect(tempHumidityService.handleState).toHaveBeenCalledWith(mockDevice, data);
  });

  it('should validate and route SMART_DOOR state to SmartDoorService', async () => {
    const mockDevice: Device = {
      id: 2,
      roomId: 1,
      name: 'Door',
      deviceUid: 'door-001',
      macAddress: null,
      pairingCode: null,
      deviceType: DeviceType.SMART_DOOR,
      status: DeviceStatus.ONLINE,
      lastSeenAt: new Date(),
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devicesService.findByDeviceUid.mockResolvedValue(mockDevice);

    const parsedTopic = {
      homeId: '1',
      roomId: '1',
      deviceUid: 'door-001',
      messageType: 'state',
    };
    const data = { door: 'closed', lock: 'locked' };
    const payload = Buffer.from(JSON.stringify(data));

    await service.routeMessage(parsedTopic, 'home/1/1/door-001/state', payload);

    expect(smartDoorService.updateState).toHaveBeenCalledWith(
      'door-001',
      expect.objectContaining(data),
    );
  });

  it('should validate and route SMART_CURTAIN state to SmartCurtainService', async () => {
    const mockDevice: Device = {
      id: 3,
      roomId: 1,
      name: 'Curtain',
      deviceUid: 'curtain-001',
      macAddress: null,
      pairingCode: null,
      deviceType: DeviceType.SMART_CURTAIN,
      status: DeviceStatus.ONLINE,
      lastSeenAt: new Date(),
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devicesService.findByDeviceUid.mockResolvedValue(mockDevice);

    const parsedTopic = {
      homeId: '1',
      roomId: '1',
      deviceUid: 'curtain-001',
      messageType: 'state',
    };
    const data = { position: 75, state: 'opening' };
    const payload = Buffer.from(JSON.stringify(data));

    await service.routeMessage(parsedTopic, 'home/1/1/curtain-001/state', payload);

    expect(smartCurtainService.updateState).toHaveBeenCalledWith(
      'curtain-001',
      expect.objectContaining(data),
    );
  });

  it('should validate and route EXHAUST_FAN state to ExhaustFanService', async () => {
    const mockDevice: Device = {
      id: 4,
      roomId: 1,
      name: 'Fan',
      deviceUid: 'fan-001',
      macAddress: null,
      pairingCode: null,
      deviceType: DeviceType.EXHAUST_FAN,
      status: DeviceStatus.ONLINE,
      lastSeenAt: new Date(),
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devicesService.findByDeviceUid.mockResolvedValue(mockDevice);

    const parsedTopic = {
      homeId: '1',
      roomId: '1',
      deviceUid: 'fan-001',
      messageType: 'state',
    };
    const data = { power: true, speed: 2 };
    const payload = Buffer.from(JSON.stringify(data));

    await service.routeMessage(parsedTopic, 'home/1/1/fan-001/state', payload);

    expect(exhaustFanService.updateState).toHaveBeenCalledWith(
      'fan-001',
      expect.objectContaining(data),
    );
  });
});
