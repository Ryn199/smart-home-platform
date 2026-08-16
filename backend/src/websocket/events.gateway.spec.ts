import { Test, TestingModule } from '@nestjs/testing';
import { EventsGateway } from './events.gateway';
import { WsEvent } from './websocket.types';

import { Server } from 'socket.io';

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let mockServer: {
    emit: jest.Mock;
  };

  beforeEach(async () => {
    mockServer = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsGateway],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);
    gateway.server = mockServer as unknown as Server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('emitTelemetry', () => {
    it('should broadcast sensor.telemetry event', () => {
      const payload = {
        deviceUid: 'sensor-001',
        sensor: 'temperature',
        value: 28.5,
        unit: '°C',
        recordedAt: new Date(),
      };

      gateway.emitTelemetry(payload);
      expect(mockServer.emit).toHaveBeenCalledWith(WsEvent.SENSOR_TELEMETRY, payload);
    });
  });

  describe('emitDeviceState', () => {
    it('should broadcast device.state event', () => {
      const payload = {
        deviceUid: 'door-001',
        deviceType: 'SMART_DOOR',
        state: { door: 'closed', lock: 'locked' },
      };

      gateway.emitDeviceState(payload);
      expect(mockServer.emit).toHaveBeenCalledWith(WsEvent.DEVICE_STATE, payload);
    });
  });

  describe('emitDeviceStatus', () => {
    it('should broadcast device.status event', () => {
      const payload = {
        deviceUid: 'esp-001',
        status: 'online',
        lastSeenAt: new Date(),
      };

      gateway.emitDeviceStatus(payload);
      expect(mockServer.emit).toHaveBeenCalledWith(WsEvent.DEVICE_STATUS, payload);
    });
  });

  describe('emitCommandExecuted', () => {
    it('should broadcast command.executed event', () => {
      const payload = {
        deviceUid: 'fan-001',
        command: 'set_speed',
        status: 'SENT',
        executedAt: new Date(),
      };

      gateway.emitCommandExecuted(payload);
      expect(mockServer.emit).toHaveBeenCalledWith(WsEvent.COMMAND_EXECUTED, payload);
    });
  });
});
