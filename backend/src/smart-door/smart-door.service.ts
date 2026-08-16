import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SmartDoorStateDto } from './dto/smart-door-state.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SmartDoorService {
  constructor(private readonly prisma: PrismaService) {}

  async updateState(deviceUid: string, state: SmartDoorStateDto) {
    return this.prisma.device.update({
      where: { deviceUid },
      data: {
        metadata: state as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getState(deviceUid: string): Promise<SmartDoorStateDto | null> {
    const device = await this.prisma.device.findUnique({
      where: { deviceUid },
      select: { metadata: true },
    });

    return (device?.metadata as unknown as SmartDoorStateDto) ?? null;
  }
}
