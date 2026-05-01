import { apiClient } from './client';
import { Incident, IncidentListResponse, Comment, StatusHistory, RCA } from '../types';

export interface IncidentFilters {
  page?: number;
  page_size?: number;
  status?: string;
  severity?: string;
  component_id?: string;
  team?: string;
  search?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_dir?: string;
}

export const incidentsApi = {
  list: async (filters: IncidentFilters = {}): Promise<IncidentListResponse> => {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== undefined && v !== '')
    );
    const { data } = await apiClient.get('/incidents', { params });
    return data;
  },

  get: async (id: string): Promise<Incident> => {
    const { data } = await apiClient.get(`/incidents/${id}`);
    return data;
  },

  create: async (payload: Partial<Incident>): Promise<Incident> => {
    const { data } = await apiClient.post('/incidents', payload);
    return data;
  },

  update: async (id: string, payload: Partial<Incident>): Promise<Incident> => {
    const { data } = await apiClient.patch(`/incidents/${id}`, payload);
    return data;
  },

  transition: async (id: string, to_status: string, note?: string): Promise<Incident> => {
    const { data } = await apiClient.post(`/incidents/${id}/transition`, { to_status, note });
    return data;
  },

  getSignals: async (id: string, limit = 100): Promise<{ signals: any[]; count: number }> => {
    const { data } = await apiClient.get(`/incidents/${id}/signals`, { params: { limit } });
    return data;
  },

  getComments: async (id: string): Promise<{ comments: Comment[] }> => {
    const { data } = await apiClient.get(`/incidents/${id}/comments`);
    return data;
  },

  addComment: async (id: string, content: string, is_internal = false): Promise<Comment> => {
    const { data } = await apiClient.post(`/incidents/${id}/comments`, { content, is_internal });
    return data;
  },

  getHistory: async (id: string): Promise<{ history: StatusHistory[] }> => {
    const { data } = await apiClient.get(`/incidents/${id}/history`);
    return data;
  },

  getRCA: async (id: string): Promise<RCA> => {
    const { data } = await apiClient.get(`/rca/${id}`);
    return data;
  },

  submitRCA: async (id: string, payload: Partial<RCA>): Promise<RCA> => {
    const { data } = await apiClient.post(`/rca/${id}`, payload);
    return data;
  },
};
