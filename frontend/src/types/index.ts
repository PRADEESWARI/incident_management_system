export type IncidentStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'INVESTIGATING'
  | 'MITIGATED'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

export type IncidentSeverity =
  | 'P0_CRITICAL'
  | 'P1_HIGH'
  | 'P2_MEDIUM'
  | 'P3_LOW'
  | 'P4_INFO';

export type ComponentType =
  | 'API'
  | 'SERVER'
  | 'CACHE'
  | 'QUEUE'
  | 'RDBMS'
  | 'NOSQL'
  | 'SECURITY'
  | 'NETWORK'
  | 'UNKNOWN';

export interface Incident {
  id: string;
  incident_number?: number;
  title: string;
  description?: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  component_id: string;
  component_type: ComponentType;
  source?: string;
  assignee_id?: string;
  assignee_name?: string;
  team?: string;
  signal_count: number;
  error_fingerprint?: string;
  parent_incident_id?: string;
  first_signal_at?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  closed_at?: string;
  mttr_seconds?: number;
  rca_completed: boolean;
  tags: string[];
  extra_data: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface IncidentListResponse {
  items: Incident[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Signal {
  _id: string;
  signal_type: string;
  component_id: string;
  component_name: string;
  severity: string;
  message: string;
  source?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  tags: string[];
  incident_id?: string;
  created_at: string;
}

export interface RCA {
  id: string;
  incident_id: string;
  incident_start_time: string;
  incident_end_time: string;
  root_cause_category: string;
  root_cause_summary: string;
  fix_applied: string;
  prevention_steps: string;
  lessons_learned?: string;
  owner_id: string;
  owner_name?: string;
  mttr_seconds?: number;
  draft: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Comment {
  id: string;
  incident_id: string;
  author_id: string;
  author_name?: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  updated_at?: string;
}

export interface StatusHistory {
  id: string;
  incident_id: string;
  from_status?: string;
  to_status: string;
  changed_by_id?: string;
  changed_by_name?: string;
  note?: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: 'admin' | 'engineer' | 'viewer';
  team?: string;
  is_active: boolean;
  created_at: string;
}

export interface DashboardSummary {
  total_incidents: number;
  active_incidents: number;
  critical_incidents: number;
  resolved_incidents: number;
  mttr_today_seconds: number;
  mttr_today_minutes: number;
  severity_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  top_noisy_components: Array<{ component: string; signal_count: number }>;
  incidents_per_hour: Array<{ hour: string; count: number }>;
  team_performance: Array<{ team: string; total: number; avg_mttr: number }>;
  signals_per_second: number;
  queue_backlog: number;
  total_signals_processed?: number;
  generated_at: string;
}

export interface ServiceHealth {
  component_id: string;
  component_type: string;
  total_incidents: number;
  active_incidents: number;
  health_status: 'healthy' | 'degraded' | 'critical';
}

export interface SimulatorScenario {
  id: string;
  name: string;
  signal_type: string;
  severity: string;
  component: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}
