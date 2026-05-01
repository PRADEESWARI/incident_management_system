import { apiClient } from './client';
import { User } from '../types';

export const authApi = {
  login: async (username: string, password: string): Promise<{ access_token: string; user: User }> => {
    const { data } = await apiClient.post('/auth/login', { username, password });
    return data;
  },

  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },

  listUsers: async (): Promise<User[]> => {
    const { data } = await apiClient.get('/auth/users');
    return data;
  },

  register: async (payload: any): Promise<User> => {
    const { data } = await apiClient.post('/auth/register', payload);
    return data;
  },
};
