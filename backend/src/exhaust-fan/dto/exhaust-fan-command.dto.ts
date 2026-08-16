import { IsEnum, IsInt, IsNotEmpty, IsOptional, Max, Min } from 'class-validator';

export enum ExhaustFanAction {
  ON = 'on',
  OFF = 'off',
  SET_SPEED = 'set_speed',
}

export class ExhaustFanCommandDto {
  @IsEnum(ExhaustFanAction, {
    message: 'action must be one of: on, off, set_speed',
  })
  @IsNotEmpty()
  action!: ExhaustFanAction;

  @IsOptional()
  @IsInt({ message: 'speed must be an integer between 0 and 3' })
  @Min(0)
  @Max(3)
  speed?: number;
}
