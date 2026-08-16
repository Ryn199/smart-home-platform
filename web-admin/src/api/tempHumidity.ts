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

export const tempHumidityApi = {
  getHistory: (
    deviceUid: string,
    timeframe: '1h' | '24h' | '7d' | 'all' = '1h',
    limit = 100,
  ): Promise<TempHumidityReading[]> => {
    return apiClient<TempHumidityReading[]>(
      `/temp-humidity/${encodeURIComponent(deviceUid)}/history?timeframe=${timeframe}&limit=${limit}`,
    );
  },

  getStats: (deviceUid: string): Promise<TempHumidityStats> => {
    return apiClient<TempHumidityStats>(
      `/temp-humidity/${encodeURIComponent(deviceUid)}/stats`,
    );
  },
};
