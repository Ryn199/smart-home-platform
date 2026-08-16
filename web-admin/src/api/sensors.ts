import { apiClient } from './client';
import { Sensor, SensorReadingsResponse } from '../types';

export const sensorsApi = {
  getAll: (): Promise<Sensor[]> => apiClient<Sensor[]>('/sensors'),

  getByDeviceId: (deviceId: number): Promise<Sensor[]> =>
    apiClient<Sensor[]>(`/devices/${deviceId}/sensors`),

  getById: (sensorId: number): Promise<Sensor> =>
    apiClient<Sensor>(`/sensors/${sensorId}`),

  create: (data: {
    deviceId: number;
    name: string;
    type: string;
    unit?: string;
  }): Promise<Sensor> =>
    apiClient<Sensor>('/sensors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    sensorId: number,
    data: { name?: string; type?: string; unit?: string; deviceId?: number },
  ): Promise<Sensor> =>
    apiClient<Sensor>(`/sensors/${sensorId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (sensorId: number): Promise<{ message: string; id: number }> =>
    apiClient<{ message: string; id: number }>(`/sensors/${sensorId}`, {
      method: 'DELETE',
    }),

  getReadings: (
    sensorId: number,
    query?: { from?: string; to?: string; limit?: number },
  ): Promise<SensorReadingsResponse> => {
    const params = new URLSearchParams();
    if (query?.from) params.append('from', query.from);
    if (query?.to) params.append('to', query.to);
    if (query?.limit) params.append('limit', String(query.limit));
    const qs = params.toString();
    return apiClient<SensorReadingsResponse>(
      `/sensors/${sensorId}/readings${qs ? `?${qs}` : ''}`,
    );
  },
};
