import { IsEnum, IsInt, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { DeviceStatus, DeviceType } from '@prisma/client';

export class UpdateDeviceDto {
  @IsInt({ message: 'Room ID must be an integer' })
  @IsOptional()
  roomId?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsEnum(DeviceType, {
    message: `deviceType must be one of: ${Object.values(DeviceType).join(', ')}`,
  })
  @IsOptional()
  deviceType?: DeviceType;

  @IsEnum(DeviceStatus, {
    message: `status must be one of: ${Object.values(DeviceStatus).join(', ')}`,
  })
  @IsOptional()
  status?: DeviceStatus;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
