import React, { useMemo, useState } from 'react';
import {
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowUpDown,
  Plus,
  CalendarPlus,
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { BarChart } from '../components/charts/BarChart';
import { ProgressBar } from '../components/ProgressBar';
import { VisitLogModal } from '../components/VisitLogModal';
import { ScheduleVisitModal } from '../components/ScheduleVisitModal';
import { ExportButton } from '../components/ExportButton';
import { useAppData } from '../lib/data-context';
import { DataTable } from '../components/DataTable';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { ApiError, api } from '../lib/api';
import type { Visit } from '../lib/api';
import { getQueuedVisits } from '../lib/offline-visits';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_STYLES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  done: {
    label: 'Done',
    bg: 'bg-apsGreenLt',
    text: 'text-apsGreen',
    border: 'border-apsGreen/20'
  },
  pending: {
    label: 'Pending',
    bg: 'bg-apsAmberLt',
    text: 'text-apsAmber',
    border: 'border-apsAmber/20'
  },
  missed: {
    label: 'Missed',
    bg: 'bg-apsRedLt',
    text: 'text-apsRed',
    border: 'border-apsRed/20'
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200'
  }
};

export function VisitsPage() {
  const { user } = useAuth();
  const {
    visits,
    officers,
    visitSummary,
    logVisit,
    scheduleVisit,
    updateVisit,
    queuedVisitCount
  } = useAppData();
  const canLog = user ? can(user.role, 'logVisit') : false;
  const canSchedule = user ? can(user.role, 'scheduleVisit') : false;
  const canManage = canLog || canSchedule;
  const canExport =
    user && (can(user.role, 'exportData') || user.role === 'adr');

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [logPresetAgentId, setLogPresetAgentId] = useState<string | undefined>();
  const [rescheduleVisit, setRescheduleVisit] = useState<Visit | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(todayISO());
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const weeklyLabels = visitSummary?.weeklyVolume?.labels ?? [];
  const weeklyValues = visitSummary?.weeklyVolume?.values ?? [];
  const queuedVisits = queuedVisitCount > 0 ? getQueuedVisits() : [];

  const sortedVisits = useMemo(() => {
    const data = [...visits];
    if (sortConfig) {
      const { key, direction } = sortConfig;
      data.sort((a, b) => {
        // @ts-expect-error dynamic sort key
        if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
        // @ts-expect-error dynamic sort key
        if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [sortConfig, visits]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'asc'
    ) {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const openLogForVisit = (visit: Visit) => {
    setLogPresetAgentId(visit.agent_id);
    setLogOpen(true);
  };

  const runVisitAction = async (
    visitId: number,
    action: () => Promise<unknown>,
    successMsg: string
  ) => {
    setActionLoading(visitId);
    try {
      await action();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleVisit?.id) return;
    setActionLoading(rescheduleVisit.id);
    try {
      await updateVisit(rescheduleVisit.id, {
        visitDate: rescheduleDate,
        time: rescheduleTime
      });
      toast.success('Visit rescheduled');
      setRescheduleVisit(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Reschedule failed');
    } finally {
      setActionLoading(null);
    }
  };

  const today = visitSummary?.today;
  const columns: [string, string, boolean][] = [
    ['agent', 'Agent', true],
    ['zone', 'Zone', true],
    ['officer', 'Officer', true],
    ['type', 'Type', true],
    ['time', 'Time', true],
    ['status', 'Status', true]
  ];

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 outline-none focus:border-apsBlue focus:ring-1 focus:ring-apsBlue/20';

  return (
    <div className="page-pad">
      {(canSchedule || canLog || canExport) && (
        <div className="flex items-center justify-end gap-2 mb-5 flex-wrap">
          {canExport && (
            <ExportButton
              path={api.export.visits()}
              filename={`visits-${todayISO()}.csv`}
              label="Export visits"
            />
          )}
          {canSchedule && (
            <button
              onClick={() => setScheduleOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-slate-300 transition-colors">
              <CalendarPlus className="w-4 h-4 text-slate-400" />
              Schedule visit
            </button>
          )}
          {canLog && (
            <button
              onClick={() => {
                setLogPresetAgentId(undefined);
                setLogOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-apsBlue text-white text-sm font-medium hover:bg-apsBlueMid transition-colors">
              <Plus className="w-4 h-4" />
              Log visit
            </button>
          )}
        </div>
      )}

      {queuedVisits.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-sm font-semibold text-amber-900 mb-2">
            Queued offline ({queuedVisits.length})
          </div>
          <ul className="space-y-1.5">
            {queuedVisits.map((q) => (
              <li
                key={q.id}
                className="text-xs text-amber-900 flex justify-between gap-2 items-start">
                <span>
                  {q.agentName} · {String(q.body.type || 'Visit')}
                  {q.captureDistance != null && (
                    <span
                      className={
                        q.gpsOkAtCapture ? ' text-amber-700' : ' text-red-700'
                      }>
                      {' '}
                      · {q.captureDistance}m
                      {!q.gpsOkAtCapture && ' (over limit)'}
                    </span>
                  )}
                  {q.body.capturedAt && (
                    <span className="block text-[10px] text-amber-700">
                      GPS at{' '}
                      {new Date(String(q.body.capturedAt)).toLocaleString(
                        undefined,
                        { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                      )}
                    </span>
                  )}
                </span>
                <span className="text-amber-700 shrink-0">
                  {new Date(q.queuedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </li>
            ))}
          </ul>
          {queuedVisits.some((q) => q.lastError) && (
            <p className="text-[11px] text-red-700 mt-2">
              Some visits failed to sync — use Sync in the banner above.
            </p>
          )}
        </div>
      )}

      <div className="metric-grid mb-6">
        <MetricCard
          label="Total visits (month)"
          value={String(visitSummary?.monthCompleted ?? '—')}
          sub="completed this month"
          icon={<MapPin className="w-5 h-5" />}
          accent="#1565C0"
        />
        <MetricCard
          label="Completed today"
          value={String(today?.done ?? '—')}
          sub={
            today
              ? `of ${today.scheduled} scheduled`
              : 'loading…'
          }
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="#00897B"
        />
        <MetricCard
          label="Pending today"
          value={String(today?.pending ?? '—')}
          sub="due by 6pm"
          icon={<Clock className="w-5 h-5" />}
          accent="#F59E0B"
        />
        <MetricCard
          label="Missed today"
          value={String(today?.missed ?? '—')}
          sub="need rescheduling"
          icon={<XCircle className="w-5 h-5" />}
          accent="#EF4444"
        />
      </div>

      <div className="metric-grid-3 mb-5">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Weekly visit volume
          </h3>
          {weeklyLabels.length > 0 ? (
            <BarChart
              labels={weeklyLabels}
              values={weeklyValues}
              color="#1565C0"
            />
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-slate-500">
              No completed visits yet
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Completion rate
          </h3>
          <div className="space-y-4">
            {officers.map((o) => {
              const colorClass =
                o.score >= 80
                  ? 'bg-apsGreen'
                  : o.score >= 60
                    ? 'bg-apsAmber'
                    : 'bg-apsRed';
              const textColorClass =
                o.score >= 80
                  ? 'text-apsGreen'
                  : o.score >= 60
                    ? 'text-apsAmber'
                    : 'text-apsRed';
              return (
                <div key={o.name}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-900 font-medium">
                      {o.name.split(' ')[0]}
                    </span>
                    <span className={cn('font-bold', textColorClass)}>
                      {o.score}%
                    </span>
                  </div>
                  <ProgressBar value={o.score} color={colorClass} height="h-2" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          Today&apos;s visit log
        </h3>
        <DataTable minWidth={canManage ? '920px' : '720px'}>
          <div
            className={cn(
              'grid gap-4 pb-3 mb-3 border-b border-slate-200',
              canManage ? 'grid-cols-7' : 'grid-cols-6'
            )}>
            {columns.map(([key, label]) => (
              <div
                key={label}
                onClick={() => requestSort(key)}
                className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:text-slate-900">
                {label}
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              </div>
            ))}
            {canManage && (
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Actions
              </div>
            )}
          </div>
          {sortedVisits.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No visits scheduled for today
            </div>
          ) : (
            sortedVisits.map((v) => {
              const sc = STATUS_STYLES[v.status] || STATUS_STYLES.pending;
              const loading = actionLoading === v.id;
              return (
                <div
                  key={v.id ?? `${v.agent}-${v.time}`}
                  className={cn(
                    'grid gap-4 py-3 border-b border-slate-100 last:border-0 items-center hover:bg-slate-50 -mx-2 px-2 rounded transition-colors',
                    canManage ? 'grid-cols-7' : 'grid-cols-6'
                  )}>
                  <div className="text-xs font-medium text-slate-900">
                    {v.agent}
                  </div>
                  <div className="text-xs text-slate-500">{v.zone}</div>
                  <div className="text-xs text-slate-500">
                    {v.officer.split(' ')[0]}
                  </div>
                  <div className="text-xs text-slate-500">{v.type}</div>
                  <div className="text-xs text-slate-500">{v.time}</div>
                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2.5 py-1 rounded-full w-fit border',
                      sc.bg,
                      sc.text,
                      sc.border
                    )}>
                    {sc.label}
                  </span>
                  {canManage && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : v.status === 'pending' ? (
                        <>
                          {canLog && (
                            <button
                              type="button"
                              onClick={() => openLogForVisit(v)}
                              className="text-[10px] font-semibold px-2 py-1 rounded bg-apsBlue text-white hover:bg-apsBlueMid">
                              Log
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              v.id &&
                              runVisitAction(
                                v.id,
                                () => updateVisit(v.id!, { status: 'missed' }),
                                'Marked as missed'
                              )
                            }
                            className="text-[10px] font-semibold px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100">
                            Miss
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                !v.id ||
                                !window.confirm(
                                  `Cancel the scheduled visit for ${v.agent}?`
                                )
                              ) {
                                return;
                              }
                              runVisitAction(
                                v.id,
                                () => updateVisit(v.id!, { status: 'cancelled' }),
                                'Visit cancelled'
                              );
                            }}
                            className="text-[10px] font-semibold px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-100">
                            Cancel
                          </button>
                        </>
                      ) : v.status === 'missed' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRescheduleVisit(v);
                            setRescheduleDate(todayISO());
                            setRescheduleTime(v.time || '09:00');
                          }}
                          className="text-[10px] font-semibold px-2 py-1 rounded border border-apsBlue text-apsBlue hover:bg-apsBlueLt">
                          Reschedule
                        </button>
                      ) : (
                        <MoreHorizontal className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </DataTable>
      </div>

      <VisitLogModal
        open={logOpen}
        onClose={() => {
          setLogOpen(false);
          setLogPresetAgentId(undefined);
        }}
        presetAgentId={logPresetAgentId}
        onSubmit={logVisit}
      />

      <ScheduleVisitModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSubmit={scheduleVisit}
      />

      {rescheduleVisit && (
        <>
          <div
            onClick={() => setRescheduleVisit(null)}
            className="fixed inset-0 bg-black/40 z-50"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <form
              onSubmit={handleReschedule}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900">
                  Reschedule visit
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {rescheduleVisit.agent} · {rescheduleVisit.type}
                </p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    New date
                  </label>
                  <input
                    type="date"
                    required
                    min={todayISO()}
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    aria-label="New date"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    aria-label="Time"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRescheduleVisit(null)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === rescheduleVisit.id}
                  className="flex-1 py-2.5 rounded-lg bg-apsBlue text-white text-sm font-semibold disabled:opacity-60">
                  Save
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
