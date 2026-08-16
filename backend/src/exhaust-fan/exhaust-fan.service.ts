import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  ExhaustFanStateDto,
  ExhaustFanDesiredStateDto,
  FanOperationState,
  DuctPosition,
  FanErrorCode,
} from './dto/exhaust-fan-state.dto';
import { ExhaustFanAction, ExhaustFanCommandDto, FanDirection } from './dto/exhaust-fan-command.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExhaustFanService {
  private readonly logger = new Logger(ExhaustFanService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // State Read / Write
  // ─────────────────────────────────────────────────────────────

  async getState(deviceUid: string): Promise<ExhaustFanStateDto | null> {
    const device = await this.prisma.device.findUnique({
      where: { deviceUid },
      select: { metadata: true },
    });
    return (device?.metadata as unknown as ExhaustFanStateDto) ?? null;
  }

  async updateState(deviceUid: string, patch: Partial<ExhaustFanStateDto>): Promise<void> {
    const current = await this.getState(deviceUid);
    const merged: ExhaustFanStateDto = {
      ...current,
      ...patch,
      lastUpdated: new Date().toISOString(),
    };

    await this.prisma.device.update({
      where: { deviceUid },
      data: { metadata: merged as unknown as Prisma.InputJsonValue },
    });

    this.logger.log(
      `[EXHAUST] State updated for ${deviceUid}: ` +
        `desiredPower=${merged.desiredPower}, desiredDirection=${merged.desiredDirection}, ` +
        `operationState=${merged.operationState}, ductPosition=${merged.ductPosition}, errorCode=${merged.errorCode}`,
    );
  }

  /**
   * Handle actual state telemetry from ESP32 via MQTT.
   * The ESP32 reports its actual runtime state — we persist it to the device metadata.
   */
  async handleState(deviceUid: string, payload: Record<string, unknown>): Promise<void> {
    const patch: Partial<ExhaustFanStateDto> = {};

    if (typeof payload.power === 'boolean') patch.power = payload.power;
    if (typeof payload.direction === 'string') patch.direction = payload.direction as 'INTAKE' | 'EXHAUST';
    if (typeof payload.ductPosition === 'string') patch.ductPosition = payload.ductPosition as DuctPosition;
    if (typeof payload.operationState === 'string') patch.operationState = payload.operationState as FanOperationState;
    if (typeof payload.errorCode === 'string') patch.errorCode = payload.errorCode as FanErrorCode;

    // Also accept snake_case field names from ESP32 firmware
    if (typeof payload.duct_position === 'string') patch.ductPosition = payload.duct_position as DuctPosition;
    if (typeof payload.operation_state === 'string') patch.operationState = payload.operation_state as FanOperationState;
    if (typeof payload.error_code === 'string') patch.errorCode = payload.error_code as FanErrorCode;
    if (typeof payload.desired_power === 'boolean') patch.desiredPower = payload.desired_power;
    if (typeof payload.desired_direction === 'string') patch.desiredDirection = payload.desired_direction as 'INTAKE' | 'EXHAUST';

    await this.updateState(deviceUid, patch);
  }

  /**
   * Apply a desired state command from Web Admin.
   * Returns the merged desired state to be published over MQTT.
   */
  async applyDesiredState(
    deviceUid: string,
    desired: ExhaustFanDesiredStateDto,
  ): Promise<Record<string, unknown>> {
    await this.updateState(deviceUid, {
      desiredPower: desired.desiredPower,
      desiredDirection: desired.desiredDirection,
    });

    this.logger.log(
      `[EXHAUST] Desired state set for ${deviceUid}: power=${desired.desiredPower}, direction=${desired.desiredDirection}`,
    );

    return {
      desiredPower: desired.desiredPower,
      desiredDirection: desired.desiredDirection,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Command Validation (used by DevicesService.executeCommand)
  // ─────────────────────────────────────────────────────────────

  validateCommand(action: string, _speed?: number): ExhaustFanCommandDto {
    const normalizedAction = action.toLowerCase();
    const validActions = Object.values(ExhaustFanAction) as string[];

    if (!validActions.includes(normalizedAction)) {
      throw new BadRequestException(
        `Invalid action "${action}" for EXHAUST_FAN. Valid actions: ${validActions.join(', ')}`,
      );
    }

    const command: ExhaustFanCommandDto = {
      action: normalizedAction as ExhaustFanAction,
    };

    // Map direction shorthand actions
    if (normalizedAction === ExhaustFanAction.INTAKE) {
      command.direction = FanDirection.INTAKE;
      command.action = ExhaustFanAction.SET_DIRECTION;
    } else if (normalizedAction === ExhaustFanAction.EXHAUST) {
      command.direction = FanDirection.EXHAUST;
      command.action = ExhaustFanAction.SET_DIRECTION;
    }

    return command;
  }
}
