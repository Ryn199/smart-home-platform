import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HomesService } from './homes.service';
import { CreateHomeDto } from './dto/create-home.dto';
import { UpdateHomeDto } from './dto/update-home.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Home } from '@prisma/client';

@ApiTags('Homes')
@ApiBearerAuth('JWT-auth')
@Controller('homes')
@UseGuards(JwtAuthGuard)
export class HomesController {
  constructor(private readonly homesService: HomesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new home' })
  @ApiResponse({ status: 201, description: 'Home created successfully' })
  async create(@Body() dto: CreateHomeDto): Promise<Home> {
    return this.homesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all homes' })
  @ApiResponse({ status: 200, description: 'List of homes' })
  async findAll(): Promise<Home[]> {
    return this.homesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get home details by ID' })
  @ApiResponse({ status: 200, description: 'Home details' })
  @ApiResponse({ status: 404, description: 'Home not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Home> {
    return this.homesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update home details' })
  @ApiResponse({ status: 200, description: 'Home updated successfully' })
  @ApiResponse({ status: 404, description: 'Home not found' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHomeDto): Promise<Home> {
    return this.homesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a home' })
  @ApiResponse({ status: 200, description: 'Home deleted successfully' })
  @ApiResponse({ status: 404, description: 'Home not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; id: number }> {
    return this.homesService.remove(id);
  }
}
