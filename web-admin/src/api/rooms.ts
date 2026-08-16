import { apiClient } from './client';
import { Device, Room } from '../types';

export const roomsApi = {
  getAll: (): Promise<Room[]> => apiClient<Room[]>('/rooms'),

  create: (data: { homeId: number; name: string }): Promise<Room> =>
    apiClient<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getById: (id: number): Promise<Room> => apiClient<Room>(`/rooms/${id}`),

  update: (id: number, data: { name?: string; homeId?: number }): Promise<Room> =>
    apiClient<Room>(`/rooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<{ message: string; id: number }> =>
    apiClient<{ message: string; id: number }>(`/rooms/${id}`, {
      method: 'DELETE',
    }),

  getDevices: (roomId: number): Promise<Device[]> =>
    apiClient<Device[]>(`/rooms/${roomId}/devices`),
};
