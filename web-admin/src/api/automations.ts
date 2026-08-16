import { apiClient } from './client';
import { Automation } from '../types';

export interface CreateAutomationDto {
  homeId: number;
  name: string;
  enabled?: boolean;
  configuration: Record<string, unknown>;
}

export interface UpdateAutomationDto {
  name?: string;
  enabled?: boolean;
  configuration?: Record<string, unknown>;
}

export const automationsApi = {
  getAll: (homeId?: number): Promise<Automation[]> => {
    const qs = homeId ? `?homeId=${homeId}` : '';
    return apiClient<Automation[]>(`/automations${qs}`);
  },

  getById: (id: number): Promise<Automation> =>
    apiClient<Automation>(`/automations/${id}`),

  create: (data: CreateAutomationDto): Promise<Automation> =>
    apiClient<Automation>('/automations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: UpdateAutomationDto): Promise<Automation> =>
    apiClient<Automation>(`/automations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<{ message: string; id: number }> =>
    apiClient<{ message: string; id: number }>(`/automations/${id}`, {
      method: 'DELETE',
    }),
};
