import { IsEnum, IsNotEmpty } from 'class-validator';

export enum SmartDoorAction {
  LOCK = 'lock',
  UNLOCK = 'unlock',
}

export class SmartDoorCommandDto {
  @IsEnum(SmartDoorAction, {
    message: 'action must be either "lock" or "unlock"',
  })
  @IsNotEmpty()
  action!: SmartDoorAction;
}
