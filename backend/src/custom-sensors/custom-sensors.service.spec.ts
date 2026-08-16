import { Test, TestingModule } from '@nestjs/testing';
import { CustomSensorsService } from './custom-sensors.service';
import { PrismaService } from '../database/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { EventsGateway } from '../websocket/events.gateway';
import { AutomationService } from '../automation/automation.service';
import { NotFoundException } from '@nestjs/common';
import { Device, DeviceStatus, DeviceType } from '@prisma/client';

describe('CustomSensorsService', () => {
  let service: CustomSensorsService;
  let prisma: {
    sensor: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    sensorReading: {
      findMany: jest.Mock;
      create: jest.Mock;
    };
  };
  let devicesService: {
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      sensor: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      sensorReading: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    devicesService = {
      findOne: jest.fn(),
    };

    const eventsGateway = {
      emitTelemetry: jest.fn(),
      emitDeviceState: jest.fn(),
      emitDeviceStatus: jest.fn(),
      emitCommandExecuted: jest.fn(),
    };

    const automationService = {
      evaluateSensorRules: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomSensorsService,
        { provide: PrismaService, useValue: prisma },
        { provide: DevicesService, useValue: devicesService },
        { provide: EventsGateway, useValue: eventsGateway },
        { provide: AutomationService, useValue: automationService },
      ],
    }).compile();

    service = module.get<CustomSensorsService>(CustomSensorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSensorsByDeviceId', () => {
    it('should return sensors for existing device', async () => {
      devicesService.findOne.mockResolvedValue({ id: 1, name: 'Sensor Hub' });
      const mockSensors = [{ id: 1, type: 'temperature', unit: '°C' }];
      prisma.sensor.findMany.mockResolvedValue(mockSensors);

      const result = await service.getSensorsByDeviceId(1);
      expect(result).toEqual(mockSensors);
      expect(devicesService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException if device does not exist', async () => {
      devicesService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.getSensorsByDeviceId(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSensorById', () => {
    it('should return sensor if found', async () => {
      const mockSensor = { id: 1, type: 'humidity', unit: '%' };
      prisma.sensor.findUnique.mockResolvedValue(mockSensor);

      const result = await service.getSensorById(1);
      expect(result).toEqual(mockSensor);
    });

    it('should throw NotFoundException if sensor not found', async () => {
      prisma.sensor.findUnique.mockResolvedValue(null);

      await expect(service.getSensorById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSensorReadings', () => {
    it('should return readings with date filters and limit', async () => {
      const mockSensor = { id: 1, type: 'temperature', unit: '°C' };
      prisma.sensor.findUnique.mockResolvedValue(mockSensor);

      const mockReadings = [{ id: 1, sensorId: 1, value: 25.5, recordedAt: new Date() }];
      prisma.sensorReading.findMany.mockResolvedValue(mockReadings);

      const result = await service.getSensorReadings(1, {
        from: '2026-08-16T00:00:00.000Z',
        to: '2026-08-16T23:59:59.000Z',
        limit: 50,
      });

      expect(result.sensor).toEqual(mockSensor);
      expect(result.total).toBe(1);
      expect(result.readings).toEqual(mockReadings);
      expect(prisma.sensorReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          orderBy: { recordedAt: 'desc' },
        }),
      );
    });
  });

  describe('handleTelemetry', () => {
    it('should create new sensor and record reading', async () => {
      const mockDevice: Device = {
        id: 1,
        roomId: 1,
        name: 'Sensor Node',
        deviceUid: 'sensor-001',
        deviceType: DeviceType.CUSTOM_SENSOR,
        status: DeviceStatus.ONLINE,
        lastSeenAt: new Date(),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.sensor.findFirst.mockResolvedValue(null);
      prisma.sensor.create.mockResolvedValue({
        id: 10,
        deviceId: 1,
        type: 'temperature',
        name: 'Temperature',
        unit: '°C',
      });
      prisma.sensorReading.create.mockResolvedValue({
        id: 100,
        sensorId: 10,
        value: 26.5,
        recordedAt: new Date(),
      });

      await service.handleTelemetry(mockDevice, { temperature: 26.5 });

      expect(prisma.sensor.create).toHaveBeenCalled();
      expect(prisma.sensorReading.create).toHaveBeenCalled();
    });
  });
});
