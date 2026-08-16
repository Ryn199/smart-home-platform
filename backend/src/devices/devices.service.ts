import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Device, DeviceStatus, DeviceType, Prisma } from '@prisma/client';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
  ) {}

  async create(dto: CreateDeviceDto): Promise<Device> {
    // 1. Validate room exists
    await this.roomsService.findOne(dto.roomId);

    // 2. Check if deviceUid is already taken
    const existing = await this.prisma.device.findUnique({
      where: { deviceUid: dto.deviceUid },
    });

    if (existing) {
      throw new ConflictException(`Device with UID "${dto.deviceUid}" is already registered`);
    }

    // 3. Create device
    return this.prisma.device.create({
      data: {
        roomId: dto.roomId,
        name: dto.name,
        deviceUid: dto.deviceUid,
        deviceType: dto.deviceType ?? DeviceType.CUSTOM_SENSOR,
        status: DeviceStatus.UNKNOWN,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        room: {
          include: {
            home: true,
          },
        },
      },
    });
  }

  async findAll(filter?: { roomId?: number; deviceType?: DeviceType }): Promise<Device[]> {
    const where: Prisma.DeviceWhereInput = {};

    if (filter?.roomId) {
      where.roomId = filter.roomId;
    }

    if (filter?.deviceType) {
      where.deviceType = filter.deviceType;
    }

    return this.prisma.device.findMany({
      where,
      include: {
        room: {
          include: {
            home: true,
          },
        },
        _count: {
          select: { sensors: true, commands: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number): Promise<Device> {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: {
        room: {
          include: {
            home: true,
          },
        },
        sensors: true,
      },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    return device;
  }

  async findByDeviceUid(deviceUid: string): Promise<Device> {
    const device = await this.prisma.device.findUnique({
      where: { deviceUid },
      include: {
        room: {
          include: {
            home: true,
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException(`Device with UID "${deviceUid}" not found`);
    }

    return device;
  }

  async findByRoomId(roomId: number): Promise<Device[]> {
    // Validate room exists
    await this.roomsService.findOne(roomId);

    return this.prisma.device.findMany({
      where: { roomId },
      include: {
        _count: {
          select: { sensors: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: number, dto: UpdateDeviceDto): Promise<Device> {
    await this.findOne(id);

    if (dto.roomId) {
      await this.roomsService.findOne(dto.roomId);
    }

    const data: Prisma.DeviceUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.deviceType !== undefined) data.deviceType = dto.deviceType;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.roomId !== undefined) data.room = { connect: { id: dto.roomId } };
    if (dto.metadata !== undefined) {
      data.metadata = dto.metadata as Prisma.InputJsonValue;
    }

    return this.prisma.device.update({
      where: { id },
      data,
      include: {
        room: {
          include: {
            home: true,
          },
        },
      },
    });
  }

  async updateLastSeen(
    deviceUid: string,
    status: DeviceStatus = DeviceStatus.ONLINE,
  ): Promise<Device> {
    return this.prisma.device.update({
      where: { deviceUid },
      data: {
        lastSeenAt: new Date(),
        status,
      },
    });
  }

  async remove(id: number): Promise<{ message: string; id: number }> {
    await this.findOne(id);

    await this.prisma.device.delete({
      where: { id },
    });

    return { message: `Device with ID ${id} deleted successfully`, id };
  }
}
