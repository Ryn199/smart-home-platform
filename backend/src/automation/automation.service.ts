import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { HomesService } from '../homes/homes.service';
import { DevicesService } from '../devices/devices.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { Automation, Prisma } from '@prisma/client';

export interface SensorTriggerConfig {
  type: 'sensor_threshold';
  sensorType: string;
  operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
  value: number;
}

export interface AutomationActionConfig {
  deviceId: number;
  action: string;
  position?: number;
  speed?: number;
  payload?: Record<string, unknown>;
}

export interface AutomationRuleConfig {
  trigger?: SensorTriggerConfig;
  action?: AutomationActionConfig;
}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly homesService: HomesService,
    @Inject(forwardRef(() => DevicesService))
    private readonly devicesService: DevicesService,
  ) {}

  async create(dto: CreateAutomationDto): Promise<Automation> {
    // Validate home exists
    await this.homesService.findOne(dto.homeId);

    return this.prisma.automation.create({
      data: {
        homeId: dto.homeId,
        name: dto.name,
        enabled: dto.enabled ?? true,
        configuration: dto.configuration as Prisma.InputJsonValue,
      },
      include: {
        home: true,
      },
    });
  }

  async findAll(homeId?: number): Promise<Automation[]> {
    const where: Prisma.AutomationWhereInput = {};
    if (homeId) {
      where.homeId = homeId;
    }

    return this.prisma.automation.findMany({
      where,
      include: {
        home: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number): Promise<Automation> {
    const automation = await this.prisma.automation.findUnique({
      where: { id },
      include: {
        home: true,
      },
    });

    if (!automation) {
      throw new NotFoundException(`Automation with ID ${id} not found`);
    }

    return automation;
  }

  async update(id: number, dto: UpdateAutomationDto): Promise<Automation> {
    await this.findOne(id);

    const data: Prisma.AutomationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.configuration !== undefined) {
      data.configuration = dto.configuration as Prisma.InputJsonValue;
    }

    return this.prisma.automation.update({
      where: { id },
      data,
      include: {
        home: true,
      },
    });
  }

  async remove(id: number): Promise<{ message: string; id: number }> {
    await this.findOne(id);

    await this.prisma.automation.delete({
      where: { id },
    });

    return { message: `Automation with ID ${id} deleted successfully`, id };
  }

  /**
   * Evaluates sensor threshold rules against active automations
   */
  async evaluateSensorRules(homeId: number, sensorType: string, value: number): Promise<void> {
    const automations = await this.prisma.automation.findMany({
      where: {
        homeId,
        enabled: true,
      },
    });

    for (const auto of automations) {
      const config = auto.configuration as unknown as AutomationRuleConfig;
      if (!config?.trigger || !config?.action) {
        continue;
      }

      const trigger = config.trigger;
      if (
        trigger.type === 'sensor_threshold' &&
        trigger.sensorType?.toLowerCase() === sensorType.toLowerCase()
      ) {
        const matches = this.checkCondition(value, trigger.operator, trigger.value);

        if (matches) {
          this.logger.log(
            `Automation "${auto.name}" triggered: ${sensorType} (${value}) ${trigger.operator} ${trigger.value}`,
          );

          try {
            await this.devicesService.executeCommand(config.action.deviceId, {
              action: config.action.action,
              position: config.action.position,
              speed: config.action.speed,
              payload: config.action.payload,
            });
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to execute action for automation "${auto.name}": ${message}`);
          }
        }
      }
    }
  }

  private checkCondition(actual: number, operator: string, target: number): boolean {
    switch (operator) {
      case '>':
        return actual > target;
      case '>=':
        return actual >= target;
      case '<':
        return actual < target;
      case '<=':
        return actual <= target;
      case '==':
      case '=':
        return actual === target;
      case '!=':
        return actual !== target;
      default:
        return false;
    }
  }
}
