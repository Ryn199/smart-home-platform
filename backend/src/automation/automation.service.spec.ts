import { Test, TestingModule } from '@nestjs/testing';
import { AutomationService } from './automation.service';
import { PrismaService } from '../database/prisma.service';
import { HomesService } from '../homes/homes.service';
import { DevicesService } from '../devices/devices.service';
import { NotFoundException } from '@nestjs/common';

describe('AutomationService', () => {
  let service: AutomationService;
  let prisma: {
    automation: {
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
  let devicesService: {
    executeCommand: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      automation: {
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

    devicesService = {
      executeCommand: jest.fn().mockResolvedValue({ id: 1, status: 'SENT' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationService,
        { provide: PrismaService, useValue: prisma },
        { provide: HomesService, useValue: homesService },
        { provide: DevicesService, useValue: devicesService },
      ],
    }).compile();

    service = module.get<AutomationService>(AutomationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create automation after verifying home', async () => {
      homesService.findOne.mockResolvedValue({ id: 1, name: 'Main Home' });
      const mockAuto = {
        id: 1,
        homeId: 1,
        name: 'Auto Fan',
        enabled: true,
        configuration: {},
      };
      prisma.automation.create.mockResolvedValue(mockAuto);

      const result = await service.create({
        homeId: 1,
        name: 'Auto Fan',
        configuration: {
          trigger: {
            type: 'sensor_threshold',
            sensorType: 'temperature',
            operator: '>',
            value: 30,
          },
          action: { deviceId: 3, action: 'set_speed', speed: 2 },
        },
      });

      expect(result).toEqual(mockAuto);
      expect(homesService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException if home does not exist', async () => {
      homesService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.create({
          homeId: 999,
          name: 'Auto Fan',
          configuration: {},
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return automation by id', async () => {
      const mockAuto = { id: 1, name: 'Rule 1' };
      prisma.automation.findUnique.mockResolvedValue(mockAuto);

      const result = await service.findOne(1);
      expect(result).toEqual(mockAuto);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.automation.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('evaluateSensorRules', () => {
    it('should execute command when sensor value exceeds threshold', async () => {
      const mockAutomations = [
        {
          id: 1,
          name: 'Cool Down Living Room',
          enabled: true,
          configuration: {
            trigger: {
              type: 'sensor_threshold',
              sensorType: 'temperature',
              operator: '>',
              value: 30,
            },
            action: {
              deviceId: 5,
              action: 'set_speed',
              speed: 3,
            },
          },
        },
      ];

      prisma.automation.findMany.mockResolvedValue(mockAutomations);

      await service.evaluateSensorRules(1, 'temperature', 32.5);

      expect(devicesService.executeCommand).toHaveBeenCalledWith(5, {
        action: 'set_speed',
        speed: 3,
        position: undefined,
        payload: undefined,
      });
    });

    it('should not execute command when condition is not met', async () => {
      const mockAutomations = [
        {
          id: 1,
          name: 'Cool Down Living Room',
          enabled: true,
          configuration: {
            trigger: {
              type: 'sensor_threshold',
              sensorType: 'temperature',
              operator: '>',
              value: 30,
            },
            action: {
              deviceId: 5,
              action: 'set_speed',
              speed: 3,
            },
          },
        },
      ];

      prisma.automation.findMany.mockResolvedValue(mockAutomations);

      await service.evaluateSensorRules(1, 'temperature', 25.0);

      expect(devicesService.executeCommand).not.toHaveBeenCalled();
    });
  });
});
