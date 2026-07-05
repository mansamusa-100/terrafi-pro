import React, { useMemo, useState } from 'react';
import { ScrollText, Clock, Filter } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import { DataTable } from '../components/DataTable';
import { cn } from '../lib/utils';

const ACTION_LABELS: Record<string, string> = {
  'user.invited': 'User invited',
  'user.role_updated': 'Role updated',
  'user.updated': 'User updated',
  'company.registered': 'Company registered',
  'company.status_changed': 'Company status changed',
  'kyc.approved': 'KYC approved',
  'kyc.rejected': 'KYC rejected',
  'visit.scheduled': 'Visit scheduled',
  'visit.logged': 'Visit logged',
  'visit.logged_offline': 'Offline visit synced',
  'auth.login': 'Sign in'
};

const ACTION_FILTERS = [
  { value: '', label: 'All actions' },
  { value: 'company.registered', label: 'Registrations' },
  { value: 'company.status_changed', label: 'Status changes' },
  { value: 'user.invited', label: 'Invites' },
  { value: 'user.role_updated', label: 'Role changes' },
  { value: 'user.updated', label: 'User updates' }
];

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
  if (details.email) parts.push(String(details.email));
  if (details.from && details.to) parts.push(`${details.from} → ${details.to}`);
  if (details.role) parts.push(String(details.role));
  if (details.reason) parts.push(String(details.reason));
  return parts.length > 0 ? parts.join(' · ') : JSON.stringify(details);
}

export function AuditPage() {
  const { user } = useAuth();
  const { auditLogs } = useAppData();
  const isOwner = user?.role === 'system_owner';
  const isPlatform = isOwner || user?.role === 'platform_staff';
  const scopeLabel = isPlatform ? 'Platform' : 'Organisation';
  const [actionFilter, setActionFilter] = useState('');

  const filtered = useMemo(() => {
    if (!actionFilter) return auditLogs;
    return auditLogs.filter((e) => e.action === actionFilter);
  }, [auditLogs, actionFilter]);

  const recent = auditLogs.filter((e) => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return new Date(e.createdAt).getTime() > dayAgo;
  }).length;

  return (
    <div className="page-pad">
      <div className="metric-grid-3 mb-6">
        <MetricCard
          label={`${scopeLabel} audit events`}
          value={auditLogs.length}
          icon={<ScrollText className="w-5 h-5" />}
          accent="#1565C0"
        />
        <MetricCard
          label="Last 24 hours"
          value={recent}
          icon={<Clock className="w-5 h-5" />}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-900">
            {scopeLabel} audit log
          </h3>
          {isPlatform && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                aria-label="Filter by action"
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700">
                {ACTION_FILTERS.map((f) => (
                  <option key={f.value || 'all'} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )}
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

          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No audit events yet.
            </p>
          ) : (
            filtered.map((e) => (
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
      </div>
    </div>
  );
}
