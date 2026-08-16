import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { MqttMessageHandler, MqttMessageType, ParsedMqttTopic } from './mqtt.types';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient | null = null;
  private handlers: MqttMessageHandler[] = [];
  private connected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    const brokerUrl = this.configService.get<string>('MQTT_BROKER_URL') ?? 'mqtt://localhost:1883';
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');

    const options: mqtt.IClientOptions = {
      clientId: `smarthome_backend_${Math.random().toString(16).substring(2, 8)}`,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 5000,
    };

    if (username) options.username = username;
    if (password) options.password = password;

    this.logger.log(`Connecting to MQTT broker at: ${brokerUrl}`);

    try {
      this.client = mqtt.connect(brokerUrl, options);

      this.client.on('connect', () => {
        this.connected = true;
        this.logger.log('Connected to MQTT broker successfully.');

        // Subscribe to root topic for all smart home devices and simple IoT telemetry
        this.subscribe('home/#');
        this.subscribe('iot/#');
      });

      this.client.on('reconnect', () => {
        this.logger.warn('Reconnecting to MQTT broker...');
      });

      this.client.on('close', () => {
        if (this.connected) {
          this.connected = false;
          this.logger.warn('MQTT connection closed.');
        }
      });

      this.client.on('error', (err) => {
        this.logger.error(`MQTT client error: ${err.message}`, err.stack);
      });

      this.client.on('message', (topic: string, payload: Buffer) => {
        this.handleIncomingMessage(topic, payload);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to initialize MQTT connection: ${message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      return new Promise<void>((resolve) => {
        this.client?.end(false, () => {
          this.connected = false;
          this.logger.log('Disconnected from MQTT broker.');
          resolve();
        });
      });
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribe(topic: string): void {
    if (!this.client || !this.connected) {
      return;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        this.logger.error(`Failed to subscribe to "${topic}": ${err.message}`);
      } else {
        this.logger.log(`Subscribed to topic: ${topic}`);
      }
    });
  }

  async publish(
    topic: string,
    message: string | object,
    options: mqtt.IClientPublishOptions = { qos: 1 },
  ): Promise<void> {
    if (!this.client || !this.connected) {
      this.logger.warn(`Cannot publish to "${topic}": MQTT client is not connected.`);
      return;
    }

    const payload = typeof message === 'object' ? JSON.stringify(message) : message;

    return new Promise<void>((resolve, reject) => {
      this.client?.publish(topic, payload, options, (err) => {
        if (err) {
          this.logger.error(`Failed to publish message to "${topic}": ${err.message}`);
          reject(err);
        } else {
          this.logger.debug?.(`Published to ${topic}: ${payload}`);
          resolve();
        }
      });
    });
  }

  registerHandler(handler: MqttMessageHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Topic pattern: home/{homeId}/{roomId}/{deviceUid}/{messageType}
   * Example: home/1/2/door-001/command
   */
  buildTopic(
    homeId: string | number,
    roomId: string | number,
    deviceUid: string,
    messageType: MqttMessageType,
  ): string {
    return `home/${String(homeId)}/${String(roomId)}/${deviceUid}/${messageType}`;
  }

  /**
   * Parses topic format:
   * - home/{homeId}/{roomId}/{deviceUid}/{messageType}
   * - iot/telemetry or iot/{messageType}
   * - iot/{pairingCode}/telemetry
   */
  parseTopic(topic: string): ParsedMqttTopic | null {
    const parts = topic.split('/');
    if (parts.length >= 5 && parts[0] === 'home') {
      return {
        homeId: parts[1],
        roomId: parts[2],
        deviceUid: parts[3],
        messageType: parts[4] as MqttMessageType,
      };
    }

    if (parts[0] === 'iot') {
      if (parts.length === 2) {
        return {
          homeId: '',
          roomId: '',
          deviceUid: '',
          messageType: parts[1] as MqttMessageType,
        };
      }
      if (parts.length >= 3) {
        return {
          homeId: '',
          roomId: '',
          deviceUid: parts[1],
          messageType: parts[2] as MqttMessageType,
        };
      }
    }

    return null;
  }

  private handleIncomingMessage(topic: string, payload: Buffer): void {
    const parsed = this.parseTopic(topic);
    if (!parsed) {
      // Ignored non-standard topic
      return;
    }

    for (const handler of this.handlers) {
      try {
        const result = handler(parsed, topic, payload);
        if (result instanceof Promise) {
          result.catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Error in async MQTT handler for "${topic}": ${message}`);
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error in synchronous MQTT handler for "${topic}": ${message}`);
      }
    }
  }
}
