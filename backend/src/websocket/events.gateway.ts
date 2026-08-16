import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  WsCommandPayload,
  WsDeviceStatePayload,
  WsDeviceStatusPayload,
  WsEvent,
  WsSensorTelemetryPayload,
} from './websocket.types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized.');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected to WebSocket: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected from WebSocket: ${client.id}`);
  }

  emitTelemetry(payload: WsSensorTelemetryPayload): void {
    if (this.server) {
      this.server.emit(WsEvent.SENSOR_TELEMETRY, payload);
      this.logger.debug?.(
        `WebSocket [${WsEvent.SENSOR_TELEMETRY}]: ${payload.deviceUid} ${payload.sensor}=${payload.value}`,
      );
    }
  }

  emitDeviceState(payload: WsDeviceStatePayload): void {
    if (this.server) {
      this.server.emit(WsEvent.DEVICE_STATE, payload);
      this.logger.debug?.(
        `WebSocket [${WsEvent.DEVICE_STATE}]: ${payload.deviceUid} (${payload.deviceType})`,
      );
    }
  }

  emitDeviceStatus(payload: WsDeviceStatusPayload): void {
    if (this.server) {
      this.server.emit(WsEvent.DEVICE_STATUS, payload);
      this.logger.debug?.(
        `WebSocket [${WsEvent.DEVICE_STATUS}]: ${payload.deviceUid} -> ${payload.status}`,
      );
    }
  }

  emitCommandExecuted(payload: WsCommandPayload): void {
    if (this.server) {
      this.server.emit(WsEvent.COMMAND_EXECUTED, payload);
      this.logger.debug?.(
        `WebSocket [${WsEvent.COMMAND_EXECUTED}]: ${payload.deviceUid} -> ${payload.command}`,
      );
    }
  }
}
