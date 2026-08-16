import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Timeframe filter for historical readings',
    enum: ['1h', '24h', '7d', 'custom', 'all'],
    default: '1h',
  })
  @IsOptional()
  @IsIn(['1h', '24h', '7d', 'custom', 'all'])
  timeframe?: '1h' | '24h' | '7d' | 'custom' | 'all' = '1h';

  @ApiPropertyOptional({
    description: 'Custom range start date (ISO string or YYYY-MM-DDTHH:mm:ss)',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Custom range end date (ISO string or YYYY-MM-DDTHH:mm:ss)',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of historical points to return',
    default: 200,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 200;
}
