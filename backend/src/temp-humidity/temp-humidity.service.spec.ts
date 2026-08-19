import { Test, TestingModule } from '@nestjs/testing';
import { TempHumidityService } from './temp-humidity.service';
import { PrismaService } from '../database/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { AutomationService } from '../automation/automation.service';
import { EventsGateway } from '../websocket/events.gateway';
import { Device, DeviceStatus, DeviceType } from '@prisma/client';

describe('TempHumidityService', () => {
  let service: TempHumidityService;
  let prisma: {
    tempHumidityReading: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let devicesService: { updateMetadata: jest.Mock; findByDeviceUid: jest.Mock };
  let automationService: { evaluateSensorRules: jest.Mock };
  let eventsGateway: { emitDeviceState: jest.Mock };

  const mockDevice: Device & { room?: { homeId?: number } } = {
    id: 1,
    roomId: 1,
    name: 'Climate Sensor',
    deviceUid: 'th-001',
    macAddress: '24:6F:28:1A:3B:4C',
    ipAddress: null,
    firmwareVersion: null,
    pairingCode: 'TH-7788',
    deviceType: DeviceType.TEMP_HUMIDITY,
    status: DeviceStatus.ONLINE,
    lastSeenAt: new Date(),
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    room: { homeId: 1 },
  };

  beforeEach(async () => {
    prisma = {
      tempHumidityReading: {
        create: jest.fn().mockResolvedValue({ id: 1, deviceId: 1, temperature: 29.2, humidity: 65 }),
        findMany: jest.fn().mockResolvedValue([
          { id: 1, deviceId: 1, temperature: 28.0, humidity: 60, recordedAt: new Date() },
          { id: 2, deviceId: 1, temperature: 30.0, humidity: 70, recordedAt: new Date() },
        ]),
      },
    };

    devicesService = {
      updateMetadata: jest.fn().mockResolvedValue({ ...mockDevice, metadata: { temperature: 28.5, humidity: 60 } }),
      findByDeviceUid: jest.fn().mockResolvedValue(mockDevice),
    };

    automationService = {
      evaluateSensorRules: jest.fn().mockResolvedValue(undefined),
    };

    eventsGateway = {
      emitDeviceState: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TempHumidityService,
        { provide: PrismaService, useValue: prisma },
        { provide: DevicesService, useValue: devicesService },
        { provide: AutomationService, useValue: automationService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<TempHumidityService>(TempHumidityService);
  });

  it('should update metadata, insert reading into database, and emit WebSocket state event', async () => {
    await service.handleState(mockDevice, { temperature: 29.2, humidity: 65 });

    expect(devicesService.updateMetadata).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ temperature: 29.2, humidity: 65 }),
    );

    expect(prisma.tempHumidityReading.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deviceId: 1,
        temperature: 29.2,
        humidity: 65,
      }),
    });

    expect(eventsGateway.emitDeviceState).toHaveBeenCalledWith({
      deviceUid: 'th-001',
      deviceType: 'TEMP_HUMIDITY',
      state: expect.objectContaining({ temperature: 29.2, humidity: 65 }),
    });

    expect(automationService.evaluateSensorRules).toHaveBeenCalledWith(1, 'temperature', 29.2);
    expect(automationService.evaluateSensorRules).toHaveBeenCalledWith(1, 'humidity', 65);
  });

  it('should parse and save temperature and humidity even if provided as strings', async () => {
    await service.handleState(mockDevice, { temperature: '24.0', humidity: '40.0' });

    expect(prisma.tempHumidityReading.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deviceId: 1,
        temperature: 24.0,
        humidity: 40.0,
      }),
    });
  });

  it('should query historical readings from database with timeframe filter', async () => {
    const history = await service.getHistory('th-001', { timeframe: '1h', limit: 50 });

    expect(devicesService.findByDeviceUid).toHaveBeenCalledWith('th-001');
    expect(prisma.tempHumidityReading.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deviceId: 1 }),
        take: 50,
      }),
    );
    expect(history.length).toBe(2);
  });

  it('should compute min, max, avg statistics correctly', async () => {
    const stats = await service.getStats('th-001');

    expect(stats.deviceUid).toBe('th-001');
    expect(stats.stats.tempMin).toBe(28.0);
    expect(stats.stats.tempMax).toBe(30.0);
    expect(stats.stats.tempAvg).toBe(29.0);
    expect(stats.stats.humMin).toBe(60.0);
    expect(stats.stats.humMax).toBe(70.0);
    expect(stats.stats.humAvg).toBe(65.0);
    expect(stats.stats.totalReadings).toBe(2);
  });
});
