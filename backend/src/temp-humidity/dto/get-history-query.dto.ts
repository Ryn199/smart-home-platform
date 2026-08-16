import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Timeframe filter for historical readings',
    enum: ['1h', '24h', '7d', 'all'],
    default: '1h',
  })
  @IsOptional()
  @IsIn(['1h', '24h', '7d', 'all'])
  timeframe?: '1h' | '24h' | '7d' | 'all' = '1h';

  @ApiPropertyOptional({
    description: 'Maximum number of historical points to return',
    default: 100,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;
}
