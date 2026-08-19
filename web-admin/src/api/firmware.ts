import { apiClient } from './client';
import { Firmware, DeviceCommand } from '../types';

export interface UploadFirmwarePayload {
  version: string;
  fileName: string;
  fileData: string; // base64 string
  changelog?: string;
}

export const firmwareApi = {
  getByDevice: (deviceId: number): Promise<Firmware[]> =>
    apiClient<Firmware[]>(`/devices/${deviceId}/firmware`),

  upload: (deviceId: number, data: UploadFirmwarePayload): Promise<Firmware> =>
    apiClient<Firmware>(`/devices/${deviceId}/firmware`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deploy: (
    deviceId: number,
    firmwareId: number,
  ): Promise<{ message: string; firmware: Firmware; command: DeviceCommand }> =>
    apiClient<{ message: string; firmware: Firmware; command: DeviceCommand }>(
      `/devices/${deviceId}/firmware/${firmwareId}/deploy`,
      {
        method: 'POST',
      },
    ),

  rollback: (
    deviceId: number,
  ): Promise<{ message: string; firmware: Firmware; command: DeviceCommand }> =>
    apiClient<{ message: string; firmware: Firmware; command: DeviceCommand }>(
      `/devices/${deviceId}/firmware/rollback`,
      {
        method: 'POST',
      },
    ),

  delete: (deviceId: number, firmwareId: number): Promise<{ message: string; id: number }> =>
    apiClient<{ message: string; id: number }>(`/devices/${deviceId}/firmware/${firmwareId}`, {
      method: 'DELETE',
    }),

  getDownloadUrl: (firmwareId: number): string => `/api/firmware/${firmwareId}/download`,
};
