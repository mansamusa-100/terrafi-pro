import React, { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'sonner';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { AgentDrawer } from './components/AgentDrawer';
import { CompanyDrawer } from './components/CompanyDrawer';
import { VisitLogModal } from './components/VisitLogModal';
import { AdrFieldBar } from './components/AdrFieldBar';
import { TeamLeadFieldBar } from './components/TeamLeadFieldBar';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { OfflineVisitBanner } from './components/OfflineVisitBanner';
import { SubscriptionBanner } from './components/SubscriptionBanner';
import { PlatformDashboardPage } from './pages/PlatformDashboardPage';
import { LoginScreen } from './components/LoginScreen';
import { DashboardPage } from './pages/DashboardPage';
import { TeamLeadDashboardPage } from './pages/TeamLeadDashboardPage';
import { AgentsPage } from './pages/AgentsPage';
import { MapPage } from './pages/MapPage';
import { VisitsPage } from './pages/VisitsPage';
import { FloatPage } from './pages/FloatPage';
import { FloatSyncPage } from './pages/FloatSyncPage';
import { PerformancePage } from './pages/PerformancePage';
import { TrainingPage } from './pages/TrainingPage';
import { CompliancePage } from './pages/CompliancePage';
import { SettingsPage } from './pages/SettingsPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { UsersPage } from './pages/UsersPage';
import { AuditPage } from './pages/AuditPage';
import { AuthProvider, useAuth } from './lib/auth';
import { AppDataProvider, useAppData } from './lib/data-context';
import { canAccess, firstPageFor, can } from './lib/rbac';
import {
  useFieldMobileNav,
  isFieldMobileRole,
  type FieldOverlayId
} from './lib/useFieldMobileNav';
import type { Agent } from './lib/api';
import { toast } from 'sonner';

function AuthenticatedApp({
  page,
  setPage
}: {
  page: string;
  setPage: (p: string) => void;
}) {
  const { user } = useAuth();
  const { logVisit, queuedVisitCount, visitSyncing, syncQueuedVisits } = useAppData();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [visitLogOpen, setVisitLogOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  const activePage = user
    ? canAccess(user.role, page)
      ? page
      : firstPageFor(user.role)
    : 'dashboard';
  const isFieldMobile = user ? isFieldMobileRole(user.role) : false;
  const isAdr = user?.role === 'adr';
  const isTeamLead = user?.role === 'team_lead';
  const canLogVisit = user ? can(user.role, 'logVisit') : false;

  const handleSetPage = useCallback(
    (p: string) => {
      setPage(p);
      setSearchQ('');
      setSelectedAgent(null);
      setSelectedCompanyId(null);
      setMobileNavOpen(false);
    },
    [setPage]
  );

  const onCloseOverlay = useCallback((id: FieldOverlayId) => {
    if (id === 'sidebar') setMobileNavOpen(false);
    if (id === 'visit-log') setVisitLogOpen(false);
    if (id === 'agent') setSelectedAgent(null);
    if (id === 'company') setSelectedCompanyId(null);
  }, []);

  useFieldMobileNav({
    enabled: isFieldMobile && !!user,
    role: user?.role ?? 'adr',
    page: activePage,
    setPage: handleSetPage,
    overlays: {
      sidebar: mobileNavOpen,
      visitLog: visitLogOpen,
      agent: !!selectedAgent,
      company: !!selectedCompanyId
    },
    onCloseOverlay
  });

  if (!user) return null;

  const handleSyncVisits = async () => {
    const { synced, failed } = await syncQueuedVisits();
    if (synced > 0) {
      toast.success(
        synced === 1 ? '1 visit synced' : `${synced} visits synced`
      );
    }
    if (failed > 0) {
      toast.error(
        failed === 1
          ? '1 visit could not sync — check GPS or connection'
          : `${failed} visits could not sync`
      );
    }
  };

  const pageComponents: Record<string, JSX.Element> = {
    dashboard:
      user.role === 'system_owner' || user.role === 'platform_staff' ? (
        <PlatformDashboardPage
          setActive={handleSetPage}
          onOpenCompany={setSelectedCompanyId}
        />
      ) : user.role === 'team_lead' ? (
        <TeamLeadDashboardPage
          setActive={handleSetPage}
          setSelectedAgent={setSelectedAgent}
        />
      ) : (
        <DashboardPage
          setActive={handleSetPage}
          setSelectedAgent={setSelectedAgent}
        />
      ),
    companies: <CompaniesPage onOpenCompany={setSelectedCompanyId} />,
    agents: <AgentsPage searchQ={searchQ} onAgentClick={setSelectedAgent} />,
    map: <MapPage setSelectedAgent={setSelectedAgent} />,
    visits: <VisitsPage />,
    float: <FloatPage />,
    'float-sync': <FloatSyncPage />,
    performance: <PerformancePage />,
    training: <TrainingPage />,
    compliance: <CompliancePage onOpenAgent={setSelectedAgent} />,
    users: <UsersPage />,
    audit: <AuditPage />,
    settings: <SettingsPage />
  };

  const fieldMainClass = isFieldMobile ? 'pb-20 lg:pb-0 field-touch' : '';

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden">
      <Sidebar
        active={activePage}
        setActive={handleSetPage}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          page={activePage}
          searchQ={searchQ}
          setSearchQ={setSearchQ}
          onMenuClick={() => setMobileNavOpen(true)}
          setPage={handleSetPage}
          setSelectedAgent={setSelectedAgent}
        />
        {isFieldMobile && <PwaInstallBanner />}
        {canLogVisit && (
          <OfflineVisitBanner
            count={queuedVisitCount}
            syncing={visitSyncing}
            onSync={handleSyncVisits}
          />
        )}
        <SubscriptionBanner />
        <main className={`flex-1 overflow-y-auto ${fieldMainClass}`}>
          {pageComponents[activePage] || pageComponents[firstPageFor(user.role)]}
        </main>
      </div>

      {isAdr && (
        <AdrFieldBar
          active={activePage}
          setActive={handleSetPage}
          onLogVisit={() => setVisitLogOpen(true)}
        />
      )}

      {isTeamLead && (
        <TeamLeadFieldBar
          active={activePage}
          setActive={handleSetPage}
          onLogVisit={() => setVisitLogOpen(true)}
        />
      )}

      {canLogVisit && (
        <VisitLogModal
          open={visitLogOpen}
          onClose={() => setVisitLogOpen(false)}
          onSubmit={logVisit}
        />
      )}

      <AgentDrawer agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      <CompanyDrawer
        companyId={selectedCompanyId}
        onClose={() => setSelectedCompanyId(null)}
      />
    </div>
  );
}

function AppShell({
  page,
  setPage
}: {
  page: string;
  setPage: (p: string) => void;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Loading…
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <AppDataProvider>
      <AuthenticatedApp page={page} setPage={setPage} />
    </AppDataProvider>
  );
}

export function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <AuthProvider onUserChange={setPage}>
      <AppShell page={page} setPage={setPage} />
      <Toaster position="top-center" richColors className="sm:!top-right" />
    </AuthProvider>
  );
}
