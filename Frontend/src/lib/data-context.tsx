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
  BulkKycResult
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
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createAgent: (
    body: Record<string, unknown>,
    kycFiles?: Record<string, File>
  ) => Promise<Agent>;
  logVisit: (body: Record<string, unknown>) => Promise<Visit>;
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
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetches: Promise<void>[] = [];

      if (isPlatformRole(user.role)) {
        fetches.push(api.companies().then(setCompanies));
        fetches.push(api.users().then(setUsers));
        fetches.push(api.audit().then(setAuditLogs));
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
        updateAgent
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
