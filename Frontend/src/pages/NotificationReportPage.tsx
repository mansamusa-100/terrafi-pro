import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, Copy, Filter, Search } from 'lucide-react';
import { toast } from 'sonner';
import { MetricCard } from '../components/MetricCard';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { PAGE_SIZE, useClientPagination } from '../lib/useClientPagination';
import { cn } from '../lib/utils';
import type { NotificationReportEntry } from '../lib/api';

const TYPE_LABELS: Record<string, string> = {
  'agent.onboarded': 'Agent onboarded',
  'user.invited': 'User invited',
  'user.password_reset': 'Password reset',
  'billing.renewal_soon': 'Subscription ending soon',
  'billing.period_ended': 'Subscription period ended',
  'billing.locked': 'Subscription locked',
  'billing.paid': 'Subscription paid'
};

const TYPE_FILTERS = [
  { value: '', label: 'All events' },
  { value: 'agent.onboarded', label: 'Agent onboarded' },
  { value: 'user.invited', label: 'User invited' },
  { value: 'user.password_reset', label: 'Password reset' },
  { value: 'billing.renewal_soon', label: 'Ending soon' },
  { value: 'billing.period_ended', label: 'Period ended' },
  { value: 'billing.locked', label: 'Locked' },
  { value: 'billing.paid', label: 'Paid' }
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function typeBadgeClass(type: string) {
  if (type.startsWith('billing.')) {
    if (type === 'billing.paid') return 'bg-apsGreenLt text-apsGreen';
    if (type === 'billing.locked') return 'bg-apsRedLt text-apsRed';
    return 'bg-apsAmberLt text-amber-700';
  }
  if (type.startsWith('agent.')) return 'bg-apsTealLt text-apsTeal';
  if (type === 'user.password_reset') return 'bg-apsAmberLt text-amber-700';
  if (type.startsWith('user.')) return 'bg-apsBlueLt text-apsBlue';
  return 'bg-slate-100 text-slate-700';
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success('Copied');
  } catch {
    toast.error('Could not copy');
  }
}

function CredentialsCell({ row }: { row: NotificationReportEntry }) {
  if (row.temporary_password) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <code className="text-[11px] font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 truncate max-w-[9rem]">
          {row.temporary_password}
        </code>
        <button
          type="button"
          title="Copy temporary password"
          onClick={() => copyText(row.temporary_password!)}
          className="p-1 rounded hover:bg-slate-100 text-slate-500 shrink-0">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }
  if (row.credential_delivery === 'reused_existing') {
    return (
      <span className="text-[11px] text-slate-500">Existing password</span>
    );
  }
  return <span className="text-[11px] text-slate-400">—</span>;
}

export function NotificationReportPage() {
  const { user } = useAuth();
  const { notificationReports, loadNotificationReports } = useAppData();
  const isOwner = user?.role === 'system_owner';
  const isPlatform = isOwner || user?.role === 'platform_staff';
  const scopeLabel = isPlatform ? 'Platform' : 'Organisation';
  const today = todayISO();

  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadNotificationReports({
      from: dateFrom || today,
      to: dateTo || dateFrom || today,
      type: typeFilter || undefined,
      limit: 300
    })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, typeFilter, loadNotificationReports, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notificationReports;
    return notificationReports.filter((row) =>
      row.title.toLowerCase().includes(q) ||
      row.detail.toLowerCase().includes(q) ||
      row.actor_name.toLowerCase().includes(q) ||
      row.actor_email.toLowerCase().includes(q) ||
      (row.entity_label?.toLowerCase().includes(q) ?? false)
    );
  }, [notificationReports, search]);

  const {
    pageItems,
    total,
    limit,
    offset,
    setOffset
  } = useClientPagination(
    filtered,
    PAGE_SIZE.compact,
    `${typeFilter}|${search}|${dateFrom}|${dateTo}`
  );

  const withPassword = filtered.filter((r) => r.temporary_password).length;
  const showingToday = dateFrom === today && dateTo === today;

  return (
    <div className="page-pad">
      <div className="metric-grid-3 mb-6">
        <MetricCard
          label={showingToday ? 'Events today' : 'Events in range'}
          value={filtered.length}
          icon={<ClipboardList className="w-5 h-5" />}
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
          label="Passwords in view"
          value={withPassword}
          sub="Copy and share if the user missed email"
          icon={<Copy className="w-5 h-5" />}
          accent="#F59E0B"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Notification report
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Showing {showingToday ? "today's" : 'selected'} invites, password
              resets, onboarding, and billing events. Search within the range or
              pick past dates for history.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 gap-2 flex-1 min-w-[180px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, detail…"
                aria-label="Search notification report"
                className="bg-transparent border-none outline-none text-xs text-slate-800 w-full placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter by event"
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700">
                {TYPE_FILTERS.filter((f) =>
                  isPlatform ? f.value !== 'agent.onboarded' : true
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

        <DataTable minWidth="860px">
          <div className="grid grid-cols-[1.2fr_1.1fr_1.6fr_1.2fr_1.1fr] gap-4 pb-3 mb-2 border-b border-slate-200">
            {['Time', 'Event', 'Detail', 'Created by', 'Password'].map((h) => (
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
                  ? 'No notification events today.'
                  : 'No events in this date range.'}
            </p>
          ) : (
            pageItems.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[1.2fr_1.1fr_1.6fr_1.2fr_1.1fr] gap-4 py-3 border-b border-slate-100 last:border-0 items-start">
                <div className="text-xs text-slate-600">
                  {formatWhen(row.created_at)}
                </div>
                <div>
                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2.5 py-1 rounded-full',
                      typeBadgeClass(row.type)
                    )}>
                    {TYPE_LABELS[row.type] || row.title}
                  </span>
                </div>
                <div className="text-[11px] text-slate-700 break-words">
                  {row.detail}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-900 truncate">
                    {row.actor_name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {row.actor_role_label} · {row.actor_email}
                  </div>
                </div>
                <CredentialsCell row={row} />
              </div>
            ))
          )}
        </DataTable>
        <Pagination
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={setOffset}
          className="mt-4"
        />
      </div>
    </div>
  );
}
