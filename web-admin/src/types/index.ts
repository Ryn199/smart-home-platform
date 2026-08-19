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

export interface EspDiagnostics {
  macAddress?: string | null;
  ipAddress?: string | null;
  freeHeap?: number | null;
  minFreeHeap?: number | null;
  rssi?: number | null;
  internalTemp?: number | null;
  uptime?: number | null;
  resetReason?: string | null;
  firmwareVersion?: string | null;
  flashChipSize?: number | null;
  sketchSize?: number | null;
  cpuFreq?: number | null;
  updatedAt?: string | null;
}

export type FirmwareStatus = 'READY' | 'FLASHING' | 'ACTIVE' | 'FAILED' | 'PREVIOUS' | 'ARCHIVED';

export interface Firmware {
  id: number;
  deviceId: number;
  version: string;
  fileName: string;
  fileSize: number;
  checksum?: string | null;
  changelog?: string | null;
  isCurrent: boolean;
  uploadedAt: string;
  deployedAt?: string | null;
  status: FirmwareStatus;
}

export interface Device {
  id: number;
  roomId: number;
  name: string;
  deviceUid: string;
  macAddress?: string | null;
  ipAddress?: string | null;
  firmwareVersion?: string | null;
  pairingCode?: string | null;
  deviceType: DeviceType;
  status: DeviceStatus;
  lastSeenAt: string | null;
  metadata?: {
    diagnostics?: EspDiagnostics;
    temperature?: number;
    humidity?: number;
    [key: string]: unknown;
  } | null;
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

export type DuctPosition = 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING' | 'UNKNOWN' | 'ERROR';

export type FanOperationState =
  | 'BOOTING'
  | 'IDLE'
  | 'OPENING_DUCT'
  | 'CLOSING_DUCT'
  | 'STOPPING_FAN'
  | 'WAITING_MOTOR_STOP'
  | 'CHANGING_DIRECTION'
  | 'WAITING_RELAY_SETTLE'
  | 'STARTING_FAN'
  | 'RUNNING'
  | 'ERROR';

export type FanErrorCode =
  | 'NONE'
  | 'DUCT_OPEN_TIMEOUT'
  | 'DUCT_CLOSE_TIMEOUT'
  | 'DUCT_POSITION_INVALID'
  | 'SERVO_ERROR'
  | 'MOTOR_STOP_TIMEOUT'
  | 'DIRECTION_CHANGE_ERROR'
  | 'MQTT_ERROR'
  | 'BACKEND_STATE_SYNC_ERROR';

export interface ExhaustFanState {
  /** Desired state: what was last commanded */
  desiredPower?: boolean;
  desiredDirection?: 'INTAKE' | 'EXHAUST';

  /** Actual hardware state reported by ESP32 */
  power?: boolean;
  direction?: 'INTAKE' | 'EXHAUST';
  ductPosition?: DuctPosition;
  operationState?: FanOperationState;
  errorCode?: FanErrorCode;

  /** Legacy speed field */
  speed?: number;

  lastUpdated?: string;
}
