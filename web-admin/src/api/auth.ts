import { apiClient } from './client';
import { AuthResponse, User } from '../types';

export const authApi = {
  login: (credentials: { email: string; password: string }): Promise<AuthResponse> =>
    apiClient<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  register: (data: { name: string; email: string; password: string }): Promise<AuthResponse> =>
    apiClient<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: (): Promise<User> => apiClient<User>('/auth/me'),
};
