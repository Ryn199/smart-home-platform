import { Test, TestingModule } from '@nestjs/testing';
import { HomesService } from './homes.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('HomesService', () => {
  let service: HomesService;
  let prisma: {
    home: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      home: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [HomesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<HomesService>(HomesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a home', async () => {
      const mockHome = { id: 1, name: 'Main House', address: '123 Smart St' };
      prisma.home.create.mockResolvedValue(mockHome);

      const result = await service.create({ name: 'Main House', address: '123 Smart St' });
      expect(result).toEqual(mockHome);
      expect(prisma.home.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of homes', async () => {
      const mockHomes = [{ id: 1, name: 'Main House' }];
      prisma.home.findMany.mockResolvedValue(mockHomes);

      const result = await service.findAll();
      expect(result).toEqual(mockHomes);
    });
  });

  describe('findOne', () => {
    it('should return a home if found', async () => {
      const mockHome = { id: 1, name: 'Main House', rooms: [] };
      prisma.home.findUnique.mockResolvedValue(mockHome);

      const result = await service.findOne(1);
      expect(result).toEqual(mockHome);
    });

    it('should throw NotFoundException if home not found', async () => {
      prisma.home.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a home', async () => {
      const mockHome = { id: 1, name: 'Main House', rooms: [] };
      prisma.home.findUnique.mockResolvedValue(mockHome);
      prisma.home.update.mockResolvedValue({ ...mockHome, name: 'Updated House' });

      const result = await service.update(1, { name: 'Updated House' });
      expect(result.name).toBe('Updated House');
    });
  });

  describe('remove', () => {
    it('should delete a home', async () => {
      const mockHome = { id: 1, name: 'Main House', rooms: [] };
      prisma.home.findUnique.mockResolvedValue(mockHome);
      prisma.home.delete.mockResolvedValue(mockHome);

      const result = await service.remove(1);
      expect(result).toEqual({ message: 'Home with ID 1 deleted successfully', id: 1 });
    });
  });
});
