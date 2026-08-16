import { IsEnum, IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export enum CurtainMotorState {
  OPENING = 'opening',
  CLOSING = 'closing',
  STOPPED = 'stopped',
}

export class SmartCurtainStateDto {
  @IsInt()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  position!: number; // 0 = fully closed, 100 = fully open

  @IsEnum(CurtainMotorState)
  @IsNotEmpty()
  state!: CurtainMotorState;
}
