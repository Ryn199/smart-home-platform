import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { MqttService } from '../mqtt/mqtt.service';
import { EventsGateway } from '../websocket/events.gateway';
import { SmartDoorService } from '../smart-door/smart-door.service';
import { SmartCurtainService } from '../smart-curtain/smart-curtain.service';
import { ExhaustFanService } from '../exhaust-fan/exhaust-fan.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { ExecuteCommandDto } from './dto/execute-command.dto';
import {
  CommandStatus,
  Device,
  DeviceCommand,
  DeviceStatus,
  DeviceType,
  Prisma,
} from '@prisma/client';

export interface DevicePresenceInfo {
  id: number;
  deviceUid: string;
  name: string;
  status: DeviceStatus;
  lastSeenAt: Date | null;
  thresholdSeconds: number;
  secondsSinceLastSeen: number | null;
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
    private readonly configService: ConfigService,
    private readonly mqttService: MqttService,
    private readonly eventsGateway: EventsGateway,
    @Inject(forwardRef(() => SmartDoorService))
    private readonly smartDoorService: SmartDoorService,
    @Inject(forwardRef(() => SmartCurtainService))
    private readonly smartCurtainService: SmartCurtainService,
    @Inject(forwardRef(() => ExhaustFanService))
    private readonly exhaustFanService: ExhaustFanService,
  ) {}

  getOfflineThresholdSeconds(): number {
    const raw = this.configService.get<string | number>('DEVICE_OFFLINE_THRESHOLD_SECONDS', 60);
    return typeof raw === 'number' ? raw : parseInt(String(raw), 10) || 60;
  }

  calculateStatus(lastSeenAt: Date | null): DeviceStatus {
    if (!lastSeenAt) {
      return DeviceStatus.UNKNOWN;
    }

    const diffMs = Date.now() - new Date(lastSeenAt).getTime();
    const thresholdMs = this.getOfflineThresholdSeconds() * 1000;

    return diffMs <= thresholdMs ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE;
  }

  private attachComputedStatus<T extends Device>(device: T): T {
    return {
      ...device,
      status: this.calculateStatus(device.lastSeenAt),
    };
  }

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
    const device = await this.prisma.device.create({
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

    return this.attachComputedStatus(device);
  }

  async findAll(filter?: {
    roomId?: number;
    deviceType?: DeviceType;
    status?: DeviceStatus;
  }): Promise<Device[]> {
    const where: Prisma.DeviceWhereInput = {};

    if (filter?.roomId) {
      where.roomId = filter.roomId;
    }

    if (filter?.deviceType) {
      where.deviceType = filter.deviceType;
    }

    const devices = await this.prisma.device.findMany({
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

    const computed = devices.map((d) => this.attachComputedStatus(d));

    if (filter?.status) {
      return computed.filter((d) => d.status === filter.status);
    }

    return computed;
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

    return this.attachComputedStatus(device);
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

    return this.attachComputedStatus(device);
  }

  async findByRoomId(roomId: number): Promise<Device[]> {
    // Validate room exists
    await this.roomsService.findOne(roomId);

    const devices = await this.prisma.device.findMany({
      where: { roomId },
      include: {
        _count: {
          select: { sensors: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return devices.map((d) => this.attachComputedStatus(d));
  }

  async getPresence(id: number): Promise<DevicePresenceInfo> {
    const device = await this.findOne(id);
    const thresholdSeconds = this.getOfflineThresholdSeconds();

    let secondsSinceLastSeen: number | null = null;
    if (device.lastSeenAt) {
      secondsSinceLastSeen = Math.floor(
        (Date.now() - new Date(device.lastSeenAt).getTime()) / 1000,
      );
    }

    return {
      id: device.id,
      deviceUid: device.deviceUid,
      name: device.name,
      status: device.status,
      lastSeenAt: device.lastSeenAt,
      thresholdSeconds,
      secondsSinceLastSeen,
    };
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

    const updated = await this.prisma.device.update({
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

    return this.attachComputedStatus(updated);
  }

  async executeCommand(id: number, dto: ExecuteCommandDto): Promise<DeviceCommand> {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: {
        room: {
          include: {
            home: true,
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    // Validate and format command payload based on DeviceType
    let commandPayload: Record<string, unknown> = {};

    switch (device.deviceType) {
      case DeviceType.SMART_DOOR: {
        const validated = this.smartDoorService.validateCommand(dto.action);
        commandPayload = { action: validated.action };
        break;
      }

      case DeviceType.SMART_CURTAIN: {
        const validated = this.smartCurtainService.validateCommand(dto.action, dto.position);
        commandPayload = {
          action: validated.action,
          ...(validated.position !== undefined ? { position: validated.position } : {}),
        };
        break;
      }

      case DeviceType.EXHAUST_FAN: {
        const validated = this.exhaustFanService.validateCommand(dto.action, dto.speed);
        commandPayload = {
          action: validated.action,
          ...(validated.speed !== undefined ? { speed: validated.speed } : {}),
        };
        break;
      }

      case DeviceType.CUSTOM_SENSOR:
      default: {
        if (!dto.action) {
          throw new BadRequestException('action is required');
        }
        commandPayload = dto.payload ?? { action: dto.action };
        break;
      }
    }

    // 1. Record command in database
    const command = await this.prisma.deviceCommand.create({
      data: {
        deviceId: device.id,
        command: dto.action,
        payload: commandPayload as Prisma.InputJsonValue,
        status: CommandStatus.SENT,
      },
    });

    // 2. Publish to MQTT topic: home/{homeId}/{roomId}/{deviceUid}/command
    const topic = this.mqttService.buildTopic(
      device.room.home.id,
      device.roomId,
      device.deviceUid,
      'command',
    );

    await this.mqttService.publish(topic, commandPayload);

    // 3. Emit real-time WebSocket command event
    this.eventsGateway.emitCommandExecuted({
      deviceUid: device.deviceUid,
      command: dto.action,
      status: 'SENT',
      executedAt: new Date(),
    });

    return command;
  }

  async getCommands(id: number, limit = 50): Promise<DeviceCommand[]> {
    await this.findOne(id);

    return this.prisma.deviceCommand.findMany({
      where: { deviceId: id },
      take: Math.min(limit, 100),
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateLastSeen(
    deviceUid: string,
    status: DeviceStatus = DeviceStatus.ONLINE,
  ): Promise<Device> {
    const updated = await this.prisma.device.update({
      where: { deviceUid },
      data: {
        lastSeenAt: new Date(),
        status,
      },
    });

    return this.attachComputedStatus(updated);
  }

  async remove(id: number): Promise<{ message: string; id: number }> {
    await this.findOne(id);

    await this.prisma.device.delete({
      where: { id },
    });

    return { message: `Device with ID ${id} deleted successfully`, id };
  }
}
