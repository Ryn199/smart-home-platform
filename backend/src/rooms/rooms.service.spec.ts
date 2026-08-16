import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../database/prisma.service';
import { HomesService } from '../homes/homes.service';
import { NotFoundException } from '@nestjs/common';

describe('RoomsService', () => {
  let service: RoomsService;
  let prisma: {
    room: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let homesService: {
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      room: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    homesService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: PrismaService, useValue: prisma },
        { provide: HomesService, useValue: homesService },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInHome', () => {
    it('should create a room if home exists', async () => {
      homesService.findOne.mockResolvedValue({ id: 1, name: 'Main House' });
      const mockRoom = { id: 1, homeId: 1, name: 'Living Room' };
      prisma.room.create.mockResolvedValue(mockRoom);

      const result = await service.createInHome(1, { name: 'Living Room' });
      expect(result).toEqual(mockRoom);
      expect(homesService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException if home does not exist', async () => {
      homesService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.createInHome(999, { name: 'Living Room' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByHomeId', () => {
    it('should return rooms in home', async () => {
      homesService.findOne.mockResolvedValue({ id: 1, name: 'Main House' });
      const mockRooms = [{ id: 1, homeId: 1, name: 'Living Room' }];
      prisma.room.findMany.mockResolvedValue(mockRooms);

      const result = await service.findByHomeId(1);
      expect(result).toEqual(mockRooms);
    });
  });

  describe('findOne', () => {
    it('should return room if found', async () => {
      const mockRoom = { id: 1, name: 'Living Room', home: {}, devices: [] };
      prisma.room.findUnique.mockResolvedValue(mockRoom);

      const result = await service.findOne(1);
      expect(result).toEqual(mockRoom);
    });

    it('should throw NotFoundException if room not found', async () => {
      prisma.room.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update room', async () => {
      const mockRoom = { id: 1, name: 'Living Room' };
      prisma.room.findUnique.mockResolvedValue(mockRoom);
      prisma.room.update.mockResolvedValue({ ...mockRoom, name: 'Master Bedroom' });

      const result = await service.update(1, { name: 'Master Bedroom' });
      expect(result.name).toBe('Master Bedroom');
    });
  });

  describe('remove', () => {
    it('should delete room', async () => {
      const mockRoom = { id: 1, name: 'Living Room' };
      prisma.room.findUnique.mockResolvedValue(mockRoom);
      prisma.room.delete.mockResolvedValue(mockRoom);

      const result = await service.remove(1);
      expect(result).toEqual({ message: 'Room with ID 1 deleted successfully', id: 1 });
    });
  });
});
