import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateHomeDto } from './dto/create-home.dto';
import { UpdateHomeDto } from './dto/update-home.dto';
import { Home } from '@prisma/client';

@Injectable()
export class HomesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHomeDto): Promise<Home> {
    return this.prisma.home.create({
      data: {
        name: dto.name,
        address: dto.address,
      },
    });
  }

  async findAll(): Promise<Home[]> {
    return this.prisma.home.findMany({
      include: {
        _count: {
          select: { rooms: true, automations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number): Promise<Home> {
    const home = await this.prisma.home.findUnique({
      where: { id },
      include: {
        rooms: true,
      },
    });

    if (!home) {
      throw new NotFoundException(`Home with ID ${id} not found`);
    }

    return home;
  }

  async update(id: number, dto: UpdateHomeDto): Promise<Home> {
    await this.findOne(id);

    return this.prisma.home.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number): Promise<{ message: string; id: number }> {
    await this.findOne(id);

    await this.prisma.home.delete({
      where: { id },
    });

    return { message: `Home with ID ${id} deleted successfully`, id };
  }
}
