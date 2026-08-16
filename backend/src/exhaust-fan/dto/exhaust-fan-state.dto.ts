import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum DuctPosition {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  OPENING = 'OPENING',
  CLOSING = 'CLOSING',
  UNKNOWN = 'UNKNOWN',
  ERROR = 'ERROR',
}

export enum FanOperationState {
  BOOTING = 'BOOTING',
  IDLE = 'IDLE',
  OPENING_DUCT = 'OPENING_DUCT',
  CLOSING_DUCT = 'CLOSING_DUCT',
  STOPPING_FAN = 'STOPPING_FAN',
  WAITING_MOTOR_STOP = 'WAITING_MOTOR_STOP',
  CHANGING_DIRECTION = 'CHANGING_DIRECTION',
  WAITING_RELAY_SETTLE = 'WAITING_RELAY_SETTLE',
  STARTING_FAN = 'STARTING_FAN',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR',
}

export enum FanErrorCode {
  NONE = 'NONE',
  DUCT_OPEN_TIMEOUT = 'DUCT_OPEN_TIMEOUT',
  DUCT_CLOSE_TIMEOUT = 'DUCT_CLOSE_TIMEOUT',
  DUCT_POSITION_INVALID = 'DUCT_POSITION_INVALID',
  SERVO_ERROR = 'SERVO_ERROR',
  MOTOR_STOP_TIMEOUT = 'MOTOR_STOP_TIMEOUT',
  DIRECTION_CHANGE_ERROR = 'DIRECTION_CHANGE_ERROR',
  MQTT_ERROR = 'MQTT_ERROR',
  BACKEND_STATE_SYNC_ERROR = 'BACKEND_STATE_SYNC_ERROR',
}

/** Desired state: what Web Admin last commanded */
export class ExhaustFanDesiredStateDto {
  @IsBoolean()
  desiredPower!: boolean;

  @IsEnum(['INTAKE', 'EXHAUST'])
  desiredDirection!: 'INTAKE' | 'EXHAUST';
}

/** Full actual state: reported by ESP32 via MQTT telemetry */
export class ExhaustFanStateDto {
  /** Desired power (true = ON, false = OFF) - may come from DB or ESP confirmation */
  @IsOptional()
  @IsBoolean()
  desiredPower?: boolean;

  /** Desired direction */
  @IsOptional()
  @IsEnum(['INTAKE', 'EXHAUST'])
  desiredDirection?: 'INTAKE' | 'EXHAUST';

  /** Actual current power state */
  @IsOptional()
  @IsBoolean()
  power?: boolean;

  /** Actual current direction */
  @IsOptional()
  @IsEnum(['INTAKE', 'EXHAUST'])
  direction?: 'INTAKE' | 'EXHAUST';

  /** Physical duct position */
  @IsOptional()
  @IsEnum(DuctPosition)
  ductPosition?: DuctPosition;

  /** State machine operation state */
  @IsOptional()
  @IsEnum(FanOperationState)
  operationState?: FanOperationState;

  /** Error code */
  @IsOptional()
  @IsEnum(FanErrorCode)
  errorCode?: FanErrorCode;

  /** Legacy speed field (kept for backward compatibility) */
  @IsOptional()
  speed?: number;

  /** Last state update timestamp */
  @IsOptional()
  @IsString()
  lastUpdated?: string;
}
