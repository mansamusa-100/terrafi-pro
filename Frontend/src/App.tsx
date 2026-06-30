import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { AgentDrawer } from './components/AgentDrawer';
import { LoginScreen } from './components/LoginScreen';
import { DashboardPage } from './pages/DashboardPage';
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
import { AppDataProvider } from './lib/data-context';
import { canAccess, firstPageFor } from './lib/rbac';
import type { Agent } from './lib/api';

function AppShell({
  page,
  setPage
}: {
  page: string;
  setPage: (p: string) => void;
}) {
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Loading…
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  const handleSetPage = (p: string) => {
    setPage(p);
    setSearchQ('');
    setSelectedAgent(null);
    setMobileNavOpen(false);
  };

  const activePage = canAccess(user.role, page) ? page : firstPageFor(user.role);

  const pageComponents: Record<string, JSX.Element> = {
    dashboard: (
      <DashboardPage
        setActive={handleSetPage}
        setSelectedAgent={setSelectedAgent}
      />
    ),
    companies: <CompaniesPage />,
    agents: (
      <AgentsPage searchQ={searchQ} onAgentClick={setSelectedAgent} />
    ),
    map: <MapPage setSelectedAgent={setSelectedAgent} />,
    visits: <VisitsPage />,
    float: <FloatPage />,
    'float-sync': <FloatSyncPage />,
    performance: <PerformancePage />,
    training: <TrainingPage />,
    compliance: <CompliancePage />,
    users: <UsersPage />,
    audit: <AuditPage />,
    settings: <SettingsPage />
  };

  return (
    <AppDataProvider>
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
          />
          <main className="flex-1 overflow-y-auto">
            {pageComponents[activePage] || pageComponents.dashboard}
          </main>
        </div>

        <AgentDrawer
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      </div>
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
