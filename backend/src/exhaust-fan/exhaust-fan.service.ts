import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ExhaustFanStateDto } from './dto/exhaust-fan-state.dto';
import { ExhaustFanAction, ExhaustFanCommandDto } from './dto/exhaust-fan-command.dto';
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

  validateCommand(action: string, speed?: number): ExhaustFanCommandDto {
    const validActions = Object.values(ExhaustFanAction) as string[];
    if (!validActions.includes(action.toLowerCase())) {
      throw new BadRequestException(
        `Invalid action "${action}" for EXHAUST_FAN. Valid actions: ${validActions.join(', ')}`,
      );
    }

    const command: ExhaustFanCommandDto = {
      action: action.toLowerCase() as ExhaustFanAction,
    };

    if (command.action === ExhaustFanAction.SET_SPEED) {
      if (typeof speed !== 'number' || speed < 0 || speed > 3) {
        throw new BadRequestException(
          'speed must be an integer between 0 and 3 for set_speed action',
        );
      }
      command.speed = Math.round(speed);
    }

    return command;
  }
}
