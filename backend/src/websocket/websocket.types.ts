export enum WsEvent {
  SENSOR_TELEMETRY = 'sensor.telemetry',
  DEVICE_STATE = 'device.state',
  DEVICE_STATUS = 'device.status',
  COMMAND_EXECUTED = 'command.executed',
}

export interface WsSensorTelemetryPayload {
  deviceUid: string;
  sensor: string;
  value: number;
  unit?: string;
  recordedAt: string | Date;
}

export interface WsDeviceStatePayload {
  deviceUid: string;
  deviceType: string;
  state: Record<string, unknown>;
}

export interface WsDeviceStatusPayload {
  deviceUid: string;
  status: string;
  lastSeenAt: string | Date;
}

export interface WsCommandPayload {
  deviceUid: string;
  command: string;
  status: string;
  executedAt: string | Date;
}
