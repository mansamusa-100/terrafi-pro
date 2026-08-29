import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ClipboardList,
  MapPin,
  Search,
  Target,
  UserCheck,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { MetricCard } from './MetricCard';
import { DataTable } from './DataTable';
import { ExportButton } from './ExportButton';
import { OfficerJourneyMap } from './OfficerJourneyMap';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import {
  api,
  type OfficerReport,
  type OfficerVisitAchievedRow,
  type OfficerWorkDurationRow
} from '../lib/api';
import {
  DATE_RANGE_PRESETS,
  formatReportDate,
  formatReportDateTime,
  presetLabel,
  type DateRangePreset
} from '../lib/date-range-presets';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { cn } from '../lib/utils';

const OFFICER_DATE_PRESETS = DATE_RANGE_PRESETS.filter((p) => p.value !== 'all');

const selectClass =
  'px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-apsBlue transition-colors';

const TARGET_CLASS_BADGE: Record<string, string> = {
  exceeded: 'bg-emerald-100 text-emerald-800',
  met: 'bg-blue-100 text-blue-800',
  below: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800'
};

const ACCOUNT_STATUS_BADGE: Record<string, string> = {
  active: 'bg-apsGreenLt text-apsGreen',
  invited: 'bg-slate-100 text-slate-600',
  suspended: 'bg-apsRedLt text-apsRed'
};

type TableTab = 'visit_achieved' | 'work_duration' | 'team_activity';

const VISIT_ACHIEVED_COLS =
  'grid grid-cols-[repeat(8,minmax(0,1fr))] gap-2';
const WORK_DURATION_COLS =
  'grid grid-cols-[repeat(10,minmax(0,1fr))] gap-2';
const TEAM_ACTIVITY_COLS =
  'grid grid-cols-[repeat(7,minmax(0,1fr))] gap-2';

function formatFieldTime(minutes: number | null) {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function OfficerReportSection() {
  const { user } = useAuth();
  const { users, zones } = useAppData();

  const [preset, setPreset] = useState<DateRangePreset>('this_month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [zoneFilter, setZoneFilter] = useState('');
  const [officerFilter, setOfficerFilter] = useState('');
  const [teamLeadFilter, setTeamLeadFilter] = useState('');
  const [accountStatusFilter, setAccountStatusFilter] = useState('');
  const [targetClassFilter, setTargetClassFilter] = useState('');
  const [activeTab, setActiveTab] = useState<TableTab>('visit_achieved');
  const [loading, setLoading] = useState(true);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [report, setReport] = useState<OfficerReport | null>(null);
  const [journeyDate, setJourneyDate] = useState<string | null>(null);
  const [journeyOfficerId, setJourneyOfficerId] = useState<string | null>(null);

  const isManagerLike = user?.role === 'manager' || user?.role === 'internal';
  const isTeamLead = user?.role === 'team_lead';
  const isAdr = user?.role === 'adr';
  const showTeamActivity = !isAdr;

  const officerOptions = useMemo(() => {
    const adrs = users.filter((u) => u.role === 'adr' && u.id);
    if (isTeamLead && user?.supervised_adr_ids?.length) {
      return adrs.filter((a) => user.supervised_adr_ids!.includes(a.id!));
    }
    if (isAdr && user?.id) {
      return adrs.filter((a) => a.id === user.id);
    }
    return adrs;
  }, [users, isTeamLead, isAdr, user?.supervised_adr_ids, user?.id]);

  const teamLeadOptions = useMemo(
    () => users.filter((u) => u.role === 'team_lead' && u.id),
    [users]
  );

  const queryParams = useMemo(
    () => ({
      preset,
      from: preset === 'custom' ? dateFrom : undefined,
      to: preset === 'custom' ? dateTo : undefined,
      q: debouncedSearch.trim() || undefined,
      zone: zoneFilter || undefined,
      officer_id: officerFilter || undefined,
      team_lead_id: teamLeadFilter || undefined,
      account_status: accountStatusFilter || undefined,
      target_class: targetClassFilter || undefined
    }),
    [
      preset,
      dateFrom,
      dateTo,
      debouncedSearch,
      zoneFilter,
      officerFilter,
      teamLeadFilter,
      accountStatusFilter,
      targetClassFilter
    ]
  );

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.performance.officerReport(queryParams);
      setReport(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load officer report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const loadJourney = useCallback(async (officerId: string, date: string) => {
    setJourneyLoading(true);
    setJourneyOfficerId(officerId);
    setJourneyDate(date);
    try {
      const journey = await api.performance.officerJourney(officerId, date);
      setReport((prev) => (prev ? { ...prev, journey } : prev));
    } catch {
      toast.error('Could not load journey map');
    } finally {
      setJourneyLoading(false);
    }
  }, []);

  const summary = report?.summary;
  const period = report?.period;
  const targetClasses = report?.target_classes;

  const exportBase = {
    preset,
    from: preset === 'custom' ? dateFrom : undefined,
    to: preset === 'custom' ? dateTo : undefined,
    q: debouncedSearch.trim() || undefined,
    zone: zoneFilter || undefined,
    officer_id: officerFilter || undefined,
    team_lead_id: teamLeadFilter || undefined,
    account_status: accountStatusFilter || undefined,
    target_class: targetClassFilter || undefined
  };

  const handleWorkDurationClick = (row: OfficerWorkDurationRow) => {
    void loadJourney(row.officer_id, row.date);
  };

  const handleOfficerAchievedClick = (row: OfficerVisitAchievedRow) => {
    const latest = report?.work_duration
      .filter((r) => r.officer_id === row.officer_id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (latest) {
      void loadJourney(row.officer_id, latest.date);
      setActiveTab('work_duration');
    }
  };

  return (
    <div className="space-y-6">
      <div className="metric-grid-3">
        <MetricCard
          label="Total officers (ADRs)"
          value={String(summary?.total_officers ?? '—')}
          icon={<Users className="w-5 h-5" />}
          accent="#1565C0"
        />
        <MetricCard
          label="Active officers"
          value={String(summary?.active_officers ?? '—')}
          sub="≥1 visit in selected period"
          icon={<UserCheck className="w-5 h-5" />}
          accent="#00897B"
        />
        <MetricCard
          label="Total visit target"
          value={String(summary?.total_visit_target ?? '—')}
          sub={
            summary
              ? `${summary.visit_frequency_target}/officer/mo prorated`
              : undefined
          }
          icon={<Target className="w-5 h-5" />}
          accent="#F59E0B"
        />
        <MetricCard
          label="Visits done"
          value={String(summary?.visits_done ?? '—')}
          icon={<MapPin className="w-5 h-5" />}
          accent="#22C55E"
        />
        <MetricCard
          label="Visit coverage"
          value={summary != null ? `${summary.visit_coverage_pct}%` : '—'}
          sub={
            summary
              ? `${summary.visits_done} / ${summary.total_visit_target} target visits`
              : undefined
          }
          icon={<ClipboardList className="w-5 h-5" />}
          accent="#6366F1"
        />
      </div>

      <OfficerJourneyMap
        journey={report?.journey ?? null}
        loading={journeyLoading}
      />

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-apsBlue" />
                Officer report
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {period
                  ? `${presetLabel(period.preset)} · ${formatReportDate(period.from)} → ${formatReportDate(period.to)} · Target ${summary?.visit_frequency_target ?? 25}/officer/mo (prorated)`
                  : 'Visit achievement, field time, and team activity'}
              </p>
              {targetClasses && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Target classes: Exceeded ≥{targetClasses.exceeded_min}% · Met ≥
                  {targetClasses.met_min}% · Below ≥{targetClasses.below_min}% · Critical &lt;
                  {targetClasses.below_min}%
                </p>
              )}
            </div>
            <ExportButton
              path={api.export.officerReport(exportBase, activeTab)}
              filename={`officer-report-${activeTab}-${period?.from ?? 'export'}.csv`}
              label="Export table"
            />
          </div>

          <div className="flex flex-col lg:flex-row flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as DateRangePreset)}
                className={selectClass}>
                {OFFICER_DATE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {preset === 'custom' && (
              <>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={selectClass}
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={selectClass}
                />
              </>
            )}
            <div className="relative flex-1 min-w-[10rem]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Search officer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(selectClass, 'pl-8 w-full')}
              />
            </div>
            {(isManagerLike || isTeamLead) && (
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className={selectClass}>
                <option value="">All zones</option>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            )}
            {!isAdr && (
              <select
                value={officerFilter}
                onChange={(e) => setOfficerFilter(e.target.value)}
                className={selectClass}>
                <option value="">All officers</option>
                {officerOptions.map((o) => (
                  <option key={o.id} value={o.id!}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
            {isManagerLike && (
              <select
                value={teamLeadFilter}
                onChange={(e) => setTeamLeadFilter(e.target.value)}
                className={selectClass}>
                <option value="">All team leads</option>
                {teamLeadOptions.map((t) => (
                  <option key={t.id} value={t.id!}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={accountStatusFilter}
              onChange={(e) => setAccountStatusFilter(e.target.value)}
              className={selectClass}>
              <option value="">All account statuses</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
            </select>
            <select
              value={targetClassFilter}
              onChange={(e) => setTargetClassFilter(e.target.value)}
              className={selectClass}>
              <option value="">All target classes</option>
              <option value="exceeded">Exceeded</option>
              <option value="met">Met</option>
              <option value="below">Below</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            {(
              [
                ['visit_achieved', 'Visit achieved'],
                ['work_duration', 'Work duration'],
                ...(showTeamActivity ? [['team_activity', 'Team activity']] : [])
              ] as [TableTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  activeTab === id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 py-8 text-center">Loading report…</p>
        ) : activeTab === 'visit_achieved' ? (
          !report?.visit_achieved.length ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No officers match your filters.
            </p>
          ) : (
            <DataTable minWidth="960px">
              <div
                className={cn(
                  VISIT_ACHIEVED_COLS,
                  'pb-2 mb-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center'
                )}>
                <span>ID</span>
                <span>Name</span>
                <span>Team lead</span>
                <span>Zone</span>
                <span>Target</span>
                <span>Visits</span>
                <span>Target class</span>
                <span>Account status</span>
              </div>
              {report.visit_achieved.map((row) => (
                <div
                  key={row.officer_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOfficerAchievedClick(row)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOfficerAchievedClick(row);
                    }
                  }}
                  className={cn(
                    VISIT_ACHIEVED_COLS,
                    'py-2.5 border-b border-slate-100 last:border-0 text-xs items-center cursor-pointer hover:bg-slate-50'
                  )}>
                  <span className="font-mono text-[10px] text-slate-700 truncate">
                    {row.officer_id}
                  </span>
                  <span className="font-medium text-slate-900 truncate">{row.name}</span>
                  <span className="text-slate-600 truncate">{row.team_lead_name ?? '—'}</span>
                  <span className="text-slate-600 truncate">{row.zone}</span>
                  <span className="text-slate-700">{row.target}</span>
                  <span className="text-slate-700">
                    {row.visits_done} ({row.visit_rate_pct}%)
                  </span>
                  <span>
                    <span
                      className={cn(
                        'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full',
                        TARGET_CLASS_BADGE[row.target_class]
                      )}>
                      {row.target_class_label}
                    </span>
                  </span>
                  <span>
                    <span
                      className={cn(
                        'text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full',
                        ACCOUNT_STATUS_BADGE[row.account_status] ??
                          'bg-slate-100 text-slate-600'
                      )}>
                      {row.account_status}
                    </span>
                  </span>
                </div>
              ))}
            </DataTable>
          )
        ) : activeTab === 'work_duration' ? (
          !report?.work_duration.length ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No field days in this period.
            </p>
          ) : (
            <DataTable minWidth="1280px">
              <div
                className={cn(
                  WORK_DURATION_COLS,
                  'pb-2 mb-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center'
                )}>
                <span>Date</span>
                <span>Name</span>
                <span>Role</span>
                <span>Team lead</span>
                <span>Zone</span>
                <span>Visits</span>
                <span>Unique agents</span>
                <span>Earliest visit</span>
                <span>Latest visit</span>
                <span>Field time</span>
              </div>
              {report.work_duration.map((row) => (
                <div
                  key={`${row.officer_id}-${row.date}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleWorkDurationClick(row)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleWorkDurationClick(row);
                    }
                  }}
                  className={cn(
                    WORK_DURATION_COLS,
                    'py-2.5 border-b border-slate-100 last:border-0 text-xs items-center cursor-pointer hover:bg-slate-50',
                    journeyOfficerId === row.officer_id &&
                      journeyDate === row.date &&
                      'bg-blue-50/80'
                  )}>
                  <span className="text-slate-700">{row.date}</span>
                  <span className="font-medium text-slate-900 truncate">{row.name}</span>
                  <span className="text-slate-600 truncate">{row.role}</span>
                  <span className="text-slate-600 truncate">{row.team_lead_name ?? '—'}</span>
                  <span className="text-slate-600 truncate">{row.zone}</span>
                  <span className="text-slate-700">{row.visits_done}</span>
                  <span className="text-slate-700">{row.unique_agents_visited}</span>
                  <span className="text-slate-600 truncate">
                    {row.earliest_visit ? formatReportDateTime(row.earliest_visit) : '—'}
                  </span>
                  <span className="text-slate-600 truncate">
                    {row.latest_visit ? formatReportDateTime(row.latest_visit) : '—'}
                  </span>
                  <span className="text-slate-700">{formatFieldTime(row.field_time_minutes)}</span>
                </div>
              ))}
            </DataTable>
          )
        ) : !report?.team_activity.length ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            No team activity for this period.
          </p>
        ) : (
          <DataTable minWidth="880px">
            <div
              className={cn(
                TEAM_ACTIVITY_COLS,
                'pb-2 mb-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center'
              )}>
              <span>Team lead</span>
              <span>Zone</span>
              <span>Officers</span>
              <span>Active</span>
              <span>Total target</span>
              <span>Visits done</span>
              <span>Coverage</span>
            </div>
            {report.team_activity.map((row) => (
              <div
                key={row.team_lead_id}
                className={cn(
                  TEAM_ACTIVITY_COLS,
                  'py-2.5 border-b border-slate-100 last:border-0 text-xs items-center'
                )}>
                <span className="font-medium text-slate-900 truncate">{row.team_lead_name}</span>
                <span className="text-slate-600 truncate">{row.zone}</span>
                <span className="text-slate-700">{row.officer_count}</span>
                <span className="text-slate-700">{row.active_officer_count}</span>
                <span className="text-slate-700">{row.total_visit_target}</span>
                <span className="text-slate-700">{row.visits_done}</span>
                <span className="text-slate-700">{row.visit_coverage_pct}%</span>
              </div>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}
