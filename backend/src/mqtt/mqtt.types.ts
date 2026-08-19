export type MqttMessageType = 'telemetry' | 'state' | 'command' | 'config' | 'diagnostics' | 'system';

export interface ParsedMqttTopic {
  homeId: string;
  roomId: string;
  deviceUid: string;
  messageType: MqttMessageType | string;
}

export type MqttMessageHandler = (
  parsedTopic: ParsedMqttTopic,
  rawTopic: string,
  payload: Buffer,
) => Promise<void> | void;
