import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';
import {
  api,
  Agent,
  Visit,
  Officer,
  Alert,
  TrainingModule,
  Company,
  CompanyUser,
  FloatTrend,
  NetworkStats,
  BulkImportResult,
  BulkKycResult,
  KycStats,
  KycReviewItem,
  Notification,
  PlatformStats,
  VisitSummary,
  AdrPerformance
} from './api';
import { useAuth } from './auth';
import { Role } from './rbac';

interface AppDataContextValue {
  agents: Agent[];
  visits: Visit[];
  officers: Officer[];
  alerts: Alert[];
  training: TrainingModule[];
  companies: Company[];
  users: CompanyUser[];
  auditLogs: AuditEntry[];
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
    kycFiles?: Record<string, File>
  ) => Promise<Agent>;
  logVisit: (body: Record<string, unknown>) => Promise<Visit>;
  scheduleVisit: (body: Record<string, unknown>) => Promise<Visit>;
  updateVisit: (id: number, body: Record<string, unknown>) => Promise<Visit>;
  dismissAlert: (id: number) => Promise<void>;
  visitSummary: VisitSummary | null;
  adrPerformance: AdrPerformance[];
  adrMyPerformance: AdrPerformance | null;
  updateUserRole: (email: string, role: string) => Promise<void>;
  updateUser: (
    email: string,
    body: { name?: string; zone?: string; status?: string }
  ) => Promise<void>;
  inviteUser: (body: {
    name: string;
    email: string;
    role: string;
    zone?: string;
  }  ) => Promise<CompanyUser & { temporaryPassword?: string }>;
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

function needsAgents(role: Role) {
  return !['system_owner', 'platform_staff'].includes(role);
}

function isPlatformRole(role: Role) {
  return role === 'system_owner' || role === 'platform_staff';
}

function needsVisits(role: Role) {
  return ['manager', 'internal', 'adr', 'agent'].includes(role);
}

function needsNetworkData(role: Role) {
  return ['manager', 'internal', 'adr', 'agent', 'teller'].includes(role);
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
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetches: Promise<void>[] = [];

      fetches.push(
        api.notifications.list().then(setNotifications),
        api.notifications.unreadCount().then((r) => setUnreadNotificationCount(r.count))
      );

      if (isPlatformRole(user.role)) {
        fetches.push(api.companies.list().then(setCompanies));
        fetches.push(api.users().then(setUsers));
        fetches.push(api.audit({ limit: 100 }).then(setAuditLogs));
        fetches.push(api.platform.stats().then(setPlatformStats));
      }

      if (user.role === 'manager') {
        fetches.push(api.users().then(setUsers));
        fetches.push(api.audit().then(setAuditLogs));
      }

      if (needsAgents(user.role)) {
        fetches.push(api.agents.list().then(setAgents));
        fetches.push(api.zones().then(setZones));
      }

      if (needsVisits(user.role)) {
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

      if (['manager', 'internal', 'adr', 'agent'].includes(user.role)) {
        fetches.push(
          api.officers().then(setOfficers),
          api.training().then(setTraining)
        );
      }

      if (['manager', 'internal'].includes(user.role)) {
        fetches.push(api.kyc.stats().then(setKycStats));
        fetches.push(api.kyc.reviewQueue().then(setKycReviewQueue));
        fetches.push(api.performance.adr().then(setAdrPerformance));
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
      kycFiles?: Record<string, File>
    ) => {
      const agent = await api.agents.create(body);
      if (kycFiles) {
        for (const [docType, file] of Object.entries(kycFiles)) {
          await api.agents.uploadKyc(agent.id, docType, file);
        }
      }
      await refresh();
      return agent;
    },
    [refresh]
  );

  const logVisit = useCallback(
    async (body: Record<string, unknown>) => {
      const visit = await api.visits.create(body);
      await refresh();
      return visit;
    },
    [refresh]
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
    }) => {
      const created = await api.inviteUser(body);
      await refresh();
      return created;
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
      api.notifications.list(),
      api.notifications.unreadCount()
    ]);
    setNotifications(list);
    setUnreadNotificationCount(count);
  }, [user]);

  const markNotificationRead = useCallback(
    async (id: number) => {
      await api.notifications.markRead(id);
      await refreshNotifications();
    },
    [refreshNotifications]
  );

  const markAllNotificationsRead = useCallback(async () => {
    await api.notifications.markAllRead();
    await refreshNotifications();
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
        importAgents,
        bulkUploadKyc,
        updateUser,
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
