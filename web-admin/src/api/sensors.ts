import { apiClient } from './client';
import { Sensor, SensorReadingsResponse } from '../types';

export const sensorsApi = {
  getByDeviceId: (deviceId: number): Promise<Sensor[]> =>
    apiClient<Sensor[]>(`/devices/${deviceId}/sensors`),

  getById: (sensorId: number): Promise<Sensor> =>
    apiClient<Sensor>(`/sensors/${sensorId}`),

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
