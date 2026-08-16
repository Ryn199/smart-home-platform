import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { PrismaService } from '../database/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { ConfigService } from '@nestjs/config';
import { MqttService } from '../mqtt/mqtt.service';
import { EventsGateway } from '../websocket/events.gateway';
import { SmartDoorService } from '../smart-door/smart-door.service';
import { SmartCurtainService } from '../smart-curtain/smart-curtain.service';
import { ExhaustFanService } from '../exhaust-fan/exhaust-fan.service';
import { NotFoundException } from '@nestjs/common';
import { CommandStatus, DeviceType } from '@prisma/client';
import { SmartDoorAction } from '../smart-door/dto/smart-door-command.dto';
import { SmartCurtainAction } from '../smart-curtain/dto/smart-curtain-command.dto';
import { ExhaustFanAction } from '../exhaust-fan/dto/exhaust-fan-command.dto';

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
    deviceCommand: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let roomsService: {
    findOne: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };
  let mqttService: {
    buildTopic: jest.Mock;
    publish: jest.Mock;
  };
  let smartDoorService: {
    validateCommand: jest.Mock;
  };
  let smartCurtainService: {
    validateCommand: jest.Mock;
  };
  let exhaustFanService: {
    validateCommand: jest.Mock;
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
      deviceCommand: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    roomsService = { findOne: jest.fn() };
    configService = {
      get: jest.fn().mockImplementation((key: string, defaultVal: number) => {
        if (key === 'DEVICE_OFFLINE_THRESHOLD_SECONDS') return 60;
        return defaultVal;
      }),
    };
    mqttService = {
      buildTopic: jest.fn().mockReturnValue('home/1/1/door-001/command'),
      publish: jest.fn().mockResolvedValue(undefined),
    };
    const eventsGateway = {
      emitCommandExecuted: jest.fn(),
      emitDeviceState: jest.fn(),
      emitDeviceStatus: jest.fn(),
      emitTelemetry: jest.fn(),
    };
    smartDoorService = { validateCommand: jest.fn() };
    smartCurtainService = { validateCommand: jest.fn() };
    exhaustFanService = { validateCommand: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RoomsService, useValue: roomsService },
        { provide: ConfigService, useValue: configService },
        { provide: MqttService, useValue: mqttService },
        { provide: EventsGateway, useValue: eventsGateway },
        { provide: SmartDoorService, useValue: smartDoorService },
        { provide: SmartCurtainService, useValue: smartCurtainService },
        { provide: ExhaustFanService, useValue: exhaustFanService },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeCommand', () => {
    it('should validate and publish command for SMART_DOOR', async () => {
      const mockDevice = {
        id: 1,
        roomId: 1,
        deviceUid: 'door-001',
        deviceType: DeviceType.SMART_DOOR,
        room: { home: { id: 1 } },
      };
      prisma.device.findUnique.mockResolvedValue(mockDevice);
      smartDoorService.validateCommand.mockReturnValue({ action: SmartDoorAction.UNLOCK });

      const mockCommand = {
        id: 10,
        deviceId: 1,
        command: 'unlock',
        payload: { action: 'unlock' },
        status: CommandStatus.SENT,
      };
      prisma.deviceCommand.create.mockResolvedValue(mockCommand);

      const result = await service.executeCommand(1, { action: 'unlock' });

      expect(result).toEqual(mockCommand);
      expect(smartDoorService.validateCommand).toHaveBeenCalledWith('unlock');
      expect(mqttService.publish).toHaveBeenCalledWith('home/1/1/door-001/command', {
        action: 'unlock',
      });
    });

    it('should validate and publish command for SMART_CURTAIN with position', async () => {
      const mockDevice = {
        id: 2,
        roomId: 1,
        deviceUid: 'curtain-001',
        deviceType: DeviceType.SMART_CURTAIN,
        room: { home: { id: 1 } },
      };
      prisma.device.findUnique.mockResolvedValue(mockDevice);
      smartCurtainService.validateCommand.mockReturnValue({
        action: SmartCurtainAction.SET_POSITION,
        position: 50,
      });

      const mockCommand = {
        id: 11,
        deviceId: 2,
        command: 'set_position',
        payload: { action: 'set_position', position: 50 },
        status: CommandStatus.SENT,
      };
      prisma.deviceCommand.create.mockResolvedValue(mockCommand);

      const result = await service.executeCommand(2, {
        action: 'set_position',
        position: 50,
      });

      expect(result).toEqual(mockCommand);
      expect(smartCurtainService.validateCommand).toHaveBeenCalledWith('set_position', 50);
    });

    it('should validate and publish command for EXHAUST_FAN with speed', async () => {
      const mockDevice = {
        id: 3,
        roomId: 1,
        deviceUid: 'fan-001',
        deviceType: DeviceType.EXHAUST_FAN,
        room: { home: { id: 1 } },
      };
      prisma.device.findUnique.mockResolvedValue(mockDevice);
      exhaustFanService.validateCommand.mockReturnValue({
        action: ExhaustFanAction.SET_SPEED,
        speed: 2,
      });

      const mockCommand = {
        id: 12,
        deviceId: 3,
        command: 'set_speed',
        payload: { action: 'set_speed', speed: 2 },
        status: CommandStatus.SENT,
      };
      prisma.deviceCommand.create.mockResolvedValue(mockCommand);

      const result = await service.executeCommand(3, {
        action: 'set_speed',
        speed: 2,
      });

      expect(result).toEqual(mockCommand);
      expect(exhaustFanService.validateCommand).toHaveBeenCalledWith('set_speed', 2);
    });

    it('should throw NotFoundException if device not found', async () => {
      prisma.device.findUnique.mockResolvedValue(null);

      await expect(service.executeCommand(999, { action: 'unlock' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
