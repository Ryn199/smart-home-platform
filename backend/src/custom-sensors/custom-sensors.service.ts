import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CustomSensorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSensorsByDeviceId(deviceId: number) {
    return this.prisma.sensor.findMany({
      where: { deviceId },
      include: {
        readings: {
          take: 1,
          orderBy: { recordedAt: 'desc' },
        },
      },
    });
  }
}
