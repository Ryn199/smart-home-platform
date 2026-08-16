import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum FanPower {
  ON = 'ON',
  OFF = 'OFF',
}

export enum FanDirection {
  INTAKE = 'INTAKE',
  EXHAUST = 'EXHAUST',
}

export enum ExhaustFanAction {
  ON = 'on',
  OFF = 'off',
  SET_DIRECTION = 'set_direction',
  INTAKE = 'intake',
  EXHAUST = 'exhaust',
}

export class ExhaustFanCommandDto {
  @IsEnum(ExhaustFanAction, {
    message: 'action must be one of: on, off, set_direction, intake, exhaust',
  })
  action!: ExhaustFanAction;

  @IsOptional()
  @IsEnum(FanDirection, {
    message: 'direction must be INTAKE or EXHAUST',
  })
  direction?: FanDirection;

  @IsOptional()
  @IsString()
  speed?: string;
}
