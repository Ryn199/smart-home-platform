import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SmartCurtainStateDto } from './dto/smart-curtain-state.dto';
import { SmartCurtainAction, SmartCurtainCommandDto } from './dto/smart-curtain-command.dto';
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

  validateCommand(action: string, position?: number): SmartCurtainCommandDto {
    const validActions = Object.values(SmartCurtainAction) as string[];
    if (!validActions.includes(action.toLowerCase())) {
      throw new BadRequestException(
        `Invalid action "${action}" for SMART_CURTAIN. Valid actions: ${validActions.join(', ')}`,
      );
    }

    const command: SmartCurtainCommandDto = {
      action: action.toLowerCase() as SmartCurtainAction,
    };

    if (command.action === SmartCurtainAction.SET_POSITION) {
      if (typeof position !== 'number' || position < 0 || position > 100) {
        throw new BadRequestException(
          'position must be an integer between 0 and 100 for set_position action',
        );
      }
      command.position = Math.round(position);
    }

    return command;
  }
}
