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
  let devicesService: {
    findByDeviceUid: jest.Mock;
    findByPairingCode: jest.Mock;
    bindMacAddress: jest.Mock;
    updateLastSeen: jest.Mock;
  };
  let tempHumidityService: { handleState: jest.Mock };
  let smartDoorService: { updateState: jest.Mock };
  let smartCurtainService: { updateState: jest.Mock };
  let exhaustFanService: { updateState: jest.Mock };

  beforeEach(async () => {
    mqttService = { registerHandler: jest.fn() };
    devicesService = {
      findByDeviceUid: jest.fn(),
      findByPairingCode: jest.fn(),
      bindMacAddress: jest.fn(),
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
      homeId: '',
      roomId: '',
      deviceUid: '',
      messageType: 'telemetry' as const,
    };
    const payload = Buffer.from('invalid-json{');

    await expect(
      service.routeMessage(parsedTopic, 'iot/telemetry', payload),
    ).resolves.not.toThrow();

    expect(devicesService.findByPairingCode).not.toHaveBeenCalled();
  });

  it('should auto-bind hardware MAC address on first connection with pairingCode', async () => {
    const mockDevice: Device = {
      id: 1,
      roomId: 1,
      name: 'Living Room DHT',
      deviceUid: 'th-001',
      macAddress: null, // Initially unbound
      pairingCode: 'TH-7788',
      deviceType: DeviceType.TEMP_HUMIDITY,
      status: DeviceStatus.ONLINE,
      lastSeenAt: new Date(),
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devicesService.findByPairingCode.mockResolvedValue(mockDevice);
    devicesService.bindMacAddress.mockResolvedValue({
      ...mockDevice,
      macAddress: '24:6F:28:1A:3B:4C',
    });

    const parsedTopic = {
      homeId: '',
      roomId: '',
      deviceUid: '',
      messageType: 'telemetry' as const,
    };
    const data = {
      pairingCode: 'TH-7788',
      macAddress: '24:6F:28:1A:3B:4C',
      temperature: 28.5,
      humidity: 60.0,
    };
    const payload = Buffer.from(JSON.stringify(data));

    await service.routeMessage(parsedTopic, 'iot/telemetry', payload);

    expect(devicesService.findByPairingCode).toHaveBeenCalledWith('TH-7788');
    expect(devicesService.bindMacAddress).toHaveBeenCalledWith(1, '24:6F:28:1A:3B:4C');
    expect(devicesService.updateLastSeen).toHaveBeenCalledWith('th-001');
    expect(tempHumidityService.handleState).toHaveBeenCalled();
  });

  it('should reject a second ESP with different MAC trying to use the same pairingCode', async () => {
    const mockDevice: Device = {
      id: 1,
      roomId: 1,
      name: 'Living Room DHT',
      deviceUid: 'th-001',
      macAddress: '24:6F:28:1A:3B:4C', // Already bound to ESP #1
      pairingCode: 'TH-7788',
      deviceType: DeviceType.TEMP_HUMIDITY,
      status: DeviceStatus.ONLINE,
      lastSeenAt: new Date(),
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devicesService.findByPairingCode.mockResolvedValue(mockDevice);

    const parsedTopic = {
      homeId: '',
      roomId: '',
      deviceUid: '',
      messageType: 'telemetry' as const,
    };
    const rogueData = {
      pairingCode: 'TH-7788',
      macAddress: 'AA:BB:CC:99:88:77', // Different ESP board
      temperature: 28.5,
      humidity: 60.0,
    };
    const payload = Buffer.from(JSON.stringify(rogueData));

    await service.routeMessage(parsedTopic, 'iot/telemetry', payload);

    expect(devicesService.findByPairingCode).toHaveBeenCalledWith('TH-7788');
    expect(devicesService.bindMacAddress).not.toHaveBeenCalled();
    expect(devicesService.updateLastSeen).not.toHaveBeenCalled();
    expect(tempHumidityService.handleState).not.toHaveBeenCalled();
  });

  it('should accept telemetry from the bound ESP hardware MAC', async () => {
    const mockDevice: Device = {
      id: 1,
      roomId: 1,
      name: 'Living Room DHT',
      deviceUid: 'th-001',
      macAddress: '24:6F:28:1A:3B:4C',
      pairingCode: 'TH-7788',
      deviceType: DeviceType.TEMP_HUMIDITY,
      status: DeviceStatus.ONLINE,
      lastSeenAt: new Date(),
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devicesService.findByPairingCode.mockResolvedValue(mockDevice);

    const parsedTopic = {
      homeId: '',
      roomId: '',
      deviceUid: '',
      messageType: 'telemetry' as const,
    };
    const validData = {
      pairingCode: 'TH-7788',
      macAddress: '246f281a3b4c', // Matching (case/format normalized)
      temperature: 29.1,
      humidity: 55.4,
    };
    const payload = Buffer.from(JSON.stringify(validData));

    await service.routeMessage(parsedTopic, 'iot/telemetry', payload);

    expect(devicesService.updateLastSeen).toHaveBeenCalledWith('th-001');
    expect(tempHumidityService.handleState).toHaveBeenCalled();
  });

  it('should route SMART_DOOR state by UID', async () => {
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
      messageType: 'state' as const,
    };
    const data = { door: 'closed', lock: 'locked' };
    const payload = Buffer.from(JSON.stringify(data));

    await service.routeMessage(parsedTopic, 'home/1/1/door-001/state', payload);

    expect(smartDoorService.updateState).toHaveBeenCalledWith(
      'door-001',
      expect.objectContaining(data),
    );
  });
});
