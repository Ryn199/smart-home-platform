import { IsEnum, IsInt, IsNotEmpty, IsOptional, Max, Min } from 'class-validator';

export enum SmartCurtainAction {
  OPEN = 'open',
  CLOSE = 'close',
  STOP = 'stop',
  SET_POSITION = 'set_position',
}

export class SmartCurtainCommandDto {
  @IsEnum(SmartCurtainAction, {
    message: 'action must be one of: open, close, stop, set_position',
  })
  @IsNotEmpty()
  action!: SmartCurtainAction;

  @IsOptional()
  @IsInt({ message: 'position must be an integer between 0 and 100' })
  @Min(0)
  @Max(100)
  position?: number;
}
