import { apiClient } from './client';
import { Home, Room } from '../types';

export const homesApi = {
  getAll: (): Promise<Home[]> => apiClient<Home[]>('/homes'),

  getById: (id: number): Promise<Home> => apiClient<Home>(`/homes/${id}`),

  create: (data: { name: string; address?: string }): Promise<Home> =>
    apiClient<Home>('/homes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: { name?: string; address?: string }): Promise<Home> =>
    apiClient<Home>(`/homes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<{ message: string; id: number }> =>
    apiClient<{ message: string; id: number }>(`/homes/${id}`, {
      method: 'DELETE',
    }),

  getRooms: (homeId: number): Promise<Room[]> =>
    apiClient<Room[]>(`/homes/${homeId}/rooms`),

  createRoom: (homeId: number, data: { name: string }): Promise<Room> =>
    apiClient<Room>(`/homes/${homeId}/rooms`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
