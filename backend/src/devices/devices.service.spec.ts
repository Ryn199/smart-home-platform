import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { PrismaService } from '../database/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { ConfigService } from '@nestjs/config';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeviceStatus, DeviceType } from '@prisma/client';

describe('DevicesService', () => {
  let service: DevicesService;
  let prisma: {
    device: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let roomsService: {
    findOne: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      device: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    roomsService = {
      findOne: jest.fn(),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultVal: number) => {
        if (key === 'DEVICE_OFFLINE_THRESHOLD_SECONDS') return 60;
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RoomsService, useValue: roomsService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateStatus', () => {
    it('should return UNKNOWN if lastSeenAt is null', () => {
      expect(service.calculateStatus(null)).toBe(DeviceStatus.UNKNOWN);
    });

    it('should return ONLINE if lastSeenAt is within threshold', () => {
      const recent = new Date(Date.now() - 10 * 1000); // 10s ago
      expect(service.calculateStatus(recent)).toBe(DeviceStatus.ONLINE);
    });

    it('should return OFFLINE if lastSeenAt is older than threshold', () => {
      const old = new Date(Date.now() - 120 * 1000); // 120s ago (threshold is 60s)
      expect(service.calculateStatus(old)).toBe(DeviceStatus.OFFLINE);
    });
  });

  describe('create', () => {
    it('should successfully create a device', async () => {
      roomsService.findOne.mockResolvedValue({ id: 1, name: 'Living Room' });
      prisma.device.findUnique.mockResolvedValue(null);

      const mockDevice = {
        id: 1,
        roomId: 1,
        name: 'Door Lock',
        deviceUid: 'door-001',
        deviceType: DeviceType.SMART_DOOR,
        status: DeviceStatus.UNKNOWN,
        lastSeenAt: null,
      };
      prisma.device.create.mockResolvedValue(mockDevice);

      const result = await service.create({
        roomId: 1,
        name: 'Door Lock',
        deviceUid: 'door-001',
        deviceType: DeviceType.SMART_DOOR,
      });

      expect(result.status).toBe(DeviceStatus.UNKNOWN);
      expect(roomsService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw ConflictException on duplicate deviceUid', async () => {
      roomsService.findOne.mockResolvedValue({ id: 1, name: 'Living Room' });
      prisma.device.findUnique.mockResolvedValue({ id: 1, deviceUid: 'door-001' });

      await expect(
        service.create({
          roomId: 1,
          name: 'Door Lock',
          deviceUid: 'door-001',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if room does not exist', async () => {
      roomsService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.create({
          roomId: 999,
          name: 'Sensor Node',
          deviceUid: 'sensor-001',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all devices with dynamic status computed', async () => {
      const recent = new Date(Date.now() - 5000);
      const mockDevices = [
        { id: 1, name: 'Sensor 1', deviceType: DeviceType.CUSTOM_SENSOR, lastSeenAt: recent },
      ];
      prisma.device.findMany.mockResolvedValue(mockDevices);

      const result = await service.findAll();
      expect(result[0].status).toBe(DeviceStatus.ONLINE);
    });
  });

  describe('getPresence', () => {
    it('should return presence info with seconds since last seen', async () => {
      const recent = new Date(Date.now() - 15 * 1000);
      const mockDevice = {
        id: 1,
        deviceUid: 'curtain-001',
        name: 'Curtain',
        lastSeenAt: recent,
        status: DeviceStatus.ONLINE,
      };
      prisma.device.findUnique.mockResolvedValue(mockDevice);

      const presence = await service.getPresence(1);
      expect(presence.status).toBe(DeviceStatus.ONLINE);
      expect(presence.thresholdSeconds).toBe(60);
      expect(presence.secondsSinceLastSeen).toBeGreaterThanOrEqual(14);
    });
  });

  describe('remove', () => {
    it('should delete a device', async () => {
      const mockDevice = { id: 1, name: 'To Delete', lastSeenAt: null };
      prisma.device.findUnique.mockResolvedValue(mockDevice);
      prisma.device.delete.mockResolvedValue(mockDevice);

      const result = await service.remove(1);
      expect(result).toEqual({
        message: 'Device with ID 1 deleted successfully',
        id: 1,
      });
    });
  });
});
