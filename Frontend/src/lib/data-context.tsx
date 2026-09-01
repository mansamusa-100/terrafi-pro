import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  api,
  ApiError,
  Agent,
  Visit,
  Officer,
  Alert,
  TrainingModule,
  Company,
  CompanyUser,
  AuditEntry,
  NotificationReportEntry,
  FloatTrend,
  NetworkStats,
  BulkImportResult,
  BulkKycResult,
  KycStats,
  KycReviewItem,
  Notification,
  PlatformStats,
  VisitSummary,
  AdrPerformance,
  AgentSparklines
} from './api';
import { useAuth } from './auth';
import { Role, AppUser, hasAssignedCap } from './rbac';
import {
  enqueueVisit,
  getDeviceId,
  getQueuedVisitCount,
  getQueuedVisits,
  isBrowserOnline,
  isNetworkError,
  removeQueuedVisit,
  updateQueuedVisitError
} from './offline-visits';

interface AppDataContextValue {
  agents: Agent[];
  visits: Visit[];
  officers: Officer[];
  alerts: Alert[];
  training: TrainingModule[];
  companies: Company[];
  users: CompanyUser[];
  auditLogs: AuditEntry[];
  notificationReports: NotificationReportEntry[];
  zones: string[];
  floatTrend: FloatTrend | null;
  stats: NetworkStats | null;
  kycStats: KycStats | null;
  kycReviewQueue: KycReviewItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createAgent: (
    body: Record<string, unknown>,
    kycFiles?: Record<string, File | File[]>,
    locationPhoto?: File
  ) => Promise<Agent>;
  logVisit: (body: Record<string, unknown>) => Promise<Visit>;
  scheduleVisit: (body: Record<string, unknown>) => Promise<Visit>;
  updateVisit: (id: number, body: Record<string, unknown>) => Promise<Visit>;
  dismissAlert: (id: number) => Promise<void>;
  visitSummary: VisitSummary | null;
  adrPerformance: AdrPerformance[];
  adrMyPerformance: AdrPerformance | null;
  agentSparklines: AgentSparklines | null;
  queuedVisitCount: number;
  visitSyncing: boolean;
  syncQueuedVisits: () => Promise<{ synced: number; failed: number }>;
  updateUserRole: (email: string, role: string) => Promise<void>;
  updateUser: (
    email: string,
    body: { name?: string; zone?: string; status?: string }
  ) => Promise<void>;
  updateUserCapabilities: (email: string, capabilities: string[]) => Promise<void>;
  updateSupervisedAdrs: (email: string, adrIds: string[]) => Promise<void>;
  inviteUser: (body: {
    name: string;
    email: string;
    role: string;
    zone?: string;
    supervised_adr_ids?: string[];
    internal_capabilities?: string[];
  }) => Promise<
    CompanyUser & {
      temporaryPassword?: string;
      passwordReused?: boolean;
      message?: string;
      credentialDelivery?: string;
    }
  >;
  resetUserPassword: (email: string, opts?: { companyId?: string }) => Promise<
    CompanyUser & {
      temporaryPassword?: string;
      message?: string;
      credentialDelivery?: string;
    }
  >;
  importAgents: (csv: string) => Promise<BulkImportResult>;
  bulkUploadKyc: (files: File[]) => Promise<BulkKycResult>;
  updateAgent: (id: string, body: Record<string, unknown>) => Promise<void>;
  reviewKyc: (
    agentId: string,
    action: 'approve' | 'reject',
    note?: string
  ) => Promise<void>;
  notifications: Notification[];
  unreadNotificationCount: number;
  markNotificationRead: (id: number) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  platformStats: PlatformStats | null;
  updateCompanyStatus: (id: string, status: 'active' | 'suspended') => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function needsAgents(user: AppUser) {
  if (isPlatformRole(user.role)) return false;
  if (user.role === 'internal') return hasAssignedCap(user, 'view_agents') || hasAssignedCap(user, 'edit_agents');
  return true;
}

function isPlatformRole(role: Role) {
  return role === 'system_owner' || role === 'platform_staff';
}

function needsVisits(user: AppUser) {
  if (['manager', 'team_lead', 'adr', 'agent'].includes(user.role)) return true;
  if (user.role === 'internal') return hasAssignedCap(user, 'view_visits');
  return false;
}

function needsNetworkData(role: Role) {
  return ['manager', 'internal', 'team_lead', 'adr', 'agent', 'teller'].includes(role);
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [training, setTraining] = useState<TrainingModule[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [notificationReports, setNotificationReports] = useState<
    NotificationReportEntry[]
  >([]);
  const [zones, setZones] = useState<string[]>([]);
  const [floatTrend, setFloatTrend] = useState<FloatTrend | null>(null);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [kycStats, setKycStats] = useState<KycStats | null>(null);
  const [kycReviewQueue, setKycReviewQueue] = useState<KycReviewItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [visitSummary, setVisitSummary] = useState<VisitSummary | null>(null);
  const [adrPerformance, setAdrPerformance] = useState<AdrPerformance[]>([]);
  const [adrMyPerformance, setAdrMyPerformance] = useState<AdrPerformance | null>(null);
  const [agentSparklines, setAgentSparklines] = useState<AgentSparklines | null>(null);
  const [queuedVisitCount, setQueuedVisitCount] = useState(getQueuedVisitCount);
  const [visitSyncing, setVisitSyncing] = useState(false);
  const visitSyncingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setAgents([]);
      setVisits([]);
      setOfficers([]);
      setAlerts([]);
      setTraining([]);
      setCompanies([]);
      setUsers([]);
      setAuditLogs([]);
      setNotificationReports([]);
      setZones([]);
      setFloatTrend(null);
      setStats(null);
      setKycStats(null);
      setKycReviewQueue([]);
      setNotifications([]);
      setUnreadNotificationCount(0);
      setPlatformStats(null);
      setVisitSummary(null);
      setAdrPerformance([]);
      setAdrMyPerformance(null);
      setAgentSparklines(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetches: Promise<void>[] = [];

      fetches.push(
        api.notifications.list({ unreadOnly: true }).then(setNotifications),
        api.notifications.unreadCount().then((r) => setUnreadNotificationCount(r.count))
      );

      if (isPlatformRole(user.role)) {
        fetches.push(api.companies.list().then(setCompanies));
        fetches.push(api.users().then(setUsers));
        fetches.push(api.audit({ limit: 100 }).then(setAuditLogs));
        fetches.push(
          api.notificationReports({ limit: 200 }).then(setNotificationReports)
        );
        fetches.push(api.platform.stats().then(setPlatformStats));
      }

      if (user.role === 'manager') {
        fetches.push(api.users().then(setUsers));
        fetches.push(api.audit().then(setAuditLogs));
        fetches.push(
          api.notificationReports({ limit: 200 }).then(setNotificationReports)
        );
      }

      if (user.role === 'internal') {
        if (hasAssignedCap(user, 'view_audit')) {
          fetches.push(api.audit().then(setAuditLogs));
        }
        if (hasAssignedCap(user, 'view_notification_report')) {
          fetches.push(
            api.notificationReports({ limit: 200 }).then(setNotificationReports)
          );
        }
      }

      if (user.role === 'team_lead') {
        fetches.push(api.users().then(setUsers));
      }

      if (needsAgents(user)) {
        fetches.push(api.agents.list().then(setAgents));
        fetches.push(api.zones().then(setZones));
      }

      if (needsVisits(user)) {
        fetches.push(api.visits.list().then(setVisits));
        fetches.push(api.visits.summary().then(setVisitSummary));
      }

      if (needsNetworkData(user.role)) {
        fetches.push(
          api.stats().then(setStats),
          api.alerts().then(setAlerts),
          api.floatTrend().then(setFloatTrend)
        );
      }

      if (['manager', 'internal', 'team_lead', 'adr', 'agent'].includes(user.role)) {
        fetches.push(
          api.officers().then(setOfficers),
          api.training().then(setTraining)
        );
      }

      if (['manager', 'internal', 'team_lead'].includes(user.role)) {
        fetches.push(api.performance.adr().then(setAdrPerformance));
        fetches.push(api.performance.agentSparklines().then(setAgentSparklines));
      }

      if (['manager', 'internal'].includes(user.role)) {
        fetches.push(api.kyc.stats().then(setKycStats));
        fetches.push(api.kyc.reviewQueue().then(setKycReviewQueue));
      }

      if (user.role === 'adr') {
        fetches.push(api.performance.adrMe().then(setAdrMyPerformance));
      }

      await Promise.all(fetches);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createAgent = useCallback(
    async (
      body: Record<string, unknown>,
      kycFiles?: Record<string, File | File[]>,
      locationPhoto?: File
    ) => {
      const agent = await api.agents.create(body);
      try {
        if (locationPhoto) {
          await api.agents.uploadLocationPhoto(agent.id, locationPhoto);
        }
        if (kycFiles && Object.keys(kycFiles).length > 0) {
          for (const [docType, value] of Object.entries(kycFiles)) {
            const files = Array.isArray(value) ? value : [value];
            for (const file of files) {
              await api.agents.uploadKyc(agent.id, docType, file);
            }
          }
        }
      } catch (err) {
        const detail =
          err instanceof ApiError ? err.message : 'Upload failed';
        throw new ApiError(
          `${agent.name} (${agent.id}) was created, but upload failed: ${detail}. Open the agent profile to retry.`,
          err instanceof ApiError ? err.status : 0
        );
      }
      await refresh();
      const refreshed = await api.agents.get(agent.id);
      return refreshed;
    },
    [refresh]
  );

  useEffect(() => {
    const refreshCount = () => setQueuedVisitCount(getQueuedVisitCount());
    window.addEventListener('offline-visits-changed', refreshCount);
    window.addEventListener('online', refreshCount);
    window.addEventListener('offline', refreshCount);
    return () => {
      window.removeEventListener('offline-visits-changed', refreshCount);
      window.removeEventListener('online', refreshCount);
      window.removeEventListener('offline', refreshCount);
    };
  }, []);

  const syncQueuedVisits = useCallback(async () => {
    if (!isBrowserOnline() || visitSyncingRef.current) {
      return { synced: 0, failed: 0 };
    }

    const queue = getQueuedVisits();
    if (queue.length === 0) {
      setQueuedVisitCount(0);
      return { synced: 0, failed: 0 };
    }

    visitSyncingRef.current = true;
    setVisitSyncing(true);
    let synced = 0;
    let failed = 0;

    try {
      for (const item of queue) {
        try {
          await api.visits.create(item.body);
          removeQueuedVisit(item.id);
          synced++;
        } catch (err) {
          failed++;
          const message =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Sync failed';
          updateQueuedVisitError(item.id, message);
          if (isNetworkError(err)) break;
        }
      }
      setQueuedVisitCount(getQueuedVisitCount());
      if (synced > 0) await refresh();
      return { synced, failed };
    } finally {
      visitSyncingRef.current = false;
      setVisitSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    if (!['manager', 'adr'].includes(user.role)) return;

    const trySync = () => {
      if (isBrowserOnline() && getQueuedVisitCount() > 0) {
        syncQueuedVisits().catch(() => {});
      }
    };

    trySync();
    window.addEventListener('online', trySync);
    return () => window.removeEventListener('online', trySync);
  }, [user, syncQueuedVisits]);

  const queueVisitOffline = useCallback(
    (body: Record<string, unknown>) => {
      const agent = agents.find((a) => a.id === body.agentId);
      const payload = {
        ...body,
        offline: true,
        deviceId: getDeviceId()
      };
      const item = enqueueVisit(payload, {
        agentName: agent?.name || String(body.agentId),
        captureDistance:
          typeof body.captureDistance === 'number' ? body.captureDistance : null,
        gpsOkAtCapture: body.gpsOkAtCapture === true
      });
      setQueuedVisitCount(getQueuedVisitCount());
      return {
        agent: agent?.name || String(body.agentId),
        agent_id: String(body.agentId),
        officer: '',
        status: 'queued',
        time: new Date().toTimeString().slice(0, 5),
        type: String(body.type || 'Visit'),
        zone: agent?.zone || '',
        offlineQueued: true,
        queueId: item.id
      } satisfies Visit;
    },
    [agents]
  );

  const logVisit = useCallback(
    async (body: Record<string, unknown>) => {
      const payload = { ...body, deviceId: getDeviceId() };
      if (!isBrowserOnline()) {
        return queueVisitOffline(payload);
      }
      try {
        const visit = await api.visits.create(payload);
        await refresh();
        return visit;
      } catch (err) {
        if (isNetworkError(err)) {
          return queueVisitOffline(payload);
        }
        throw err;
      }
    },
    [refresh, queueVisitOffline]
  );

  const scheduleVisit = useCallback(
    async (body: Record<string, unknown>) => {
      const visit = await api.visits.schedule(body);
      await refresh();
      return visit;
    },
    [refresh]
  );

  const updateVisit = useCallback(
    async (id: number, body: Record<string, unknown>) => {
      const visit = await api.visits.update(id, body);
      await refresh();
      return visit;
    },
    [refresh]
  );

  const dismissAlert = useCallback(
    async (id: number) => {
      await api.dismissAlert(id);
      await refresh();
    },
    [refresh]
  );

  const updateUserRole = useCallback(
    async (email: string, role: string) => {
      await api.updateUserRole(email, role);
      await refresh();
    },
    [refresh]
  );

  const inviteUser = useCallback(
    async (body: {
      name: string;
      email: string;
      role: string;
      zone?: string;
      supervised_adr_ids?: string[];
      internal_capabilities?: string[];
    }) => {
      const created = await api.inviteUser(body);
      await refresh();
      return created;
    },
    [refresh]
  );

  const resetUserPassword = useCallback(
    async (email: string, opts?: { companyId?: string }) => {
      const result = await api.resetUserPassword(email, opts);
      await refresh();
      return result;
    },
    [refresh]
  );

  const importAgents = useCallback(
    async (csv: string) => {
      const result = await api.agents.importCsv(csv);
      await refresh();
      return result;
    },
    [refresh]
  );

  const bulkUploadKyc = useCallback(
    async (files: File[]) => {
      const result = await api.agents.uploadKycBulk(files);
      await refresh();
      return result;
    },
    [refresh]
  );

  const updateUser = useCallback(
    async (
      email: string,
      body: { name?: string; zone?: string; status?: string }
    ) => {
      await api.updateUser(email, body);
      await refresh();
    },
    [refresh]
  );

  const updateUserCapabilities = useCallback(
    async (email: string, capabilities: string[]) => {
      await api.updateUserCapabilities(email, capabilities);
      await refresh();
    },
    [refresh]
  );

  const updateSupervisedAdrs = useCallback(
    async (email: string, adrIds: string[]) => {
      await api.updateSupervisedAdrs(email, adrIds);
      await refresh();
    },
    [refresh]
  );

  const updateAgent = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      await api.agents.update(id, body);
      await refresh();
    },
    [refresh]
  );

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    const [list, { count }] = await Promise.all([
      api.notifications.list({ unreadOnly: true }),
      api.notifications.unreadCount()
    ]);
    setNotifications(list);
    setUnreadNotificationCount(count);
  }, [user]);

  const markNotificationRead = useCallback(
    async (id: number) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
      try {
        await api.notifications.markRead(id);
      } catch {
        await refreshNotifications();
      }
    },
    [refreshNotifications]
  );

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications([]);
    setUnreadNotificationCount(0);
    try {
      await api.notifications.markAllRead();
    } catch {
      await refreshNotifications();
    }
  }, [refreshNotifications]);

  const reviewKyc = useCallback(
    async (agentId: string, action: 'approve' | 'reject', note?: string) => {
      await api.kyc.review(agentId, { action, note });
      await refresh();
    },
    [refresh]
  );

  const updateCompanyStatus = useCallback(
    async (id: string, status: 'active' | 'suspended') => {
      await api.companies.updateStatus(id, status);
      await refresh();
    },
    [refresh]
  );

  return (
    <AppDataContext.Provider
      value={{
        agents,
        visits,
        officers,
        alerts,
        training,
        companies,
        users,
        auditLogs,
        notificationReports,
        zones,
        floatTrend,
        stats,
        kycStats,
        kycReviewQueue,
        loading,
        error,
        refresh,
        createAgent,
        logVisit,
        updateUserRole,
        inviteUser,
        resetUserPassword,
        importAgents,
        bulkUploadKyc,
        updateUser,
        updateUserCapabilities,
        updateSupervisedAdrs,
        updateAgent,
        reviewKyc,
        notifications,
        unreadNotificationCount,
        markNotificationRead,
        markAllNotificationsRead,
        refreshNotifications,
        platformStats,
        updateCompanyStatus,
        visitSummary,
        adrPerformance,
        adrMyPerformance,
        agentSparklines,
        queuedVisitCount,
        visitSyncing,
        syncQueuedVisits,
        scheduleVisit,
        updateVisit,
        dismissAlert
      }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
