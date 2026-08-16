import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ExhaustFanStateDto } from './dto/exhaust-fan-state.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExhaustFanService {
  constructor(private readonly prisma: PrismaService) {}

  async updateState(deviceUid: string, state: ExhaustFanStateDto) {
    return this.prisma.device.update({
      where: { deviceUid },
      data: {
        metadata: state as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getState(deviceUid: string): Promise<ExhaustFanStateDto | null> {
    const device = await this.prisma.device.findUnique({
      where: { deviceUid },
      select: { metadata: true },
    });

    return (device?.metadata as unknown as ExhaustFanStateDto) ?? null;
  }
}
