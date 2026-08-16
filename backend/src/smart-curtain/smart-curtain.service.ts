import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SmartCurtainStateDto } from './dto/smart-curtain-state.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SmartCurtainService {
  constructor(private readonly prisma: PrismaService) {}

  async updateState(deviceUid: string, state: SmartCurtainStateDto) {
    return this.prisma.device.update({
      where: { deviceUid },
      data: {
        metadata: state as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getState(deviceUid: string): Promise<SmartCurtainStateDto | null> {
    const device = await this.prisma.device.findUnique({
      where: { deviceUid },
      select: { metadata: true },
    });

    return (device?.metadata as unknown as SmartCurtainStateDto) ?? null;
  }
}
