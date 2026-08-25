import { Test, TestingModule } from '@nestjs/testing';
import { FirmwareService } from './firmware.service';
import { PrismaService } from '../database/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { EventsGateway } from '../websocket/events.gateway';
import { FirmwareStatus } from '@prisma/client';

describe('FirmwareService', () => {
  let service: FirmwareService;
  let prismaService: any;
  let devicesService: any;
  let eventsGateway: any;

  beforeEach(async () => {
    delete process.env.BACKEND_URL;

    prismaService = {
      firmware: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      device: {
        findUnique: jest.fn(),
      },
    };

    devicesService = {
      executeCommand: jest.fn(),
    };

    eventsGateway = {
      emitOTAStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirmwareService,
        { provide: PrismaService, useValue: prismaService },
        { provide: DevicesService, useValue: devicesService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<FirmwareService>(FirmwareService);
  });

  afterEach(() => {
    delete process.env.BACKEND_URL;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deploy', () => {
    const mockDevice = {
      id: 1,
      deviceUid: 'ESP32_CURTAIN_001',
      name: 'Smart Curtain',
    };

    const mockFirmware = {
      id: 2,
      deviceId: 1,
      version: '1.0.1',
      fileName: 'firmware_v1.0.1.bin',
      fileSize: 887344,
      checksum: 'b2655edeb44d83c5ad59922fffc579ff6420a47432ae28a5807051c43de7ad35',
      status: FirmwareStatus.ACTIVE,
    };

    beforeEach(() => {
      prismaService.device.findUnique.mockResolvedValue(mockDevice);
      prismaService.firmware.findUnique.mockResolvedValue(mockFirmware);
      prismaService.firmware.update.mockResolvedValue(mockFirmware);
      devicesService.executeCommand.mockResolvedValue({ id: 10, action: 'ota_update' });
    });

    it('should prioritize process.env.BACKEND_URL when set in environment', async () => {
      process.env.BACKEND_URL = 'http://example-backend.local:3000';

      await service.deploy(1, 2, 'http://localhost:5173');

      expect(devicesService.executeCommand).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          payload: expect.objectContaining({
            url: 'http://example-backend.local:3000/api/firmware/2/download',
          }),
        }),
      );
    });

    it('should fallback to hostUrl when BACKEND_URL is not set', async () => {
      await service.deploy(1, 2, 'http://custom-host.local:3000');

      expect(devicesService.executeCommand).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          payload: expect.objectContaining({
            url: 'http://custom-host.local:3000/api/firmware/2/download',
          }),
        }),
      );
    });
  });
});
