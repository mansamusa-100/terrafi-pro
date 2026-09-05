import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Search,
  ShieldAlert,
  UserPlus,
  Users,
  UserX
} from 'lucide-react';
import { toast } from 'sonner';
import { MetricCard } from './MetricCard';
import { ExportButton } from './ExportButton';
import { DataTable } from './DataTable';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import {
  api,
  type Agent,
  type AgentListByAdrSection as AdrSection,
  type AgentReportRow
} from '../lib/api';
import {
  DATE_RANGE_PRESETS,
  formatReportDate,
  formatReportDateTime,
  presetLabel,
  type DateRangePreset
} from '../lib/date-range-presets';
import { STATUS_META, avatarColor, initials } from '../lib/data';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { cn } from '../lib/utils';
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

const ADR_GRID =
  'grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_repeat(4,minmax(0,0.7fr))_1.5rem] gap-3';

const AGENT_GRID =
  'grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,1.1fr)] gap-3';

interface AgentListByAdrSectionProps {
  onAgentClick?: (agent: Agent) => void;
}

export function AgentListByAdrSection({ onAgentClick }: AgentListByAdrSectionProps) {
  const { user } = useAuth();
  const { users, zones, agents } = useAppData();

  const [preset, setPreset] = useState<DateRangePreset>('this_month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [zoneFilter, setZoneFilter] = useState('');
  const [subTerritoryFilter, setSubTerritoryFilter] = useState('');
  const [subTerritoryMap, setSubTerritoryMap] = useState<Record<string, string[]>>(
    {}
  );
  const [teamLeadFilter, setTeamLeadFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Awaited<
    ReturnType<typeof api.performance.agentListByAdr>
  > | null>(null);
  const [selectedAdrId, setSelectedAdrId] = useState<string | null>(null);

  const isManagerLike = user?.role === 'manager' || user?.role === 'internal';

  const teamLeadOptions = useMemo(
    () => users.filter((u) => u.role === 'team_lead' && u.id),
    [users]
  );

  const queryParams = useMemo(
    () => ({
      preset,
      from: preset === 'custom' ? dateFrom : undefined,
      to: preset === 'custom' ? dateTo : undefined,
      table_scope: 'all',
      q: debouncedSearch.trim() || undefined,
      zone: zoneFilter || undefined,
      sub_territory: subTerritoryFilter || undefined,
      team_lead_id: teamLeadFilter || undefined
    }),
    [
      preset,
      dateFrom,
      dateTo,
      debouncedSearch,
      zoneFilter,
      subTerritoryFilter,
      teamLeadFilter
    ]
  );

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.performance.agentListByAdr(queryParams);
      setReport(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not load Agent List by ADR'
      );
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

  const selectedSection = useMemo(
    () =>
      report?.sections.find(
        (s) => (s.adr_id ?? 'unassigned') === selectedAdrId
      ) ?? null,
    [report, selectedAdrId]
  );

  const handleAgentClick = async (row: AgentReportRow) => {
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
  const exportPath = api.export.agentListByAdr({
    preset,
    from: preset === 'custom' ? dateFrom : undefined,
    to: preset === 'custom' ? dateTo : undefined,
    table_scope: 'all',
    q: debouncedSearch.trim() || undefined,
    zone: zoneFilter || undefined,
    sub_territory: subTerritoryFilter || undefined,
    team_lead_id: teamLeadFilter || undefined,
    officer_id:
      selectedSection?.adr_id && selectedSection.adr_id !== 'unassigned'
        ? selectedSection.adr_id
        : undefined
  });

  if (selectedSection) {
    return (
      <AdrDetailPage
        section={selectedSection}
        period={period}
        exportPath={exportPath}
        onBack={() => setSelectedAdrId(null)}
        onAgentClick={onAgentClick ? handleAgentClick : undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="metric-grid-3">
        <MetricCard
          label="ADRs in scope"
          value={String(summary?.total_adrs ?? '—')}
          icon={<Users className="w-5 h-5" />}
          accent="#1565C0"
        />
        <MetricCard
          label="Agents assigned"
          value={String(summary?.total_agents ?? '—')}
          sub="Under the selected ADRs"
          icon={<ClipboardList className="w-5 h-5" />}
          accent="#00897B"
        />
        <MetricCard
          label="Onboarded in period"
          value={String(summary?.onboarded_in_period ?? '—')}
          sub={period ? presetLabel(period.preset) : undefined}
          icon={<UserPlus className="w-5 h-5" />}
          accent="#22C55E"
        />
        <MetricCard
          label="ADRs with no agents"
          value={String(summary?.adrs_with_zero_agents ?? '—')}
          icon={<UserX className="w-5 h-5" />}
          accent="#EF4444"
        />
        <MetricCard
          label="KYC pending"
          value={String(summary?.kyc_pending ?? '—')}
          icon={<ShieldAlert className="w-5 h-5" />}
          accent="#F59E0B"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-apsBlue" />
                Agent List by ADR
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {period
                  ? `${presetLabel(period.preset)} · ${formatReportDate(period.from)} → ${formatReportDate(period.to)}`
                  : 'Agents grouped by assigned ADR'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Click an ADR to open their full agent list
              </p>
            </div>
            <ExportButton
              path={exportPath}
              filename={`agent-list-by-adr-${period?.from ?? 'export'}.csv`}
              label="Export report"
            />
          </div>

          <div className="flex flex-col lg:flex-row flex-wrap gap-2">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 gap-2 flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ADR or agent…"
                aria-label="Search Agent List by ADR"
                className="bg-transparent text-sm outline-none w-full placeholder:text-slate-400"
              />
            </div>

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
                <input
                  type="date"
                  aria-label="From date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={selectClass}
                />
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
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 py-8 text-center">Loading report…</p>
        ) : !report?.sections.length ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            No ADRs match these filters.
          </p>
        ) : (
          <DataTable minWidth="980px">
            <div
              className={cn(
                ADR_GRID,
                'pb-2 mb-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center'
              )}>
              <span>ADR</span>
              <span>Zone</span>
              <span>Sub Region</span>
              <span>Team lead</span>
              <span>Assigned</span>
              <span>Onboarded</span>
              <span>KYC verified</span>
              <span>KYC pending</span>
              <span />
            </div>
            {report.sections.map((section) => {
              const ac = avatarColor(section.adr_name);
              const rowId = section.adr_id ?? 'unassigned';
              return (
                <div
                  key={rowId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedAdrId(rowId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedAdrId(rowId);
                    }
                  }}
                  className={cn(
                    ADR_GRID,
                    'py-2.5 border-b border-slate-100 last:border-0 text-xs items-center cursor-pointer hover:bg-slate-50'
                  )}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                        ac.bg,
                        ac.text
                      )}>
                      {initials(section.adr_name)}
                    </div>
                    <span className="font-medium text-slate-900 truncate">
                      {section.adr_name}
                    </span>
                  </div>
                  <span className="text-slate-600 truncate">{section.zone}</span>
                  <span className="text-slate-600 truncate">
                    {section.sub_regions?.length
                      ? section.sub_regions.join(', ')
                      : '—'}
                  </span>
                  <span className="text-slate-600 truncate">
                    {section.team_lead_name ?? '—'}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {section.agent_count}
                  </span>
                  <span className="text-slate-700">{section.onboarded_in_period}</span>
                  <span className="text-slate-700">{section.kyc_verified}</span>
                  <span className="text-slate-700">{section.kyc_pending}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              );
            })}
          </DataTable>
        )}
      </div>
    </div>
  );
}

function AdrDetailPage({
  section,
  period,
  exportPath,
  onBack,
  onAgentClick
}: {
  section: AdrSection;
  period?: { preset: string; from: string; to: string } | null;
  exportPath: string;
  onBack: () => void;
  onAgentClick?: (row: AgentReportRow) => void;
}) {
  const ac = avatarColor(section.adr_name);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-apsBlue hover:underline">
        <ArrowLeft className="w-4 h-4" />
        Back to ADR list
      </button>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                ac.bg,
                ac.text
              )}>
              {initials(section.adr_name)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 truncate">
                {section.adr_name}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {section.zone}
                {section.team_lead_name ? ` · Team lead ${section.team_lead_name}` : ''}
              </p>
              {period && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Onboarded count for {presetLabel(period.preset)} ·{' '}
                  {formatReportDate(period.from)} → {formatReportDate(period.to)}
                </p>
              )}
            </div>
          </div>
          <ExportButton
            path={exportPath}
            filename={`agent-list-${section.adr_name.replace(/\s+/g, '-').toLowerCase()}.csv`}
            label="Export ADR"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <DetailStat label="Assigned agents" value={section.agent_count} />
          <DetailStat label="Onboarded in period" value={section.onboarded_in_period} />
          <DetailStat label="KYC verified" value={section.kyc_verified} />
          <DetailStat label="KYC pending" value={section.kyc_pending} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Agents</h3>
        <p className="text-[11px] text-slate-500 mb-4">
          All agents assigned to this ADR. Visits are all-time completed visits.
        </p>
        {!section.rows.length ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            No agents assigned to this ADR.
          </p>
        ) : (
          <DataTable minWidth="960px">
            <div
              className={cn(
                AGENT_GRID,
                'pb-2 mb-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center'
              )}>
              <span>ID</span>
              <span>Name</span>
              <span>Region</span>
              <span>Sub Region</span>
              <span>Status</span>
              <span>KYC</span>
              <span>Onboarded</span>
              <span>Visits</span>
              <span>Last Visited by</span>
            </div>
            {section.rows.map((row) => {
              const statusMeta = STATUS_META[row.status];
              return (
                <div
                  key={row.id}
                  role={onAgentClick ? 'button' : undefined}
                  tabIndex={onAgentClick ? 0 : undefined}
                  onClick={() => onAgentClick?.(row)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onAgentClick?.(row);
                    }
                  }}
                  className={cn(
                    AGENT_GRID,
                    'py-2.5 border-b border-slate-100 last:border-0 text-xs items-center',
                    onAgentClick && 'cursor-pointer hover:bg-slate-50'
                  )}>
                  <span className="font-mono text-[10px] text-slate-700 truncate">
                    {row.id}
                  </span>
                  <span className="font-medium text-slate-900 truncate">{row.name}</span>
                  <span className="text-slate-600 truncate">{row.region}</span>
                  <span className="text-slate-600 truncate">{row.sub_region ?? '—'}</span>
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
                  <span className="text-slate-600 truncate">
                    {formatReportDateTime(row.created_at)}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {row.visit_count ?? 0}
                  </span>
                  <span className="text-slate-600 truncate">
                    {row.last_visited_by ?? '—'}
                  </span>
                </div>
              );
            })}
          </DataTable>
        )}
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-lg font-semibold text-slate-900 mt-0.5">{value}</div>
    </div>
  );
}
