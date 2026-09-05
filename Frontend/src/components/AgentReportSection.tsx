import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  CalendarDays,
  ClipboardList,
  MapPin,
  Search,
  ShieldAlert,
  Target,
  UserCheck,
  UserX,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { MetricCard } from './MetricCard';
import { DataTable } from './DataTable';
import { Pagination } from './Pagination';
import { ExportButton } from './ExportButton';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import { api, type Agent, type AgentReportRow } from '../lib/api';
import {
  DATE_RANGE_PRESETS,
  formatReportDate,
  formatReportDateTime,
  presetLabel,
  type DateRangePreset
} from '../lib/date-range-presets';
import { STATUS_META } from '../lib/data';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { cn } from '../lib/utils';
import { PAGE_SIZE } from '../lib/useClientPagination';
import { subTerritoriesForZone } from '../lib/sub-territories';

const selectClass =
  'px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-apsBlue transition-colors';

const KYC_LABELS: Record<string, string> = {
  verified: 'Verified',
  pending: 'Pending',
  incomplete: 'Incomplete',
  expired: 'Expired'
};

const KYC_BADGE: Record<string, string> = {
  verified: 'bg-apsGreenLt text-apsGreen',
  pending: 'bg-apsAmberLt text-amber-700',
  incomplete: 'bg-slate-100 text-slate-600',
  expired: 'bg-apsRedLt text-apsRed'
};

type TableScope = 'onboarded' | 'all';

type SortKey =
  | 'created_at'
  | 'name'
  | 'region'
  | 'sub_region'
  | 'status'
  | 'kyc'
  | 'adr_name'
  | 'last_visit_date';

const SORTABLE: { key: SortKey; label: string }[] = [
  { key: 'created_at', label: 'Onboarded' },
  { key: 'name', label: 'Name' },
  { key: 'region', label: 'Region' },
  { key: 'sub_region', label: 'Sub Region' },
  { key: 'status', label: 'Status' },
  { key: 'kyc', label: 'KYC' },
  { key: 'adr_name', label: 'ADR' },
  { key: 'last_visit_date', label: 'Last visit' }
];

const GRID_COLS =
  'grid grid-cols-[repeat(19,minmax(0,1fr))] gap-2';

interface AgentReportSectionProps {
  onAgentClick?: (agent: Agent) => void;
}

export function AgentReportSection({ onAgentClick }: AgentReportSectionProps) {
  const { user } = useAuth();
  const { users, zones, agents } = useAppData();

  const [preset, setPreset] = useState<DateRangePreset>('this_month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tableScope, setTableScope] = useState<TableScope>('onboarded');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [zoneFilter, setZoneFilter] = useState('');
  const [subTerritoryFilter, setSubTerritoryFilter] = useState('');
  const [subTerritoryMap, setSubTerritoryMap] = useState<Record<string, string[]>>(
    {}
  );
  const [adrFilter, setAdrFilter] = useState('');
  const [teamLeadFilter, setTeamLeadFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Awaited<
    ReturnType<typeof api.performance.agentReport>
  > | null>(null);

  const isManagerLike =
    user?.role === 'manager' || user?.role === 'internal';
  const isTeamLead = user?.role === 'team_lead';

  const adrOptions = useMemo(() => {
    const adrs = users.filter((u) => u.role === 'adr' && u.id);
    if (isTeamLead && user?.supervised_adr_ids?.length) {
      return adrs.filter((a) => user.supervised_adr_ids!.includes(a.id!));
    }
    return adrs;
  }, [users, isTeamLead, user?.supervised_adr_ids]);

  const teamLeadOptions = useMemo(
    () => users.filter((u) => u.role === 'team_lead' && u.id),
    [users]
  );

  const queryParams = useMemo(
    () => ({
      preset,
      from: preset === 'custom' ? dateFrom : undefined,
      to: preset === 'custom' ? dateTo : undefined,
      table_scope: tableScope,
      q: debouncedSearch.trim() || undefined,
      zone: zoneFilter || undefined,
      sub_territory: subTerritoryFilter || undefined,
      officer_id: adrFilter || undefined,
      team_lead_id: teamLeadFilter || undefined,
      status: statusFilter || undefined,
      kyc: kycFilter || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
      limit: PAGE_SIZE.compact,
      offset
    }),
    [
      preset,
      dateFrom,
      dateTo,
      tableScope,
      debouncedSearch,
      zoneFilter,
      subTerritoryFilter,
      adrFilter,
      teamLeadFilter,
      statusFilter,
      kycFilter,
      sortBy,
      sortDir,
      offset
    ]
  );

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.performance.agentReport(queryParams);
      setReport(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load agent report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    api
      .onboardingConfig()
      .then((c) => setSubTerritoryMap(c.sub_territories_by_zone || {}))
      .catch(() => setSubTerritoryMap({}));
  }, []);

  const subTerritoryOptions = useMemo(() => {
    if (zoneFilter) return subTerritoriesForZone(subTerritoryMap, zoneFilter);
    return [...new Set(Object.values(subTerritoryMap).flat())].sort();
  }, [subTerritoryMap, zoneFilter]);

  useEffect(() => {
    setOffset(0);
  }, [
    preset,
    dateFrom,
    dateTo,
    tableScope,
    debouncedSearch,
    zoneFilter,
    subTerritoryFilter,
    adrFilter,
    teamLeadFilter,
    statusFilter,
    kycFilter,
    sortBy,
    sortDir
  ]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(key === 'name' || key === 'region' || key === 'sub_region' ? 'asc' : 'desc');
    }
  };

  const handleRowClick = async (row: AgentReportRow) => {
    if (!onAgentClick) return;
    const existing = agents.find((a) => a.id === row.id);
    if (existing) {
      onAgentClick(existing);
      return;
    }
    try {
      const detail = await api.agents.get(row.id);
      onAgentClick(detail);
    } catch {
      toast.error('Could not open agent details');
    }
  };

  const summary = report?.summary;
  const period = report?.period;

  const exportPath = api.export.agentReport({
    preset,
    from: preset === 'custom' ? dateFrom : undefined,
    to: preset === 'custom' ? dateTo : undefined,
    table_scope: tableScope,
    q: debouncedSearch.trim() || undefined,
    zone: zoneFilter || undefined,
    sub_territory: subTerritoryFilter || undefined,
    officer_id: adrFilter || undefined,
    team_lead_id: teamLeadFilter || undefined,
    status: statusFilter || undefined,
    kyc: kycFilter || undefined,
    sort_by: sortBy,
    sort_dir: sortDir
  });

  const scopeHint =
    tableScope === 'all'
      ? 'Showing all agents in scope · visit KPIs use the selected period'
      : preset === 'all'
        ? 'All onboarded dates · visit KPIs use this month'
        : 'Table filtered by onboarded date in the selected period';

  return (
    <div className="space-y-6">
      <div className="metric-grid-3">
        <MetricCard
          label="Total network agents"
          value={String(summary?.total_agents ?? '—')}
          icon={<Users className="w-5 h-5" />}
          accent="#1565C0"
        />
        <MetricCard
          label="Onboarded today"
          value={String(summary?.onboarded_today ?? '—')}
          sub="Agents created today"
          icon={<UserCheck className="w-5 h-5" />}
          accent="#00897B"
        />
        <MetricCard
          label="Agents visited"
          value={String(summary?.agents_visited ?? '—')}
          sub={
            period
              ? `${summary?.visits_done ?? 0} visits in period`
              : undefined
          }
          icon={<MapPin className="w-5 h-5" />}
          accent="#F59E0B"
        />
        <MetricCard
          label="Visit coverage"
          value={summary != null ? `${summary.visit_coverage_pct}%` : '—'}
          sub={
            summary
              ? `${summary.visits_done} / ${summary.visit_target_total} target visits`
              : undefined
          }
          icon={<Target className="w-5 h-5" />}
          accent="#22C55E"
        />
        <MetricCard
          label="Never visited"
          value={String(summary?.never_visited ?? '—')}
          sub="No completed visit in period"
          icon={<UserX className="w-5 h-5" />}
          accent="#EF4444"
        />
        <MetricCard
          label="KYC pending"
          value={String(summary?.kyc_pending ?? '—')}
          sub="Awaiting compliance review"
          icon={<ShieldAlert className="w-5 h-5" />}
          accent="#F59E0B"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-apsBlue" />
                Agent report
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {period
                  ? period.preset === 'all'
                    ? `All agents · Visit KPIs for this month (${formatReportDate(period.visit_from ?? period.from)} → ${formatReportDate(period.visit_to ?? period.to)})`
                    : `${presetLabel(period.preset)} · ${formatReportDate(period.from)} → ${formatReportDate(period.to)} · Visit target ${summary?.visit_frequency_target ?? 25}/agent/mo (prorated)`
                  : 'Creation and visit activity by agent'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{scopeHint}</p>
            </div>
            <ExportButton
              path={exportPath}
              filename={`agent-report-${period?.from ?? 'export'}.csv`}
              label="Export report"
            />
          </div>

          <div className="flex flex-col lg:flex-row flex-wrap gap-2">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 gap-2 flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ID, name, phone, zone…"
                aria-label="Search agent report"
                className="bg-transparent text-sm outline-none w-full placeholder:text-slate-400"
              />
            </div>

            <select
              aria-label="Table scope"
              className={selectClass}
              value={tableScope}
              onChange={(e) => setTableScope(e.target.value as TableScope)}>
              <option value="onboarded">Onboarded in period</option>
              <option value="all">All agents (visit stats for period)</option>
            </select>

            <select
              aria-label="Date range"
              className={selectClass}
              value={preset}
              onChange={(e) => setPreset(e.target.value as DateRangePreset)}>
              {DATE_RANGE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            {preset === 'custom' && (
              <>
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="date"
                    aria-label="From date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={selectClass}
                  />
                </div>
                <input
                  type="date"
                  aria-label="To date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={selectClass}
                />
              </>
            )}

            <select
              aria-label="Filter by region"
              className={selectClass}
              value={zoneFilter}
              onChange={(e) => {
                setZoneFilter(e.target.value);
                setSubTerritoryFilter('');
              }}>
              <option value="">All regions</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>

            {subTerritoryOptions.length > 0 && (
              <select
                aria-label="Filter by sub region"
                className={selectClass}
                value={subTerritoryFilter}
                onChange={(e) => setSubTerritoryFilter(e.target.value)}>
                <option value="">All sub regions</option>
                {subTerritoryOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            <select
              aria-label="Filter by ADR"
              className={selectClass}
              value={adrFilter}
              onChange={(e) => setAdrFilter(e.target.value)}>
              <option value="">All ADRs</option>
              {adrOptions.map((a) => (
                <option key={a.id} value={a.id!}>
                  {a.name}
                </option>
              ))}
            </select>

            {isManagerLike && (
              <select
                aria-label="Filter by team lead"
                className={selectClass}
                value={teamLeadFilter}
                onChange={(e) => setTeamLeadFilter(e.target.value)}>
                <option value="">All team leads</option>
                {teamLeadOptions.map((tl) => (
                  <option key={tl.id} value={tl.id!}>
                    {tl.name}
                  </option>
                ))}
              </select>
            )}

            <select
              aria-label="Filter by status"
              className={selectClass}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by KYC"
              className={selectClass}
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}>
              <option value="">All KYC</option>
              {Object.entries(KYC_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 py-8 text-center">Loading report…</p>
        ) : !report?.rows.length ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            No agents match these filters.
          </p>
        ) : (
          <>
            <DataTable minWidth="1800px">
              <div
                className={cn(
                  GRID_COLS,
                  'pb-2 mb-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center'
                )}>
                <span>ID</span>
                {SORTABLE.map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="flex items-center gap-0.5 text-left hover:text-slate-900 transition-colors">
                    {col.label}
                    <ArrowUpDown
                      className={cn(
                        'w-3 h-3 shrink-0',
                        sortBy === col.key ? 'opacity-100' : 'opacity-40'
                      )}
                    />
                  </button>
                ))}
                <span>Business</span>
                <span>Type</span>
                <span>Gender</span>
                <span>Biz phone</span>
                <span>Agent #</span>
                <span>Address</span>
                <span>Team lead</span>
                <span>Onboarded by</span>
                <span>KYC approved by</span>
                <span>Visited by</span>
              </div>
              {report.rows.map((row) => {
                const statusMeta = STATUS_META[row.status];
                return (
                  <div
                    key={row.id}
                    role={onAgentClick ? 'button' : undefined}
                    tabIndex={onAgentClick ? 0 : undefined}
                    onClick={() => handleRowClick(row)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(row);
                      }
                    }}
                    className={cn(
                      GRID_COLS,
                      'py-2.5 border-b border-slate-100 last:border-0 text-xs items-start',
                      onAgentClick && 'cursor-pointer hover:bg-slate-50'
                    )}>
                    <span className="font-mono text-[10px] text-slate-700 truncate">
                      {row.id}
                    </span>
                    <span className="text-slate-600 truncate">
                      {formatReportDateTime(row.created_at)}
                    </span>
                    <span className="font-medium text-slate-900 truncate">{row.name}</span>
                    <span className="text-slate-600 truncate">{row.region}</span>
                    <span className="text-slate-600 truncate">
                      {row.sub_region ?? '—'}
                    </span>
                    <span>
                      {statusMeta ? (
                        <span
                          className={cn(
                            'inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold',
                            statusMeta.bg,
                            statusMeta.color
                          )}>
                          {statusMeta.label}
                        </span>
                      ) : (
                        row.status
                      )}
                    </span>
                    <span>
                      <span
                        className={cn(
                          'inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold',
                          KYC_BADGE[row.kyc] ?? 'bg-slate-100 text-slate-600'
                        )}>
                        {KYC_LABELS[row.kyc] ?? row.kyc}
                      </span>
                    </span>
                    <span className="text-slate-600 truncate">{row.adr_name}</span>
                    <span className="text-slate-600 truncate">
                      {row.last_visit_date
                        ? formatReportDate(row.last_visit_date)
                        : '—'}
                    </span>
                    <span className="text-slate-700 truncate">
                      {row.outlet_name ?? '—'}
                    </span>
                    <span className="text-slate-600 truncate">
                      {row.business_type ?? '—'}
                    </span>
                    <span className="text-slate-600 truncate">{row.gender ?? '—'}</span>
                    <span className="text-slate-600 truncate">{row.business_phone}</span>
                    <span className="text-slate-600 truncate">
                      {row.agent_number ?? '—'}
                    </span>
                    <span className="text-slate-600 truncate">{row.address}</span>
                    <span className="text-slate-600 truncate">
                      {row.team_lead_name ?? '—'}
                    </span>
                    <span className="text-slate-600 truncate">
                      {row.onboarded_by_name ?? '—'}
                    </span>
                    <span className="text-slate-600 truncate">
                      {row.kyc_approved_by_name ?? '—'}
                    </span>
                    <span className="text-slate-600 truncate">
                      {row.last_visited_by ?? '—'}
                    </span>
                  </div>
                );
              })}
            </DataTable>
            <Pagination
              total={report.total}
              limit={report.limit}
              offset={report.offset}
              onPageChange={setOffset}
            />
          </>
        )}
      </div>
    </div>
  );
}
