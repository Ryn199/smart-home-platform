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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AutomationService } from './automation.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Automation } from '@prisma/client';

@ApiTags('Automations')
@ApiBearerAuth('JWT-auth')
@Controller('automations')
@UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new automation rule' })
  @ApiResponse({ status: 201, description: 'Automation rule created successfully' })
  @ApiResponse({ status: 404, description: 'Home not found' })
  async create(@Body() dto: CreateAutomationDto): Promise<Automation> {
    return this.automationService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all automation rules with optional home filter' })
  @ApiResponse({ status: 200, description: 'List of automation rules' })
  async findAll(@Query('homeId') homeId?: string): Promise<Automation[]> {
    return this.automationService.findAll(homeId ? parseInt(homeId, 10) : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get automation rule details by ID' })
  @ApiResponse({ status: 200, description: 'Automation rule details' })
  @ApiResponse({ status: 404, description: 'Automation not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Automation> {
    return this.automationService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an automation rule' })
  @ApiResponse({ status: 200, description: 'Automation updated successfully' })
  @ApiResponse({ status: 404, description: 'Automation not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAutomationDto,
  ): Promise<Automation> {
    return this.automationService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an automation rule' })
  @ApiResponse({ status: 200, description: 'Automation deleted successfully' })
  @ApiResponse({ status: 404, description: 'Automation not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; id: number }> {
    return this.automationService.remove(id);
  }
}
