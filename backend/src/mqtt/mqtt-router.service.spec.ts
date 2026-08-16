import { Test, TestingModule } from '@nestjs/testing';
import { MqttRouterService } from './mqtt-router.service';
import { MqttService } from './mqtt.service';
import { DevicesService } from '../devices/devices.service';
import { CustomSensorsService } from '../custom-sensors/custom-sensors.service';
import { SmartDoorService } from '../smart-door/smart-door.service';
import { SmartCurtainService } from '../smart-curtain/smart-curtain.service';
import { ExhaustFanService } from '../exhaust-fan/exhaust-fan.service';
import { NotFoundException } from '@nestjs/common';
import { Device, DeviceStatus, DeviceType } from '@prisma/client';

describe('MqttRouterService', () => {
  let service: MqttRouterService;
  let mqttService: { registerHandler: jest.Mock };
  let devicesService: { findByDeviceUid: jest.Mock; updateLastSeen: jest.Mock };
  let customSensorsService: { handleTelemetry: jest.Mock };
  let smartDoorService: { updateState: jest.Mock };
  let smartCurtainService: { updateState: jest.Mock };
  let exhaustFanService: { updateState: jest.Mock };

  beforeEach(async () => {
    mqttService = { registerHandler: jest.fn() };
    devicesService = {
      findByDeviceUid: jest.fn(),
      updateLastSeen: jest.fn().mockResolvedValue({}),
    };
    customSensorsService = { handleTelemetry: jest.fn() };
    smartDoorService = { updateState: jest.fn() };
    smartCurtainService = { updateState: jest.fn() };
    exhaustFanService = { updateState: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MqttRouterService,
        { provide: MqttService, useValue: mqttService },
        { provide: DevicesService, useValue: devicesService },
        { provide: CustomSensorsService, useValue: customSensorsService },
        { provide: SmartDoorService, useValue: smartDoorService },
        { provide: SmartCurtainService, useValue: smartCurtainService },
        { provide: ExhaustFanService, useValue: exhaustFanService },
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

    expect(customSensorsService.handleTelemetry).not.toHaveBeenCalled();
  });

  it('should route CUSTOM_SENSOR telemetry to CustomSensorsService', async () => {
    const mockDevice: Device = {
      id: 1,
      roomId: 1,
      name: 'Temp Sensor',
      deviceUid: 'sensor-001',
      deviceType: DeviceType.CUSTOM_SENSOR,
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
    const data = { temperature: 28.4, humidity: 72.1 };
    const payload = Buffer.from(JSON.stringify(data));

    await service.routeMessage(parsedTopic, 'home/1/1/sensor-001/telemetry', payload);

    expect(devicesService.updateLastSeen).toHaveBeenCalledWith('sensor-001');
    expect(customSensorsService.handleTelemetry).toHaveBeenCalledWith(mockDevice, data);
  });

  it('should validate and route SMART_DOOR state to SmartDoorService', async () => {
    const mockDevice: Device = {
      id: 2,
      roomId: 1,
      name: 'Door',
      deviceUid: 'door-001',
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
