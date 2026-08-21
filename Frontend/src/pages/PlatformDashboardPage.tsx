import React, { useState } from 'react';
import {
  Building2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { MetricCard } from '../components/MetricCard';
import { useAppData } from '../lib/data-context';
import { api, ApiError } from '../lib/api';
import { fmtDalasi } from '../lib/data';
import { cn } from '../lib/utils';

interface PlatformDashboardPageProps {
  onOpenCompany?: (companyId: string) => void;
  setActive?: (page: string) => void;
}

const SUB_STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-apsGreenLt text-apsGreen',
  TRIALING: 'bg-apsBlueLt text-apsBlue',
  PAST_DUE: 'bg-apsAmberLt text-amber-700',
  EXPIRED: 'bg-apsRedLt text-apsRed',
  CANCELLED: 'bg-slate-100 text-slate-600',
  NONE: 'bg-slate-100 text-slate-500'
};

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-apsRedLt text-apsRed border-apsRed/20',
  high: 'bg-apsAmberLt text-amber-800 border-apsAmber/30',
  medium: 'bg-slate-100 text-slate-700 border-slate-200'
};

export function PlatformDashboardPage({
  onOpenCompany,
  setActive
}: PlatformDashboardPageProps) {
  const { platformStats, loading, refresh } = useAppData();
  const stats = platformStats;
  const [syncing, setSyncing] = useState(false);

  const syncBilling = async () => {
    setSyncing(true);
    try {
      const res = await api.billing.syncAll();
      await refresh();
      toast.success('Subscriptions synced', {
        description: `${res.synced}/${res.total} companies · collected ${fmtDalasi(res.mrr)}`
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Billing sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="page-pad flex items-center justify-center min-h-[40vh] text-sm text-slate-500">
        Loading platform overview…
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="page-pad text-sm text-slate-500">
        Platform metrics unavailable.
      </div>
    );
  }

  const subEntries = Object.entries(stats.subscriptions).sort((a, b) => b[1] - a[1]);
  const attention = stats.attention;
  const attentionCount = attention?.count ?? stats.companies.needsAttention ?? 0;

  return (
    <div className="page-pad">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Platform overview</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Subscriber health, signups, and billing status across Terrafi Pro
          </p>
        </div>
        <button
          type="button"
          disabled={syncing}
          onClick={syncBilling}
          className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {syncing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Sync subscriptions
        </button>
      </div>

      <div className="metric-grid mb-6">
        <MetricCard
          label="Subscriber companies"
          value={stats.companies.total}
          sub={`${stats.companies.active} active · ${stats.companies.suspended} suspended`}
          icon={<Building2 className="w-5 h-5" />}
          accent="#1565C0"
          onClick={() => setActive?.('companies')}
        />
        <MetricCard
          label="Needs attention"
          value={attentionCount}
          sub={
            attentionCount === 0
              ? 'All tenants look healthy'
              : `${attention?.bySeverity.critical || 0} critical · ${attention?.bySeverity.high || 0} high`
          }
          subColor={attentionCount > 0 ? 'text-apsAmber' : 'text-apsGreen'}
          icon={<ShieldAlert className="w-5 h-5" />}
          accent={attentionCount > 0 ? '#F59E0B' : '#22C55E'}
          onClick={() => setActive?.('companies')}
        />
        <MetricCard
          label="New signups (30d)"
          value={stats.companies.signups30d}
          sub={`${stats.companies.signups7d} in last 7 days`}
          subColor="text-apsGreen"
          icon={<TrendingUp className="w-5 h-5" />}
          accent="#00897B"
        />
        <MetricCard
          label="Collected MRR"
          value={fmtDalasi(stats.revenue.mrr)}
          sub={`${stats.agents.total.toLocaleString()} agents · ${stats.users.company} users`}
          icon={<DollarSign className="w-5 h-5" />}
          accent="#22C55E"
        />
      </div>

      {attention && attention.items.length > 0 && (
        <div className="mb-5 bg-white border border-apsAmber/25 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Needs attention ({attention.count})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Only exceptions — past due, locked, suspended, or inactive signups
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActive?.('companies')}
              className="text-xs font-medium text-apsBlue hover:underline shrink-0">
              Open companies
            </button>
          </div>
          <div className="space-y-2">
            {attention.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenCompany?.(item.id)}
                className="w-full flex items-center gap-3 text-left p-2.5 rounded-lg border border-slate-100 hover:border-apsBlue/30 hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {item.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {item.name}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.reasons.map((r) => (
                      <span
                        key={r.code}
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                          SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.medium
                        )}>
                        {r.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <div className="text-[10px] text-slate-400">
                    {item.agents} agents
                  </div>
                  {item.subscriptionStatus && (
                    <div
                      className={cn(
                        'text-[10px] font-semibold mt-0.5',
                        SUB_STATUS_STYLE[item.subscriptionStatus]
                          ? ''
                          : 'text-slate-500'
                      )}>
                      {item.subscriptionStatus.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {attentionCount === 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-apsGreen/20 bg-apsGreenLt/30 px-4 py-3">
          <ShieldAlert className="w-5 h-5 text-apsGreen shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              No tenants need attention
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Billing and signup health look clear across the platform.
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Subscription status
          </h3>
          {subEntries.length === 0 ? (
            <p className="text-sm text-slate-500">No subscription data yet.</p>
          ) : (
            <div className="space-y-2">
              {subEntries.map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2.5 py-1 rounded-full',
                      SUB_STATUS_STYLE[status] || SUB_STATUS_STYLE.NONE
                    )}>
                    {status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-medium text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Recent signups</h3>
            <button
              type="button"
              onClick={() => setActive?.('companies')}
              className="text-xs font-medium text-apsBlue hover:underline">
              View all
            </button>
          </div>
          {stats.recentSignups.length === 0 ? (
            <p className="text-sm text-slate-500">No companies registered yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentSignups.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpenCompany?.(c.id)}
                  className="w-full flex items-center gap-3 text-left p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {c.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {c.name}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {c.contactEmail || c.id}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize',
                        c.status === 'active'
                          ? 'bg-apsGreenLt text-apsGreen'
                          : 'bg-apsRedLt text-apsRed'
                      )}>
                      {c.status}
                    </span>
                    {c.registeredAt && (
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(c.registeredAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Quick actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActive?.('companies')}
            className="px-4 py-2 rounded-lg bg-apsBlue text-white text-xs font-semibold hover:bg-apsBlueMid">
            Manage companies
          </button>
          <button
            type="button"
            onClick={() => setActive?.('users')}
            className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Platform users
          </button>
          <button
            type="button"
            onClick={() => setActive?.('audit')}
            className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Audit log
          </button>
        </div>
      </div>
    </div>
  );
}
