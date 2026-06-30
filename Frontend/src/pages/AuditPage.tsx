import React from 'react';
import { ScrollText, Clock } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import { DataTable } from '../components/DataTable';
import { cn } from '../lib/utils';

const ACTION_LABELS: Record<string, string> = {
  'user.invited': 'User invited',
  'user.role_updated': 'Role updated',
  'company.registered': 'Company registered',
  'auth.login': 'Sign in'
};

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

export function AuditPage() {
  const { user } = useAuth();
  const { auditLogs } = useAppData();
  const isPlatform = user?.role === 'system_owner' || user?.role === 'platform_staff';
  const scopeLabel = isPlatform ? 'Platform' : 'Organisation';

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
          sub={isPlatform ? 'Platform operations only' : 'Your company only'}
          icon={<ScrollText className="w-5 h-5" />}
          accent="#6D28D9"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          {scopeLabel} audit log
        </h3>

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

        {auditLogs.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            No audit events yet.
          </p>
        ) : (
          auditLogs.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[1.2fr_1.5fr_1fr_1.5fr] gap-4 py-3 border-b border-slate-100 last:border-0 items-start">
              <div className="text-xs text-slate-600">{formatWhen(e.createdAt)}</div>
              <div>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2.5 py-1 rounded-full',
                    e.action.startsWith('user.')
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
              <div className="text-[11px] text-slate-600 font-mono break-all">
                {e.details ? JSON.stringify(e.details) : '—'}
              </div>
            </div>
          ))
        )}
        </DataTable>
      </div>
    </div>
  );
}
