import { apiClient } from './client';
import { DashboardSummary, ServiceHealth } from '../types';

export const analyticsApi = {
  getDashboard: async (): Promise<DashboardSummary> => {
    const { data } = await apiClient.get('/analytics/dashboard');
    return data;
  },

  getMttrTrends: async (days = 7): Promise<any[]> => {
    const { data } = await apiClient.get('/analytics/mttr-trends', { params: { days } });
    return data;
  },

  getServiceHealth: async (): Promise<{ services: ServiceHealth[] }> => {
    const { data } = await apiClient.get('/analytics/service-health');
    return data;
  },
};
