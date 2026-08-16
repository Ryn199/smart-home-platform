import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TempHumidityService, TempHumidityStats } from './temp-humidity.service';
import { GetHistoryQueryDto } from './dto/get-history-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TempHumidityReading } from '@prisma/client';

@ApiTags('temp-humidity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('temp-humidity')
export class TempHumidityController {
  constructor(private readonly tempHumidityService: TempHumidityService) {}

  @Get(':deviceUid/history')
  @ApiOperation({ summary: 'Get historical temperature & humidity telemetry records' })
  @ApiResponse({ status: 200, description: 'List of historical telemetry readings' })
  async getHistory(
    @Param('deviceUid') deviceUid: string,
    @Query() query: GetHistoryQueryDto,
  ): Promise<TempHumidityReading[]> {
    return this.tempHumidityService.getHistory(deviceUid, query);
  }

  @Get(':deviceUid/stats')
  @ApiOperation({ summary: 'Get aggregated statistics (min, max, avg) for temperature & humidity' })
  @ApiResponse({ status: 200, description: 'Aggregated temperature & humidity stats' })
  async getStats(@Param('deviceUid') deviceUid: string): Promise<TempHumidityStats> {
    return this.tempHumidityService.getStats(deviceUid);
  }
}
