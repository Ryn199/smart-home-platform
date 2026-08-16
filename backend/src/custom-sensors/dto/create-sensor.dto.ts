import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSensorDto {
  @ApiProperty({ description: 'ID of the device this sensor belongs to', example: 1 })
  @IsInt()
  @IsNotEmpty()
  deviceId!: number;

  @ApiProperty({ description: 'Sensor name or label', example: 'Living Room Temperature' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Sensor type / telemetry metric', example: 'temperature' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type!: string;

  @ApiPropertyOptional({ description: 'Measurement unit', example: '°C' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  unit?: string;
}
