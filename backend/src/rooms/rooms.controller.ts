import {
  BadRequestException,
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
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Room } from '@prisma/client';

@ApiTags('Rooms')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post('rooms')
  @ApiOperation({ summary: 'Create a room (direct)' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  async createDirect(@Body() dto: CreateRoomDto): Promise<Room> {
    if (!dto.homeId) {
      throw new BadRequestException('homeId is required');
    }
    return this.roomsService.createInHome(dto.homeId, { name: dto.name });
  }

  @Get('rooms')
  @ApiOperation({ summary: 'List all rooms across all homes' })
  @ApiResponse({ status: 200, description: 'List of all rooms' })
  async findAll(): Promise<Room[]> {
    return this.roomsService.findAll();
  }

  @Post('homes/:homeId/rooms')
  @ApiOperation({ summary: 'Create a room inside a home' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 404, description: 'Home not found' })
  async createForHome(
    @Param('homeId', ParseIntPipe) homeId: number,
    @Body() dto: CreateRoomDto,
  ): Promise<Room> {
    return this.roomsService.createInHome(homeId, dto);
  }

  @Get('homes/:homeId/rooms')
  @ApiOperation({ summary: 'List all rooms in a home' })
  @ApiResponse({ status: 200, description: 'List of rooms' })
  @ApiResponse({ status: 404, description: 'Home not found' })
  async findByHomeId(@Param('homeId', ParseIntPipe) homeId: number): Promise<Room[]> {
    return this.roomsService.findByHomeId(homeId);
  }

  @Get('rooms/:id')
  @ApiOperation({ summary: 'Get room details by ID' })
  @ApiResponse({ status: 200, description: 'Room details' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Room> {
    return this.roomsService.findOne(id);
  }

  @Patch('rooms/:id')
  @ApiOperation({ summary: 'Update room details' })
  @ApiResponse({ status: 200, description: 'Room updated successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoomDto): Promise<Room> {
    return this.roomsService.update(id, dto);
  }

  @Delete('rooms/:id')
  @ApiOperation({ summary: 'Delete a room' })
  @ApiResponse({ status: 200, description: 'Room deleted successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; id: number }> {
    return this.roomsService.remove(id);
  }
}
