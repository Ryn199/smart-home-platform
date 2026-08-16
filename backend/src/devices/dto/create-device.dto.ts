import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DeviceType } from '@prisma/client';

export class CreateDeviceDto {
  @IsInt({ message: 'Room ID must be an integer' })
  @IsNotEmpty({ message: 'Room ID is required' })
  roomId!: number;

  @IsString()
  @IsNotEmpty({ message: 'Device name is required' })
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Device UID is required' })
  @MaxLength(100)
  deviceUid!: string;

  @IsEnum(DeviceType, {
    message: `deviceType must be one of: ${Object.values(DeviceType).join(', ')}`,
  })
  @IsOptional()
  deviceType?: DeviceType = DeviceType.TEMP_HUMIDITY;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
