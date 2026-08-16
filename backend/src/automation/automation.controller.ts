import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AutomationService } from './automation.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Automation } from '@prisma/client';

@Controller('automations')
@UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post()
  async create(@Body() dto: CreateAutomationDto): Promise<Automation> {
    return this.automationService.create(dto);
  }

  @Get()
  async findAll(@Query('homeId') homeId?: string): Promise<Automation[]> {
    return this.automationService.findAll(homeId ? parseInt(homeId, 10) : undefined);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Automation> {
    return this.automationService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAutomationDto,
  ): Promise<Automation> {
    return this.automationService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; id: number }> {
    return this.automationService.remove(id);
  }
}
