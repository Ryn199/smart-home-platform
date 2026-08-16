import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSensorDto {
  @ApiPropertyOptional({ description: 'Updated sensor name', example: 'Main Climate Temperature' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Updated sensor type', example: 'temperature' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  type?: string;

  @ApiPropertyOptional({ description: 'Updated measurement unit', example: '°C' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: 'Reassign to another device ID', example: 2 })
  @IsInt()
  @IsOptional()
  deviceId?: number;
}
