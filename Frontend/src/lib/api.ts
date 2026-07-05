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

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      'Cannot reach the server. Start the backend with npm run dev in the Backend folder.',
      0
    );
  }
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
  outlet_name?: string | null;
  zone: string;
  town_village?: string | null;
  phone: string;
  personal_phone?: string | null;
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
  kyc_review_note?: string | null;
  kyc_reviewed_at?: string | null;
  last_visit: string | null;
  national_id?: string | null;
  business_type?: string | null;
  business_type_other?: string | null;
  competitors_present?: string[];
  branding_present?: string[];
  location_photo_url?: string | null;
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

export interface KycStats {
  total: number;
  suspended: number;
  counts: {
    verified: number;
    pending: number;
    incomplete: number;
    expired: number;
  };
  complianceRate: number;
}

export interface KycReviewItem extends Agent {
  submitted_at?: string | null;
  kyc_docs: KycDocument[];
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
  visit_date?: string;
  notes?: string | null;
  offlineQueued?: boolean;
  queueId?: string;
}

export interface VisitSummary {
  today: {
    scheduled: number;
    done: number;
    pending: number;
    missed: number;
  };
  monthCompleted: number;
  weeklyVolume: {
    labels: string[];
    values: number[];
  };
}

export interface Alert {
  id?: number;
  type: string;
  title: string;
  body: string;
  time: string;
  agent: string | null;
}

export interface Officer {
  name: string;
  agents: number;
  visits: number;
  target: number;
  score: number;
  zone: string;
}

export interface AdrPerformance {
  id: string;
  name: string;
  zone: string;
  agents: number;
  visits_done: number;
  visits_pending: number;
  visits_missed: number;
  visit_target: number;
  visit_rate: number;
  kyc_verified: number;
  kyc_rate: number;
  onboarded_month: number;
  score: number;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  company_id: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
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
  subscriptionStatus?: string | null;
  subscriptionPlanCode?: string | null;
  userCount?: number;
}

export interface CompanySubscription {
  status: string | null;
  planCode: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  billingInterval: string | null;
  payUrl: string | null;
  syncedAt: string | null;
  provisioned: boolean;
  accessAllowed: boolean;
}

export interface CompanyDetail extends Company {
  visitCount: number;
  agentCount: number;
  directPaySlug?: string | null;
  subscription: CompanySubscription;
  users: CompanyUser[];
  recentAudit: {
    id: number;
    action: string;
    actorName: string;
    createdAt: string;
    details: Record<string, unknown> | null;
  }[];
}

export interface PlatformStats {
  companies: {
    total: number;
    active: number;
    suspended: number;
    signups7d: number;
    signups30d: number;
  };
  agents: { total: number };
  users: { platform: number; company: number };
  revenue: { mrr: number };
  subscriptions: Record<string, number>;
  recentSignups: {
    id: string;
    name: string;
    status: string;
    contactEmail?: string | null;
    registeredAt: string;
    subscriptionStatus?: string | null;
  }[];
}

export interface CompanyUser {
  id?: string;
  name: string;
  email: string;
  role: string;
  zone: string | null;
  status: string;
  scope?: string;
  supervised_adr_ids?: string[];
}

export interface AuditEntry {
  id: number;
  scope: string;
  action: string;
  actorName: string;
  actorEmail: string;
  entityType: string | null;
  entityId: string | null;
  companyId?: string | null;
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

export interface OnboardingConfig {
  business_types: string[];
  zone_names: string[];
  competitor_names: string[];
  branding_types: string[];
}

export interface CompanySettings {
  company_id: string;
  branding: {
    company_name: string;
    logo_url: string | null;
  };
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
  onboarding: OnboardingConfig;
  integration: {
    core_wallet_api: string;
    sms_gateway: string;
    email_notifications: string;
    export_format: string;
  };
  integration_editable: boolean;
  updated_at: string;
}

export interface SubscriptionView {
  status: string | null;
  planCode: string | null;
  periodStart?: string | null;
  periodEnd: string | null;
  billingInterval?: string | null;
  payUrl: string | null;
  syncedAt?: string | null;
  provisioned: boolean;
  accessAllowed: boolean;
}

export interface BillingStatus {
  company_id: string;
  company_name: string;
  configured: boolean;
  subscription: SubscriptionView;
}

export interface PayLinkResult {
  ok: boolean;
  payUrl: string | null;
  invoiceCreated: boolean;
  pendingInvoice: {
    id: string;
    amount: string;
    currency: string;
    status: string;
    dueDate: string;
    guestToken: string | null;
  } | null;
}

export type CompanySettingsUpdate = Partial<{
  default_float_threshold: number;
  visit_frequency_target: number;
  alert_notification_delay_minutes: number;
  auto_suspend_missed_visits_days: number;
  active_zones: number;
  sub_territories: number;
  coverage_model: string;
  business_types: string[] | string;
  zone_names: string[] | string;
  competitor_names: string[] | string;
  branding_types: string[] | string;
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
    return request<{ user: AppUser; subscription: SubscriptionView | null }>(
      '/auth/me'
    );
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
    return request<{
      message: string;
      billing?: { payUrl: string | null; configured: boolean };
    }>('/auth/register-company', {
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
    uploadLocationPhoto: (id: string, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<{ location_photo_url: string }>(
        `/agents/${id}/location-photo`,
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

  kyc: {
    stats: () => request<KycStats>('/kyc/stats'),
    reviewQueue: () => request<KycReviewItem[]>('/kyc/review-queue'),
    review: (agentId: string, body: { action: 'approve' | 'reject'; note?: string }) =>
      request<Agent>(`/kyc/review/${agentId}`, {
        method: 'POST',
        body: JSON.stringify(body)
      })
  },

  visits: {
    list: (date = 'today') => request<Visit[]>(`/visits?date=${date}`),
    summary: () => request<VisitSummary>('/visits/summary'),
    schedule: (body: Record<string, unknown>) =>
      request<Visit>('/visits/schedule', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    update: (id: number, body: Record<string, unknown>) =>
      request<Visit>(`/visits/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      }),
    create: (body: Record<string, unknown>) =>
      request<Visit>('/visits', { method: 'POST', body: JSON.stringify(body) })
  },

  companies: {
    list: () => request<Company[]>('/companies'),
    get: (id: string) => request<CompanyDetail>(`/companies/${id}`),
    updateStatus: (id: string, status: 'active' | 'suspended') =>
      request<{ id: string; name: string; status: string }>(
        `/companies/${id}/status`,
        { method: 'PATCH', body: JSON.stringify({ status }) }
      )
  },
  platform: {
    stats: () => request<PlatformStats>('/platform/stats')
  },
  performance: {
    adr: () => request<AdrPerformance[]>('/performance/adr'),
    adrMe: () => request<AdrPerformance | null>('/performance/adr/me')
  },
  export: {
    agents: () => '/export/agents',
    visits: (from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const q = params.toString();
      return `/export/visits${q ? `?${q}` : ''}`;
    },
    adrPerformance: () => '/export/adr-performance',
    compliance: () => '/export/compliance'
  },
  users: () => request<CompanyUser[]>('/users'),
  inviteUser: (body: {
    name: string;
    email: string;
    role: string;
    zone?: string;
    supervised_adr_ids?: string[];
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
  updateSupervisedAdrs: (email: string, adr_ids: string[]) =>
    request<CompanyUser>(`/users/${encodeURIComponent(email)}/supervised-adrs`, {
      method: 'PATCH',
      body: JSON.stringify({ adr_ids })
    }),
  updateUser: (email: string, body: { name?: string; zone?: string; status?: string }) =>
    request<CompanyUser>(`/users/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }),
  audit: (opts?: { limit?: number; action?: string }) => {
    const params = new URLSearchParams();
    if (opts?.limit != null) params.set('limit', String(opts.limit));
    if (opts?.action) params.set('action', opts.action);
    const q = params.toString();
    return request<AuditEntry[]>(`/audit${q ? `?${q}` : ''}`);
  },

  zones: () => request<string[]>('/zones'),
  onboardingConfig: () => request<OnboardingConfig>('/onboarding-config'),
  officers: () => request<Officer[]>('/officers'),
  alerts: () => request<Alert[]>('/alerts'),
  dismissAlert: (id: number) =>
    request<{ id: number; dismissed: boolean }>(`/alerts/${id}/dismiss`, {
      method: 'PATCH'
    }),
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

  notifications: {
    list: (limit = 30) =>
      request<Notification[]>(`/notifications?limit=${limit}`),
    unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
    markRead: (id: number) =>
      request<Notification>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () =>
      request<{ updated: number }>('/notifications/read-all', { method: 'POST' })
  },

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
    },
    uploadLogo: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<{ logo_url: string; company_name: string }>(
        '/settings/logo',
        { method: 'POST', body: form },
        false
      );
    },
    deleteLogo: () =>
      request<{ logo_url: null }>('/settings/logo', { method: 'DELETE' })
  },

  billing: {
    status: () => request<BillingStatus>('/billing/status'),
    provision: () =>
      request<{ ok: boolean; subscription: SubscriptionView }>(
        '/billing/provision',
        { method: 'POST', body: JSON.stringify({}) }
      ),
    startSubscription: (planCode?: string, billingInterval?: string) =>
      request<{ ok: boolean; subscription: SubscriptionView }>(
        '/billing/subscription',
        { method: 'POST', body: JSON.stringify({ planCode, billingInterval }) }
      ),
    payLink: () =>
      request<PayLinkResult>('/billing/pay-link', {
        method: 'POST',
        body: JSON.stringify({})
      }),
    sync: () =>
      request<{ ok: boolean; subscription: SubscriptionView }>('/billing/sync', {
        method: 'POST',
        body: JSON.stringify({})
      })
  }
};
