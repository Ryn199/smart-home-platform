import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { HomesService } from '../homes/homes.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly homesService: HomesService,
  ) {}

  async createInHome(homeId: number, dto: CreateRoomDto): Promise<Room> {
    // Validate home exists
    await this.homesService.findOne(homeId);

    return this.prisma.room.create({
      data: {
        name: dto.name,
        homeId,
      },
    });
  }

  async findByHomeId(homeId: number): Promise<Room[]> {
    // Validate home exists
    await this.homesService.findOne(homeId);

    return this.prisma.room.findMany({
      where: { homeId },
      include: {
        _count: {
          select: { devices: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: number): Promise<Room> {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        home: true,
        devices: true,
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    return room;
  }

  async update(id: number, dto: UpdateRoomDto): Promise<Room> {
    await this.findOne(id);

    return this.prisma.room.update({
      where: { id },
      data: {
        name: dto.name,
      },
    });
  }

  async remove(id: number): Promise<{ message: string; id: number }> {
    await this.findOne(id);

    await this.prisma.room.delete({
      where: { id },
    });

    return { message: `Room with ID ${id} deleted successfully`, id };
  }
}
