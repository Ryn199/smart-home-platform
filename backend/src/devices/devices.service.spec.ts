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
import { CommandStatus, DeviceStatus, DeviceType } from '@prisma/client';
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
      findFirst: jest.Mock;
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
    applyDesiredState: jest.Mock;
    getState: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      device: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
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
    exhaustFanService = { validateCommand: jest.fn(), applyDesiredState: jest.fn(), getState: jest.fn() };

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

    it('should validate and publish command for EXHAUST_FAN with direction', async () => {
      const mockDevice = {
        id: 3,
        roomId: 1,
        deviceUid: 'fan-001',
        deviceType: DeviceType.EXHAUST_FAN,
        room: { home: { id: 1 } },
      };
      prisma.device.findUnique.mockResolvedValue(mockDevice);
      exhaustFanService.validateCommand.mockReturnValue({
        action: ExhaustFanAction.ON,
        direction: 'EXHAUST',
      });
      exhaustFanService.applyDesiredState.mockResolvedValue({
        desiredPower: true,
        desiredDirection: 'EXHAUST',
      });
      exhaustFanService.getState.mockResolvedValue(null);

      const mockCommand = {
        id: 12,
        deviceId: 3,
        command: 'on',
        payload: { action: 'on', desiredPower: true, desiredDirection: 'EXHAUST', direction: 'EXHAUST' },
        status: CommandStatus.SENT,
      };
      prisma.deviceCommand.create.mockResolvedValue(mockCommand);

      const result = await service.executeCommand(3, {
        action: 'on',
        direction: 'EXHAUST',
      });

      expect(result).toEqual(mockCommand);
      expect(exhaustFanService.validateCommand).toHaveBeenCalledWith('on', undefined);
    });

    it('should throw NotFoundException if device not found', async () => {
      prisma.device.findUnique.mockResolvedValue(null);

      await expect(service.executeCommand(999, { action: 'unlock' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Hardware Authentication & Pairing', () => {
    it('should find device by pairing code', async () => {
      const mockDevice = {
        id: 1,
        name: 'Sensor 1',
        deviceUid: 'th-001',
        pairingCode: 'TH-7788',
        macAddress: null,
        status: 'ONLINE',
        lastSeenAt: new Date(),
      };
      prisma.device.findFirst = jest.fn().mockResolvedValue(mockDevice);

      const result = await service.findByPairingCode('TH-7788');
      expect(result).toBeDefined();
      expect(result?.pairingCode).toBe('TH-7788');
      expect(prisma.device.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pairingCode: 'TH-7788' } }),
      );
    });

    it('should bind hardware MAC address', async () => {
      const mockDevice = {
        id: 1,
        name: 'Sensor 1',
        deviceUid: 'th-001',
        macAddress: '24:6F:28:1A:3B:4C',
        status: 'ONLINE',
        lastSeenAt: new Date(),
      };
      prisma.device.update.mockResolvedValue(mockDevice);

      const result = await service.bindMacAddress(1, '24:6F:28:1A:3B:4C');
      expect(result.macAddress).toBe('24:6F:28:1A:3B:4C');
      expect(prisma.device.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { macAddress: '24:6F:28:1A:3B:4C' },
        }),
      );
    });

    it('should reset auth by setting macAddress to null', async () => {
      const mockDevice = {
        id: 1,
        name: 'Sensor 1',
        deviceUid: 'th-001',
        macAddress: '24:6F:28:1A:3B:4C',
        status: 'ONLINE',
        lastSeenAt: new Date(),
      };
      prisma.device.findUnique.mockResolvedValue(mockDevice);
      prisma.device.update.mockResolvedValue({
        ...mockDevice,
        macAddress: null,
      });

      const result = await service.resetAuth(1);
      expect(result.macAddress).toBeNull();
      expect(prisma.device.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: {
            macAddress: null,
            lastSeenAt: null,
            status: DeviceStatus.UNKNOWN,
          },
        }),
      );
    });
  });
});
