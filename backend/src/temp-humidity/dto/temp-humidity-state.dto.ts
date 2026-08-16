import { IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TempHumidityStateDto {
  @ApiPropertyOptional({ description: 'Temperature reading in Celsius (°C)', example: 28.5 })
  @IsNumber()
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: 'Relative humidity reading in percent (%)', example: 65.0 })
  @IsNumber()
  @IsOptional()
  humidity?: number;
}
