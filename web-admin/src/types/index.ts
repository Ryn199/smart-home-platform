export type DeviceType =
  | 'TEMP_HUMIDITY'
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
  _count?: {
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

export interface DeviceCommand {
  id: number;
  deviceId: number;
  command: string;
  payload?: Record<string, unknown> | null;
  status: 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'FAILED';
  createdAt: string;
  executedAt?: string | null;
}

export interface SensorTriggerConfig {
  type: 'sensor_threshold';
  sensorType: 'temperature' | 'humidity' | string;
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

export interface AutomationRuleConfig {
  trigger?: SensorTriggerConfig;
  action?: AutomationActionConfig;
}

export interface Automation {
  id: number;
  homeId: number;
  name: string;
  enabled: boolean;
  configuration: AutomationRuleConfig;
  createdAt: string;
  updatedAt: string;
  home?: Home;
}

// Specialized Domain States
export interface TempHumidityState {
  temperature?: number;
  humidity?: number;
  lastUpdated?: string;
}

export interface SmartDoorState {
  door: 'open' | 'closed';
  lock: 'locked' | 'unlocked';
}

export interface SmartCurtainState {
  position: number; // 0 (closed) to 100 (open)
  state: 'opening' | 'closing' | 'stopped';
}

export interface ExhaustFanState {
  power: boolean;
  speed: number; // 0, 1, 2, 3
}
