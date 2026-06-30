import type { AppUser, Role } from './rbac';

const TOKEN_KEY = 'field-pro-token';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  json = true
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>)
  };
  if (json && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || res.statusText, res.status);
  }
  return data as T;
}

export interface Agent {
  id: string;
  company_id: string;
  name: string;
  zone: string;
  phone: string;
  status: string;
  efloat: number;
  cash: number;
  score: number;
  visits: number;
  officer: string;
  officer_id?: string | null;
  joined: string;
  lat: number;
  lng: number;
  kyc: string;
  last_visit: string | null;
  national_id?: string | null;
  business_type?: string | null;
  kyc_doc_count?: number;
  visit_count?: number;
}

export interface KycDocument {
  id: number;
  docType: string;
  docLabel?: string;
  fileName: string;
  mimeType?: string | null;
  url: string;
  uploadedAt: string;
}

export interface AgentDetail extends Agent {
  kyc_docs: KycDocument[];
  recent_visits: {
    id: number;
    officer: string;
    status: string;
    time: string;
    type: string;
    zone: string;
    visit_date: string;
    gps_verified: boolean;
    notes: string | null;
  }[];
}

export interface BulkImportResult {
  created: number;
  agents: Agent[];
  errors: { row: number; error: string }[];
}

export interface BulkKycResult {
  uploaded: number;
  documents: { agentId: string; docType: string; fileName: string; id: number }[];
  errors: { file: string; error: string }[];
}

export interface Visit {
  id?: number;
  agent: string;
  agent_id?: string;
  officer: string;
  status: string;
  time: string;
  type: string;
  zone: string;
}

export interface Officer {
  name: string;
  agents: number;
  visits: number;
  target: number;
  score: number;
  zone: string;
}

export interface Alert {
  type: string;
  title: string;
  body: string;
  time: string;
  agent: string | null;
}

export interface TrainingModule {
  title: string;
  assigned: number;
  completed: number;
  passing: number;
}

export interface Company {
  id: string;
  name: string;
  plan: string;
  agents: number;
  officers: number;
  status: string;
  mrr: number;
  since: string;
  contactEmail?: string | null;
  registeredAt?: string;
}

export interface CompanyUser {
  id?: string;
  name: string;
  email: string;
  role: string;
  zone: string | null;
  status: string;
  scope?: string;
}

export interface AuditEntry {
  id: number;
  scope: string;
  action: string;
  actorName: string;
  actorEmail: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface FloatTrend {
  labels: string[];
  efloat: number[];
  cash: number[];
}

export interface FloatDeliverySummary {
  delivery_id: string;
  snapshot_at: string;
  received_at: string;
  record_count: number;
  updated_count: number;
  skipped_count: number;
  unknown_count: number;
  status: string;
}

export interface FloatDeliveriesResponse {
  latest: FloatDeliverySummary | null;
  deliveries: FloatDeliverySummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface FloatDeliveryAgent {
  agent_number: string | null;
  agent_id: string;
  name: string;
  zone: string;
  after_balance: string;
  balance_as_of: string | null;
}

export interface FloatDeliveryDetail extends FloatDeliverySummary {
  schema_version: number;
  agents_in_payload: number;
  agents_updated: number;
  total_after_balance: string;
  agents?: FloatDeliveryAgent[];
  agents_total?: number;
  limit?: number;
  offset?: number;
  showing?: number;
}

export interface NetworkStats {
  totalAgents: number;
  statusCounts: Record<string, number>;
  visitsToday: Record<string, number>;
}

export interface CompanySettings {
  company_id: string;
  network: {
    default_float_threshold: number;
    visit_frequency_target: number;
    alert_notification_delay_minutes: number;
    auto_suspend_missed_visits_days: number;
  };
  zones: {
    active_zones: number;
    sub_territories: number;
    coverage_model: string;
  };
  integration: {
    core_wallet_api: string;
    sms_gateway: string;
    email_notifications: string;
    export_format: string;
  };
  integration_editable: boolean;
  updated_at: string;
}

export type CompanySettingsUpdate = Partial<{
  default_float_threshold: number;
  visit_frequency_target: number;
  alert_notification_delay_minutes: number;
  auto_suspend_missed_visits_days: number;
  active_zones: number;
  sub_territories: number;
  coverage_model: string;
}>;

export interface DemoUser {
  email: string;
  role: Role;
  name: string;
  company: string;
}

export const api = {
  login(email: string, password: string) {
    return request<{ token: string; user: AppUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  me() {
    return request<{ user: AppUser }>('/auth/me');
  },

  demoUsers() {
    return request<DemoUser[]>('/auth/demo-users');
  },

  registerCompany(body: {
    companyName: string;
    adminName: string;
    adminEmail: string;
    password: string;
    zone?: string;
  }) {
    return request<{ message: string }>('/auth/register-company', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  agents: {
    list: () => request<Agent[]>('/agents'),
    get: (id: string) => request<AgentDetail>(`/agents/${id}`),
    create: (body: Record<string, unknown>) =>
      request<Agent>('/agents', { method: 'POST', body: JSON.stringify(body) }),
    importCsv: (csv: string) =>
      request<BulkImportResult>('/agents/import', {
        method: 'POST',
        body: JSON.stringify({ csv })
      }),
    importTemplate: async () => {
      const token = getToken();
      const res = await fetch('/api/agents/import/template', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new ApiError('Failed to download template', res.status);
      return res.text();
    },
    uploadKyc: (id: string, docType: string, file: File) => {
      const form = new FormData();
      form.append('docType', docType);
      form.append('file', file);
      return request<KycDocument>(
        `/agents/${id}/kyc-docs`,
        { method: 'POST', body: form },
        false
      );
    },
    uploadKycBulk: (files: File[]) => {
      const form = new FormData();
      for (const file of files) form.append('files', file);
      return request<BulkKycResult>('/agents/kyc-docs/bulk', {
        method: 'POST',
        body: form
      }, false);
    },
    listKyc: (id: string) => request<KycDocument[]>(`/agents/${id}/kyc-docs`),
    update: (id: string, body: Record<string, unknown>) =>
      request<Agent>(`/agents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      })
  },

  visits: {
    list: (date = 'today') => request<Visit[]>(`/visits?date=${date}`),
    create: (body: Record<string, unknown>) =>
      request<Visit>('/visits', { method: 'POST', body: JSON.stringify(body) })
  },

  companies: () => request<Company[]>('/companies'),
  users: () => request<CompanyUser[]>('/users'),
  inviteUser: (body: {
    name: string;
    email: string;
    role: string;
    zone?: string;
  }) =>
    request<CompanyUser & { temporaryPassword?: string }>('/users/invite', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  updateUserRole: (email: string, role: string) =>
    request<CompanyUser>(`/users/${encodeURIComponent(email)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    }),
  updateUser: (email: string, body: { name?: string; zone?: string; status?: string }) =>
    request<CompanyUser>(`/users/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }),
  audit: () => request<AuditEntry[]>('/audit'),

  zones: () => request<string[]>('/zones'),
  officers: () => request<Officer[]>('/officers'),
  alerts: () => request<Alert[]>('/alerts'),
  training: () => request<TrainingModule[]>('/training'),
  floatTrend: () => request<FloatTrend>('/float-trend'),
  floatSync: {
    deliveries: (opts?: { limit?: number; offset?: number }) => {
      const params = new URLSearchParams();
      if (opts?.limit != null) params.set('limit', String(opts.limit));
      if (opts?.offset != null) params.set('offset', String(opts.offset));
      const q = params.toString();
      return request<FloatDeliveriesResponse>(
        `/float-sync/deliveries${q ? `?${q}` : ''}`
      );
    },
    deliveryDetail: (deliveryId: string, opts?: { limit?: number; offset?: number; summary?: boolean }) => {
      const params = new URLSearchParams();
      if (opts?.limit != null) params.set('limit', String(opts.limit));
      if (opts?.offset != null) params.set('offset', String(opts.offset));
      if (opts?.summary) params.set('summary', 'true');
      const q = params.toString();
      return request<FloatDeliveryDetail>(
        `/float-sync/deliveries/${encodeURIComponent(deliveryId)}${q ? `?${q}` : ''}`
      );
    }
  },
  stats: () => request<NetworkStats>('/stats'),

  settings: {
    get: (companyId?: string) => {
      const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
      return request<CompanySettings>(`/settings${q}`);
    },
    update: (body: CompanySettingsUpdate, companyId?: string) => {
      const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
      return request<CompanySettings>(`/settings${q}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
    }
  }
};
