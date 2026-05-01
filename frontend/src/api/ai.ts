import { apiClient } from './client';

export interface AISummary {
  incident_id: string;
  executive_summary: string;
  technical_summary: string;
  likely_cause: string;
  business_impact: string;
  immediate_actions: string[];
  prevention_suggestions: string[];
  severity_assessment: string;
  estimated_resolution_time: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'ai' | 'rule-based';
  model: string;
  note?: string;
  cached?: boolean;
}

export const aiApi = {
  getSummary: async (incidentId: string, refresh = false): Promise<AISummary> => {
    const { data } = await apiClient.get(`/ai/incidents/${incidentId}/summary`, {
      params: refresh ? { refresh: true } : {},
    });
    return data;
  },

  reassign: async (incidentId: string, assigneeId: string, team: string): Promise<any> => {
    const { data } = await apiClient.patch(`/incidents/${incidentId}/reassign`, {
      assignee_id: assigneeId,
      team,
    });
    return data;
  },
};
