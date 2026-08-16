export type DeviceType =
  | 'CUSTOM_SENSOR'
  | 'SMART_DOOR'
  | 'SMART_CURTAIN'
  | 'EXHAUST_FAN';

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface Home {
  id: number;
  name: string;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
  rooms?: Room[];
  _count?: {
    rooms: number;
    automations: number;
  };
}

export interface Room {
  id: number;
  homeId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  home?: Home;
  devices?: Device[];
  _count?: {
    devices: number;
  };
}

export interface Device {
  id: number;
  roomId: number;
  name: string;
  deviceUid: string;
  deviceType: DeviceType;
  status: DeviceStatus;
  lastSeenAt: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  room?: Room & { home?: Home };
  sensors?: Sensor[];
  _count?: {
    sensors: number;
    commands: number;
  };
}

export interface DevicePresenceInfo {
  id: number;
  deviceUid: string;
  name: string;
  status: DeviceStatus;
  lastSeenAt: string | null;
  thresholdSeconds: number;
  secondsSinceLastSeen: number | null;
}

export interface Sensor {
  id: number;
  deviceId: number;
  type: string;
  name: string;
  unit: string;
  createdAt: string;
  updatedAt: string;
  device?: Device;
  readings?: SensorReading[];
}

export interface SensorReading {
  id: number;
  sensorId: number;
  value: number;
  recordedAt: string;
}

export interface SensorReadingsResponse {
  sensor: Sensor;
  total: number;
  readings: SensorReading[];
}

export interface DeviceCommand {
  id: number;
  deviceId: number;
  command: string;
  payload?: Record<string, unknown> | null;
  status: 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'FAILED';
  createdAt: string;
  executedAt?: string | null;
}

export interface SmartDoorState {
  door: 'open' | 'closed';
  lock: 'locked' | 'unlocked';
}

export interface SmartCurtainState {
  position: number;
  state: 'opening' | 'closing' | 'stopped';
}

export interface ExhaustFanState {
  power: boolean;
  speed: number;
}

export interface SensorTriggerConfig {
  type: 'sensor_threshold';
  sensorType: string;
  operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
  value: number;
}

export interface AutomationActionConfig {
  deviceId: number;
  action: string;
  position?: number;
  speed?: number;
  payload?: Record<string, unknown>;
}

export interface Automation {
  id: number;
  homeId: number;
  name: string;
  enabled: boolean;
  configuration: {
    trigger?: SensorTriggerConfig;
    action?: AutomationActionConfig;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
  home?: Home;
}
