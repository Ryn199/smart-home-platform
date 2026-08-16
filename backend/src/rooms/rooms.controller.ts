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
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Room } from '@prisma/client';

@Controller()
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('homes/:homeId/rooms')
  async findByHomeId(@Param('homeId', ParseIntPipe) homeId: number): Promise<Room[]> {
    return this.roomsService.findByHomeId(homeId);
  }

  @Post('homes/:homeId/rooms')
  async createInHome(
    @Param('homeId', ParseIntPipe) homeId: number,
    @Body() dto: CreateRoomDto,
  ): Promise<Room> {
    return this.roomsService.createInHome(homeId, dto);
  }

  @Get('rooms/:id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Room> {
    return this.roomsService.findOne(id);
  }

  @Patch('rooms/:id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoomDto): Promise<Room> {
    return this.roomsService.update(id, dto);
  }

  @Delete('rooms/:id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; id: number }> {
    return this.roomsService.remove(id);
  }
}
