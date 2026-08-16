import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { PrismaService } from '../database/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RoomsService, useValue: roomsService },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      };
      prisma.device.create.mockResolvedValue(mockDevice);

      const result = await service.create({
        roomId: 1,
        name: 'Door Lock',
        deviceUid: 'door-001',
        deviceType: DeviceType.SMART_DOOR,
      });

      expect(result).toEqual(mockDevice);
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
    it('should return all devices', async () => {
      const mockDevices = [{ id: 1, name: 'Sensor 1', deviceType: DeviceType.CUSTOM_SENSOR }];
      prisma.device.findMany.mockResolvedValue(mockDevices);

      const result = await service.findAll();
      expect(result).toEqual(mockDevices);
    });

    it('should filter by deviceType', async () => {
      const mockDevices = [{ id: 1, name: 'Fan', deviceType: DeviceType.EXHAUST_FAN }];
      prisma.device.findMany.mockResolvedValue(mockDevices);

      const result = await service.findAll({ deviceType: DeviceType.EXHAUST_FAN });
      expect(result).toEqual(mockDevices);
      expect(prisma.device.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deviceType: DeviceType.EXHAUST_FAN }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a device by id', async () => {
      const mockDevice = { id: 1, name: 'Curtain 1' };
      prisma.device.findUnique.mockResolvedValue(mockDevice);

      const result = await service.findOne(1);
      expect(result).toEqual(mockDevice);
    });

    it('should throw NotFoundException if device not found', async () => {
      prisma.device.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByDeviceUid', () => {
    it('should return a device by deviceUid', async () => {
      const mockDevice = { id: 1, deviceUid: 'curtain-001' };
      prisma.device.findUnique.mockResolvedValue(mockDevice);

      const result = await service.findByDeviceUid('curtain-001');
      expect(result).toEqual(mockDevice);
    });

    it('should throw NotFoundException if deviceUid not found', async () => {
      prisma.device.findUnique.mockResolvedValue(null);

      await expect(service.findByDeviceUid('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a device', async () => {
      const mockDevice = { id: 1, name: 'Old Name' };
      prisma.device.findUnique.mockResolvedValue(mockDevice);
      prisma.device.update.mockResolvedValue({ ...mockDevice, name: 'New Name' });

      const result = await service.update(1, { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });
  });

  describe('remove', () => {
    it('should delete a device', async () => {
      const mockDevice = { id: 1, name: 'To Delete' };
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
