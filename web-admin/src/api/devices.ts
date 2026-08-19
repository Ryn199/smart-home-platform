import { apiClient } from './client';
import {
  Device,
  DeviceCommand,
  DevicePresenceInfo,
  DeviceStatus,
  DeviceType,
} from '../types';

export interface CreateDeviceDto {
  roomId: number;
  name: string;
  deviceUid: string;
  macAddress?: string;
  pairingCode?: string;
  deviceType?: DeviceType;
  metadata?: Record<string, unknown>;
}

export interface UpdateDeviceDto {
  name?: string;
  roomId?: number;
  macAddress?: string;
  pairingCode?: string;
  deviceType?: DeviceType;
  metadata?: Record<string, unknown>;
}

export interface ExecuteCommandDto {
  action: string;
  position?: number;
  speed?: number;
  direction?: string;
  payload?: Record<string, unknown>;
}

export const devicesApi = {
  getAll: (filter?: {
    roomId?: number;
    deviceType?: DeviceType;
    status?: DeviceStatus;
  }): Promise<Device[]> => {
    const params = new URLSearchParams();
    if (filter?.roomId) params.append('roomId', String(filter.roomId));
    if (filter?.deviceType) params.append('deviceType', filter.deviceType);
    if (filter?.status) params.append('status', filter.status);
    const qs = params.toString();
    return apiClient<Device[]>(`/devices${qs ? `?${qs}` : ''}`);
  },

  getById: (id: number): Promise<Device> => apiClient<Device>(`/devices/${id}`),

  getPresence: (id: number): Promise<DevicePresenceInfo> =>
    apiClient<DevicePresenceInfo>(`/devices/${id}/presence`),

  create: (data: CreateDeviceDto): Promise<Device> =>
    apiClient<Device>('/devices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: UpdateDeviceDto): Promise<Device> =>
    apiClient<Device>(`/devices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<{ message: string; id: number }> =>
    apiClient<{ message: string; id: number }>(`/devices/${id}`, {
      method: 'DELETE',
    }),

  executeCommand: (id: number, command: ExecuteCommandDto): Promise<DeviceCommand> =>
    apiClient<DeviceCommand>(`/devices/${id}/commands`, {
      method: 'POST',
      body: JSON.stringify(command),
    }),

  getCommands: (id: number, limit = 20): Promise<DeviceCommand[]> =>
    apiClient<DeviceCommand[]>(`/devices/${id}/commands?limit=${limit}`),

  resetAuth: (id: number): Promise<{ message: string; device: Device }> =>
    apiClient<{ message: string; device: Device }>(`/devices/${id}/reset-auth`, {
      method: 'POST',
    }),

  restart: (id: number): Promise<{ message: string; command: DeviceCommand }> =>
    apiClient<{ message: string; command: DeviceCommand }>(`/devices/${id}/restart`, {
      method: 'POST',
    }),

  openConfigPortal: (id: number): Promise<{ message: string; command: DeviceCommand }> =>
    apiClient<{ message: string; command: DeviceCommand }>(`/devices/${id}/open-config`, {
      method: 'POST',
    }),

  refreshDiagnostics: (
    id: number,
  ): Promise<{ message: string; command: DeviceCommand; diagnostics?: Record<string, unknown> | null }> =>
    apiClient<{ message: string; command: DeviceCommand; diagnostics?: Record<string, unknown> | null }>(
      `/devices/${id}/diagnostics/refresh`,
      {
        method: 'POST',
      },
    ),

  getDiagnostics: (id: number): Promise<Record<string, unknown>> =>
    apiClient<Record<string, unknown>>(`/devices/${id}/diagnostics`),
};
