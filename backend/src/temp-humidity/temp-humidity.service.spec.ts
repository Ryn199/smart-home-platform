import { Test, TestingModule } from '@nestjs/testing';
import { TempHumidityService } from './temp-humidity.service';
import { DevicesService } from '../devices/devices.service';
import { AutomationService } from '../automation/automation.service';
import { EventsGateway } from '../websocket/events.gateway';
import { Device, DeviceStatus, DeviceType } from '@prisma/client';

describe('TempHumidityService', () => {
  let service: TempHumidityService;
  let devicesService: { updateMetadata: jest.Mock };
  let automationService: { evaluateSensorRules: jest.Mock };
  let eventsGateway: { emitDeviceState: jest.Mock };

  const mockDevice: Device & { room?: { homeId?: number } } = {
    id: 1,
    roomId: 1,
    name: 'Climate Sensor',
    deviceUid: 'th-001',
    deviceType: DeviceType.TEMP_HUMIDITY,
    status: DeviceStatus.ONLINE,
    lastSeenAt: new Date(),
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    room: { homeId: 1 },
  };

  beforeEach(async () => {
    devicesService = {
      updateMetadata: jest.fn().mockResolvedValue({ ...mockDevice, metadata: { temperature: 28.5, humidity: 60 } }),
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
        { provide: DevicesService, useValue: devicesService },
        { provide: AutomationService, useValue: automationService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<TempHumidityService>(TempHumidityService);
  });

  it('should update temperature and humidity metadata and emit WebSocket state event', async () => {
    await service.handleState(mockDevice, { temperature: 29.2, humidity: 65 });

    expect(devicesService.updateMetadata).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ temperature: 29.2, humidity: 65 }),
    );

    expect(eventsGateway.emitDeviceState).toHaveBeenCalledWith({
      deviceUid: 'th-001',
      deviceType: 'TEMP_HUMIDITY',
      state: expect.objectContaining({ temperature: 29.2, humidity: 65 }),
    });

    expect(automationService.evaluateSensorRules).toHaveBeenCalledWith(1, 'temperature', 29.2);
    expect(automationService.evaluateSensorRules).toHaveBeenCalledWith(1, 'humidity', 65);
  });
});
