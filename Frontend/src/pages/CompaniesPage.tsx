import React, { useMemo, useState } from 'react';
import { Building2, Users, DollarSign, Search, ShieldAlert } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { useAppData } from '../lib/data-context';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { PAGE_SIZE, useClientPagination } from '../lib/useClientPagination';
import { fmtDalasi } from '../lib/data';
import { cn } from '../lib/utils';

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-apsGreenLt text-apsGreen border-apsGreen/20',
  suspended: 'bg-apsRedLt text-apsRed border-apsRed/20'
};

const SUB_BADGE: Record<string, string> = {
  ACTIVE: 'text-apsGreen',
  TRIALING: 'text-apsBlue',
  PAST_DUE: 'text-apsAmber',
  EXPIRED: 'text-apsRed'
};

const LOCK_STYLE: Record<string, string> = {
  open: 'text-apsGreen',
  grace: 'text-apsAmber',
  locked: 'text-apsRed'
};

type StatusFilter = 'all' | 'attention' | 'active' | 'suspended';

interface CompaniesPageProps {
  onOpenCompany?: (companyId: string) => void;
}

function formatActivity(daysAgo: number | null | undefined, at?: string | null) {
  if (daysAgo == null && !at) return '—';
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return '1d ago';
  if (daysAgo != null && daysAgo < 30) return `${daysAgo}d ago`;
  if (at) {
    return new Date(at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }
  return '—';
}

export function CompaniesPage({ onOpenCompany }: CompaniesPageProps) {
  const { companies, loading, error } = useAppData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const attentionCount = companies.filter((c) => c.needsAttention).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (statusFilter === 'attention' && !c.needsAttention) return false;
      if (statusFilter === 'active' && c.status !== 'active') return false;
      if (statusFilter === 'suspended' && c.status !== 'suspended') return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.contactEmail?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [companies, search, statusFilter]);

  const {
    pageItems: pageCompanies,
    total: companiesTotal,
    limit: companiesLimit,
    offset: companiesOffset,
    setOffset: setCompaniesOffset
  } = useClientPagination(
    filtered,
    PAGE_SIZE.default,
    `${statusFilter}|${search}`
  );

  const totalAgents = companies.reduce((s, c) => s + c.agents, 0);
  const activeCos = companies.filter((c) => c.status === 'active').length;
  const suspendedCos = companies.filter((c) => c.status === 'suspended').length;
  const mrr = companies.reduce((s, c) => {
    if (c.subscriptionStatus !== 'ACTIVE') return s;
    return s + c.mrr;
  }, 0);

  if (loading && companies.length === 0) {
    return (
      <div className="page-pad flex items-center justify-center min-h-[40vh] text-sm text-slate-500">
        Loading companies…
      </div>
    );
  }

  if (error && companies.length === 0) {
    return (
      <div className="page-pad">
        <div className="rounded-xl border border-apsRed/20 bg-apsRedLt/40 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-apsRed">Could not load companies</p>
          <p className="text-xs text-slate-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-pad">
      <div className="metric-grid mb-6">
        <MetricCard
          label="Subscriber companies"
          value={companies.length}
          sub={`${activeCos} active${suspendedCos ? ` · ${suspendedCos} suspended` : ''}`}
          icon={<Building2 className="w-5 h-5" />}
          accent="#1565C0"
        />
        <MetricCard
          label="Needs attention"
          value={attentionCount}
          sub={attentionCount ? 'Filter the list below' : 'All clear'}
          subColor={attentionCount ? 'text-apsAmber' : 'text-apsGreen'}
          icon={<ShieldAlert className="w-5 h-5" />}
          accent={attentionCount ? '#F59E0B' : '#22C55E'}
          onClick={() => setStatusFilter('attention')}
        />
        <MetricCard
          label="Total agents (platform)"
          value={totalAgents.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
          accent="#00897B"
        />
        <MetricCard
          label="Collected MRR"
          value={fmtDalasi(mrr)}
          sub={`${companies.reduce((s, c) => s + (c.userCount ?? 0), 0)} company users`}
          subColor="text-apsGreen"
          icon={<DollarSign className="w-5 h-5" />}
          accent="#22C55E"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Subscriber companies
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Health signals stay quiet unless a tenant needs action
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 gap-2 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies…"
                className="bg-transparent border-none outline-none text-xs text-slate-800 w-full placeholder:text-slate-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filter companies"
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700">
              <option value="all">All companies</option>
              <option value="attention">
                Needs attention{attentionCount ? ` (${attentionCount})` : ''}
              </option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <DataTable minWidth="960px">
          <div className="grid grid-cols-[1.8fr_0.9fr_0.7fr_0.9fr_0.9fr_0.8fr_0.8fr_0.7fr] gap-3 pb-3 mb-2 border-b border-slate-200">
            {[
              'Company',
              'Plan',
              'Agents',
              'Seats',
              'Access',
              'Activity',
              'Billing',
              'Status'
            ].map((h) => (
              <div
                key={h}
                className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {h}
              </div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              {companies.length === 0
                ? 'No subscriber companies yet. Companies appear here after self-registration.'
                : 'No companies match your search.'}
            </div>
          ) : (
            pageCompanies.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenCompany?.(c.id)}
                className="w-full grid grid-cols-[1.8fr_0.9fr_0.7fr_0.9fr_0.9fr_0.8fr_0.8fr_0.7fr] gap-3 py-3 border-b border-slate-100 last:border-0 items-center hover:bg-slate-50 -mx-2 px-2 rounded transition-colors text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {c.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {c.name}
                      </div>
                      {c.needsAttention && (
                        <span
                          title={c.attentionReasons?.map((r) => r.label).join(' · ')}
                          className="shrink-0 w-1.5 h-1.5 rounded-full bg-apsAmber"
                        />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {c.attentionReasons?.length
                        ? c.attentionReasons.map((r) => r.label).join(' · ')
                        : c.contactEmail || `since ${c.since}`}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-700 font-medium truncate">
                  {c.plan}
                </div>
                <div className="text-xs text-slate-700">
                  {c.agents.toLocaleString()}
                </div>
                <div className="text-xs text-slate-700 tabular-nums">
                  {c.seats || `${c.userCount ?? 0}`}
                </div>
                <div
                  className={cn(
                    'text-xs font-medium capitalize',
                    LOCK_STYLE[c.lockState || 'open'] || 'text-slate-600'
                  )}>
                  {c.lockState || 'open'}
                </div>
                <div className="text-xs text-slate-600">
                  {formatActivity(c.lastActivityDaysAgo, c.lastActivityAt)}
                </div>
                <div
                  className={cn(
                    'text-xs font-medium',
                    SUB_BADGE[c.subscriptionStatus || ''] || 'text-slate-500'
                  )}>
                  {c.subscriptionStatus?.replace(/_/g, ' ') || '—'}
                </div>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2.5 py-1 rounded-full border w-fit capitalize',
                    STATUS_STYLE[c.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                  )}>
                  {c.status}
                </span>
              </button>
            ))
          )}
        </DataTable>
        <Pagination
          total={companiesTotal}
          limit={companiesLimit}
          offset={companiesOffset}
          onPageChange={setCompaniesOffset}
        />
      </div>
    </div>
  );
}
