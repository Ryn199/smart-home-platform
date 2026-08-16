import { Test, TestingModule } from '@nestjs/testing';
import { MqttService } from './mqtt.service';
import { ConfigService } from '@nestjs/config';

describe('MqttService', () => {
  let service: MqttService;
  let configService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'MQTT_BROKER_URL') return 'mqtt://localhost:1883';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MqttService, { provide: ConfigService, useValue: configService }],
    }).compile();

    service = module.get<MqttService>(MqttService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildTopic', () => {
    it('should format topic correctly with string IDs', () => {
      const topic = service.buildTopic('home-01', 'living-room', 'esp-001', 'telemetry');
      expect(topic).toBe('home/home-01/living-room/esp-001/telemetry');
    });

    it('should format topic correctly with numeric IDs', () => {
      const topic = service.buildTopic(1, 2, 'door-001', 'command');
      expect(topic).toBe('home/1/2/door-001/command');
    });

    it('should format state topic correctly', () => {
      const topic = service.buildTopic('1', '1', 'curtain-001', 'state');
      expect(topic).toBe('home/1/1/curtain-001/state');
    });
  });

  describe('parseTopic', () => {
    it('should correctly parse standard 5-part topic', () => {
      const result = service.parseTopic('home/1/2/door-001/command');
      expect(result).toEqual({
        homeId: '1',
        roomId: '2',
        deviceUid: 'door-001',
        messageType: 'command',
      });
    });

    it('should return null for non-home topics', () => {
      const result = service.parseTopic('other/1/2/door-001/command');
      expect(result).toBeNull();
    });

    it('should return null for short topics', () => {
      const result = service.parseTopic('home/1/2');
      expect(result).toBeNull();
    });
  });

  describe('handlers', () => {
    it('should invoke registered handler on incoming message', () => {
      const mockHandler = jest.fn();
      service.registerHandler(mockHandler);

      // Invoke private method for testing message dispatch
      const topic = 'home/1/2/esp-001/telemetry';
      const payload = Buffer.from(JSON.stringify({ temperature: 25.5 }));

      // @ts-expect-error accessing private method for testing
      service.handleIncomingMessage(topic, payload);

      expect(mockHandler).toHaveBeenCalledWith(
        {
          homeId: '1',
          roomId: '2',
          deviceUid: 'esp-001',
          messageType: 'telemetry',
        },
        topic,
        payload,
      );
    });

    it('should ignore non-standard topics when dispatching', () => {
      const mockHandler = jest.fn();
      service.registerHandler(mockHandler);

      // @ts-expect-error accessing private method for testing
      service.handleIncomingMessage('invalid/topic', Buffer.from('test'));

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});
