import React, { useEffect, useMemo, useState } from 'react';
import { ScrollText, Filter, Search, CalendarDays } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { PAGE_SIZE, useClientPagination } from '../lib/useClientPagination';
import { cn } from '../lib/utils';

const ACTION_LABELS: Record<string, string> = {
  'user.invited': 'User invited',
  'user.password_reset': 'Password reset',
  'user.role_updated': 'Role updated',
  'user.updated': 'User updated',
  'user.capabilities_updated': 'Permissions updated',
  'user.supervised_adrs_updated': 'Supervised ADRs updated',
  'company.registered': 'Company registered',
  'company.status_changed': 'Company status changed',
  'agent.onboarded': 'Agent onboarded',
  'kyc.uploaded': 'KYC uploaded',
  'kyc.approved': 'KYC approved',
  'kyc.rejected': 'KYC rejected',
  'visit.scheduled': 'Visit scheduled',
  'visit.logged': 'Visit logged',
  'visit.logged_offline': 'Offline visit synced',
  'auth.login': 'Sign in',
  'auth.password_set': 'Password set'
};

const ACTION_FILTERS = [
  { value: '', label: 'All actions' },
  { value: 'visit.logged', label: 'Visits logged' },
  { value: 'visit.scheduled', label: 'Visits scheduled' },
  { value: 'kyc.approved', label: 'KYC approved' },
  { value: 'kyc.rejected', label: 'KYC rejected' },
  { value: 'kyc.uploaded', label: 'KYC uploads' },
  { value: 'agent.onboarded', label: 'Agent onboarded' },
  { value: 'user.invited', label: 'Invites' },
  { value: 'user.password_reset', label: 'Password resets' },
  { value: 'user.role_updated', label: 'Role changes' },
  { value: 'user.capabilities_updated', label: 'Permission changes' },
  { value: 'user.updated', label: 'User updates' },
  { value: 'company.registered', label: 'Registrations' },
  { value: 'company.status_changed', label: 'Status changes' },
  { value: 'auth.login', label: 'Sign ins' }
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatAction(action: string) {
  return ACTION_LABELS[action] || action.replace(/\./g, ' · ');
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function formatDetails(details: Record<string, unknown> | null) {
  if (!details) return '—';
  const parts: string[] = [];
  if (details.companyName) parts.push(String(details.companyName));
  if (details.agentName) parts.push(String(details.agentName));
  if (details.invitedName) parts.push(String(details.invitedName));
  if (details.email) parts.push(String(details.email));
  if (details.from && details.to) parts.push(`${details.from} → ${details.to}`);
  if (details.role) parts.push(String(details.role));
  if (details.officer) parts.push(`officer: ${details.officer}`);
  if (details.type) parts.push(String(details.type));
  if (details.temporaryPassword) {
    parts.push(`temp password: ${details.temporaryPassword}`);
  }
  if (details.reason) parts.push(String(details.reason));
  return parts.length > 0 ? parts.join(' · ') : JSON.stringify(details);
}

export function AuditPage() {
  const { user } = useAuth();
  const { auditLogs, loadAuditLogs } = useAppData();
  const isOwner = user?.role === 'system_owner';
  const isPlatform = isOwner || user?.role === 'platform_staff';
  const scopeLabel = isPlatform ? 'Platform' : 'Organisation';
  const today = todayISO();

  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadAuditLogs({
      from: dateFrom || today,
      to: dateTo || dateFrom || today,
      action: actionFilter || undefined,
      limit: 300
    })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, actionFilter, loadAuditLogs, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter((e) => {
      const detailText = formatDetails(e.details).toLowerCase();
      return (
        formatAction(e.action).toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.actorName.toLowerCase().includes(q) ||
        e.actorEmail.toLowerCase().includes(q) ||
        detailText.includes(q) ||
        (e.entityType?.toLowerCase().includes(q) ?? false) ||
        (e.entityId?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [auditLogs, search]);

  const {
    pageItems: pageLogs,
    total: auditTotal,
    limit: auditLimit,
    offset: auditOffset,
    setOffset: setAuditOffset
  } = useClientPagination(
    filtered,
    PAGE_SIZE.default,
    `${actionFilter}|${search}|${dateFrom}|${dateTo}`
  );

  const showingToday = dateFrom === today && dateTo === today;

  return (
    <div className="page-pad">
      <div className="metric-grid-3 mb-6">
        <MetricCard
          label={showingToday ? 'Events today' : 'Events in range'}
          value={filtered.length}
          icon={<ScrollText className="w-5 h-5" />}
          accent="#1565C0"
        />
        <MetricCard
          label="Date range"
          value={showingToday ? 'Today' : `${dateFrom} → ${dateTo}`}
          sub={showingToday ? 'Change dates below for history' : undefined}
          icon={<CalendarDays className="w-5 h-5" />}
          accent="#00897B"
        />
        <MetricCard
          label="Scope"
          value={scopeLabel}
          sub={
            isOwner
              ? 'Platform ops + company lifecycle'
              : isPlatform
                ? 'Platform operations'
                : 'Your company only'
          }
          icon={<ScrollText className="w-5 h-5" />}
          accent="#6D28D9"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {scopeLabel} audit log
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Showing {showingToday ? "today's" : 'selected'} activity. Search
              within the range or pick past dates to review history.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 gap-2 flex-1 min-w-[180px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search action, actor, details…"
                aria-label="Search audit log"
                className="bg-transparent border-none outline-none text-xs text-slate-800 w-full placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                aria-label="Filter by action"
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700">
                {ACTION_FILTERS.filter((f) =>
                  isPlatform ? true : !f.value.startsWith('company.')
                ).map((f) => (
                  <option key={f.value || 'all'} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="From date"
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="To date"
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700"
              />
              {!showingToday && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom(today);
                    setDateTo(today);
                  }}
                  className="text-xs font-medium text-apsBlue hover:underline px-1">
                  Today
                </button>
              )}
            </div>
          </div>
        </div>

        <DataTable minWidth="640px">
          <div className="grid grid-cols-[1.2fr_1.5fr_1fr_1.5fr] gap-4 pb-3 mb-2 border-b border-slate-200">
            {['When', 'Action', 'Actor', 'Details'].map((h) => (
              <div
                key={h}
                className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {h}
              </div>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 py-8 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              {search.trim()
                ? 'No events match your search.'
                : showingToday
                  ? 'No audit events today.'
                  : 'No audit events in this date range.'}
            </p>
          ) : (
            pageLogs.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-[1.2fr_1.5fr_1fr_1.5fr] gap-4 py-3 border-b border-slate-100 last:border-0 items-start">
                <div className="text-xs text-slate-600">{formatWhen(e.createdAt)}</div>
                <div>
                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2.5 py-1 rounded-full',
                      e.action.startsWith('company.')
                        ? 'bg-indigo-100 text-indigo-700'
                        : e.action.startsWith('user.')
                          ? 'bg-apsBlueLt text-apsBlue'
                          : e.action.startsWith('visit.')
                            ? 'bg-teal-100 text-teal-800'
                            : e.action.startsWith('kyc.')
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-slate-100 text-slate-700'
                    )}>
                    {formatAction(e.action)}
                  </span>
                  {e.entityType && (
                    <div className="text-[10px] text-slate-400 mt-1">
                      {e.entityType}
                      {e.entityId ? ` · ${e.entityId}` : ''}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-900 truncate">
                    {e.actorName}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {e.actorEmail}
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 break-words">
                  {formatDetails(e.details)}
                </div>
              </div>
            ))
          )}
        </DataTable>
        <Pagination
          total={auditTotal}
          limit={auditLimit}
          offset={auditOffset}
          onPageChange={setAuditOffset}
        />
      </div>
    </div>
  );
}
