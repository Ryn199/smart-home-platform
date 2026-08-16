import { apiClient } from './client';

export interface TempHumidityReading {
  id: number;
  deviceId: number;
  temperature: number;
  humidity: number;
  recordedAt: string;
}

export interface TempHumidityStats {
  deviceUid: string;
  current: {
    temperature: number | null;
    humidity: number | null;
    recordedAt: string | null;
  };
  stats: {
    tempMin: number | null;
    tempMax: number | null;
    tempAvg: number | null;
    humMin: number | null;
    humMax: number | null;
    humAvg: number | null;
    totalReadings: number;
  };
}

export interface GetHistoryOptions {
  timeframe?: '1h' | '24h' | '7d' | 'custom' | 'all';
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export const tempHumidityApi = {
  getHistory: (
    deviceUid: string,
    options: GetHistoryOptions = {},
  ): Promise<TempHumidityReading[]> => {
    const params = new URLSearchParams();
    if (options.timeframe) params.append('timeframe', options.timeframe);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    if (options.limit) params.append('limit', String(options.limit));

    const qs = params.toString();
    return apiClient<TempHumidityReading[]>(
      `/temp-humidity/${encodeURIComponent(deviceUid)}/history${qs ? `?${qs}` : ''}`,
    );
  },

  getStats: (deviceUid: string): Promise<TempHumidityStats> => {
    return apiClient<TempHumidityStats>(
      `/temp-humidity/${encodeURIComponent(deviceUid)}/stats`,
    );
  },
};
