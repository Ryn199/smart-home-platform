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
import { HomesService } from './homes.service';
import { CreateHomeDto } from './dto/create-home.dto';
import { UpdateHomeDto } from './dto/update-home.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Home } from '@prisma/client';

@Controller('homes')
@UseGuards(JwtAuthGuard)
export class HomesController {
  constructor(private readonly homesService: HomesService) {}

  @Post()
  async create(@Body() dto: CreateHomeDto): Promise<Home> {
    return this.homesService.create(dto);
  }

  @Get()
  async findAll(): Promise<Home[]> {
    return this.homesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Home> {
    return this.homesService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHomeDto): Promise<Home> {
    return this.homesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; id: number }> {
    return this.homesService.remove(id);
  }
}
