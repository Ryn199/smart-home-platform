import { IsEnum, IsNotEmpty } from 'class-validator';

export enum DoorPhysicalState {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum DoorLockState {
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
}

export class SmartDoorStateDto {
  @IsEnum(DoorPhysicalState)
  @IsNotEmpty()
  door!: DoorPhysicalState;

  @IsEnum(DoorLockState)
  @IsNotEmpty()
  lock!: DoorLockState;
}
