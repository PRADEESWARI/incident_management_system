import { apiClient } from './client';
import { SimulatorScenario } from '../types';

export const simulatorApi = {
  getScenarios: async (): Promise<{ scenarios: SimulatorScenario[] }> => {
    const { data } = await apiClient.get('/simulator/scenarios');
    return data;
  },

  trigger: async (scenario: string, options: {
    component_id?: string;
    component_name?: string;
    severity?: string;
    count?: number;
    environment?: string;
  } = {}): Promise<any> => {
    const { data } = await apiClient.post('/simulator/trigger', {
      scenario,
      count: options.count || 1,
      ...options,
    });
    return data;
  },

  loadTest: async (signals_per_second: number, duration_seconds: number, scenario = 'api_down'): Promise<any> => {
    const { data } = await apiClient.post('/simulator/load-test', {
      signals_per_second,
      duration_seconds,
      scenario,
    });
    return data;
  },

  duplicateStorm: async (component_id: string, count: number): Promise<any> => {
    const { data } = await apiClient.post('/simulator/duplicate-storm', null, {
      params: { component_id, count },
    });
    return data;
  },
};
