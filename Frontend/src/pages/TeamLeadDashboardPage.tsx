import React, { useMemo } from 'react';
import {
  Users,
  MapPin,
  CalendarCheck,
  AlertTriangle,
  UserCog,
  TrendingUp,
  Plus,
  Map,
  ChevronRight,
  Target
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/DonutChart';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import type { Agent } from '../lib/api';
import { initials, avatarColor, fmt, STATUS_META } from '../lib/data';
import { cn } from '../lib/utils';
import { can } from '../lib/rbac';

interface TeamLeadDashboardPageProps {
  setActive: (page: string) => void;
  setSelectedAgent: (agent: Agent) => void;
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-apsGreen';
  if (score >= 60) return 'text-apsAmber';
  return 'text-apsRed';
}

function scoreBarColor(score: number) {
  if (score >= 80) return 'bg-apsGreen';
  if (score >= 60) return 'bg-apsAmber';
  return 'bg-apsRed';
}

export function TeamLeadDashboardPage({
  setActive,
  setSelectedAgent
}: TeamLeadDashboardPageProps) {
  const { user } = useAuth();
  const {
    agents,
    adrPerformance,
    visitSummary,
    visits,
    users,
    loading
  } = useAppData();

  const supervisedAdrs = useMemo(
    () =>
      users.filter(
        (u) => u.role === 'adr' && u.id && user?.supervised_adr_ids?.includes(u.id)
      ),
    [users, user?.supervised_adr_ids]
  );

  const stats = useMemo(() => {
    const critical = agents.filter((a) => a.status === 'critical').length;
    const lowFloat = agents.filter((a) => a.status === 'low_float').length;
    const pendingKyc = agents.filter((a) => a.kyc === 'pending').length;
    const needsAttention = agents.filter(
      (a) =>
        a.status === 'critical' ||
        a.status === 'low_float' ||
        a.kyc === 'pending'
    );
    const avgScore =
      agents.length > 0
        ? Math.round(agents.reduce((s, a) => s + a.score, 0) / agents.length)
        : 0;
    const teamVisitsDone = adrPerformance.reduce((s, r) => s + r.visits_done, 0);
    const teamVisitsMissed = adrPerformance.reduce((s, r) => s + r.visits_missed, 0);
    const teamVisitTarget = adrPerformance.reduce((s, r) => s + r.visit_target, 0);

    const statusCounts = agents.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});

    return {
      critical,
      lowFloat,
      pendingKyc,
      needsAttention,
      avgScore,
      teamVisitsDone,
      teamVisitsMissed,
      teamVisitTarget,
      statusCounts
    };
  }, [agents, adrPerformance]);

  const todayVisits = visitSummary?.today ?? {
    scheduled: 0,
    done: 0,
    pending: 0,
    missed: 0
  };

  const weeklyVolume = visitSummary?.weeklyVolume ?? { labels: [], values: [] };

  const todayVisitList = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return visits
      .filter((v) => v.visit_date === today || !v.visit_date)
      .slice(0, 6);
  }, [visits]);

  const canOnboard = user ? can(user, 'onboardAgent') : false;

  if (loading && agents.length === 0) {
    return (
      <div className="page-pad flex items-center justify-center min-h-[40vh] text-sm text-slate-500">
        Loading regional overview…
      </div>
    );
  }

  return (
    <div className="page-pad">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">
            Team Lead · Regional oversight
          </p>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {user?.zone || user?.scope || 'Your region'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitoring {supervisedAdrs.length} ADR
            {supervisedAdrs.length === 1 ? '' : 's'} · {agents.length} agent
            {agents.length === 1 ? '' : 's'} in your territory
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActive('visits')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 flex items-center gap-1.5">
            <CalendarCheck className="w-3.5 h-3.5" />
            Today&apos;s visits
          </button>
          <button
            type="button"
            onClick={() => setActive('map')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 flex items-center gap-1.5">
            <Map className="w-3.5 h-3.5" />
            Map view
          </button>
          {canOnboard && (
            <button
              type="button"
              onClick={() => setActive('agents')}
              className="px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-medium hover:bg-navyMid flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Onboard agent
            </button>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="metric-grid mb-6">
        <MetricCard
          animDelay={0}
          label="Supervised ADRs"
          value={adrPerformance.length}
          sub={supervisedAdrs.map((a) => a.name.split(' ')[0]).join(', ') || '—'}
          icon={<UserCog className="w-5 h-5" />}
          accent="#0D9488"
          onClick={() => setActive('performance')}
        />
        <MetricCard
          animDelay={80}
          label="Region agents"
          value={agents.length}
          sub={`${stats.avgScore}% avg score`}
          icon={<Users className="w-5 h-5" />}
          accent="#1565C0"
          onClick={() => setActive('agents')}
        />
        <MetricCard
          animDelay={160}
          label="Visits today"
          value={`${todayVisits.done}/${todayVisits.scheduled || todayVisits.done + todayVisits.pending}`}
          sub={
            todayVisits.missed > 0
              ? `${todayVisits.missed} missed`
              : `${todayVisits.pending} pending`
          }
          subColor={todayVisits.missed > 0 ? 'text-apsRed' : undefined}
          icon={<CalendarCheck className="w-5 h-5" />}
          accent="#00897B"
          onClick={() => setActive('visits')}
        />
        <MetricCard
          animDelay={240}
          label="Need attention"
          value={stats.needsAttention.length}
          sub={`${stats.critical} critical · ${stats.pendingKyc} KYC pending`}
          subColor={stats.needsAttention.length > 0 ? 'text-apsAmber' : 'text-apsGreen'}
          icon={<AlertTriangle className="w-5 h-5" />}
          accent="#F59E0B"
          onClick={() => setActive('agents')}
        />
      </div>

      {/* ADR team + charts */}
      <div className="metric-grid-3 mb-5">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">ADR team performance</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                This month · {stats.teamVisitsDone} of {stats.teamVisitTarget} visit
                targets completed
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActive('performance')}
              className="text-xs font-medium text-apsBlue hover:underline flex items-center gap-0.5">
              Full report
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {adrPerformance.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No ADRs assigned yet. Ask your manager to link ADRs to your account.
            </p>
          ) : (
            <div className="space-y-3">
              {adrPerformance.map((adr) => (
                <div
                  key={adr.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
                          avatarColor(adr.name).bg,
                          avatarColor(adr.name).text
                        )}>
                        {initials(adr.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {adr.name}
                        </div>
                        <div className="text-xs text-slate-500">{adr.zone}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn('text-lg font-bold', scoreColor(adr.score))}>
                        {adr.score}%
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                        Score
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div>
                      <div className="text-base font-bold text-slate-900">{adr.agents}</div>
                      <div className="text-[10px] text-slate-500">Agents</div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-900">
                        {adr.visits_done}/{adr.visit_target}
                      </div>
                      <div className="text-[10px] text-slate-500">Visits</div>
                    </div>
                    <div>
                      <div
                        className={cn(
                          'text-base font-bold',
                          adr.visits_missed > 0 ? 'text-apsRed' : 'text-slate-900'
                        )}>
                        {adr.visits_missed}
                      </div>
                      <div className="text-[10px] text-slate-500">Missed</div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-900">{adr.kyc_rate}%</div>
                      <div className="text-[10px] text-slate-500">KYC rate</div>
                    </div>
                  </div>

                  <ProgressBar
                    value={adr.visit_rate}
                    color={scoreBarColor(adr.visit_rate)}
                    height="h-1.5"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Visit completion</span>
                    <span>{adr.visit_rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Agent status</h3>
            <p className="text-xs text-slate-500 mb-4">Your supervised network</p>
            <DonutChart
              data={[
                { value: stats.statusCounts.active ?? 0, color: '#22C55E', label: 'Active' },
                { value: stats.statusCounts.low_float ?? 0, color: '#F59E0B', label: 'Low float' },
                { value: stats.statusCounts.critical ?? 0, color: '#EF4444', label: 'Critical' },
                { value: stats.statusCounts.suspended ?? 0, color: '#94A3B8', label: 'Suspended' }
              ]}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-semibold text-slate-900">Team visit rate</h3>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {stats.teamVisitTarget > 0
                ? Math.round((stats.teamVisitsDone / stats.teamVisitTarget) * 100)
                : 0}
              %
            </div>
            <p className="text-xs text-slate-500 mb-3">
              {stats.teamVisitsDone} completed · {stats.teamVisitsMissed} missed this month
            </p>
            <ProgressBar
              value={
                stats.teamVisitTarget > 0
                  ? Math.round((stats.teamVisitsDone / stats.teamVisitTarget) * 100)
                  : 0
              }
              color="bg-teal-600"
              height="h-2"
            />
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="metric-grid-3">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            Weekly visit volume
          </h3>
          <p className="text-xs text-slate-500 mb-4">Completed visits across your ADR team</p>
          {weeklyVolume.labels.length > 0 ? (
            <BarChart labels={weeklyVolume.labels} values={weeklyVolume.values} color="#0D9488" />
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">No visit data yet</p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Needs attention</h3>
            <button
              type="button"
              onClick={() => setActive('agents')}
              className="text-xs text-apsBlue font-medium hover:underline">
              View all
            </button>
          </div>
          {stats.needsAttention.length === 0 ? (
            <p className="text-sm text-apsGreen py-6 text-center">
              All agents in good standing
            </p>
          ) : (
            <div className="space-y-2">
              {stats.needsAttention.slice(0, 5).map((agent) => {
                const s = STATUS_META[agent.status];
                const ac = avatarColor(agent.name);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setSelectedAgent(agent)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                        ac.bg,
                        ac.text
                      )}>
                      {initials(agent.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-900 truncate">
                        {agent.outlet_name || agent.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {agent.officer}
                        {agent.kyc === 'pending' ? ' · KYC pending' : ''}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                        s?.bg,
                        s?.color
                      )}>
                      {s?.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Today's visits strip */}
      {todayVisitList.length > 0 && (
        <div className="mt-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">Today&apos;s field activity</h3>
            </div>
            <button
              type="button"
              onClick={() => setActive('visits')}
              className="text-xs text-apsBlue font-medium hover:underline flex items-center gap-0.5">
              Open visits
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {todayVisitList.map((v) => (
              <div
                key={v.id ?? `${v.agent}-${v.time}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-900 truncate">{v.agent}</div>
                  <div className="text-[10px] text-slate-500">
                    {v.officer} · {v.time}
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ml-2',
                    v.status === 'done'
                      ? 'bg-apsGreenLt text-apsGreen'
                      : v.status === 'missed'
                        ? 'bg-apsRedLt text-apsRed'
                        : 'bg-apsAmberLt text-apsAmber'
                  )}>
                  {v.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low float spotlight */}
      {agents.filter((a) => a.status === 'critical' || a.status === 'low_float').length >
        0 && (
        <div className="mt-5 bg-gradient-to-br from-amber-50 to-white border border-amber-200/60 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-900">Float alerts in your region</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {agents
              .filter((a) => a.status === 'critical' || a.status === 'low_float')
              .slice(0, 6)
              .map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgent(agent)}
                  className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-left hover:border-amber-300 transition-colors">
                  <div className="text-xs font-medium text-slate-900">
                    {agent.outlet_name || agent.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {fmt(agent.efloat)} e-float · {agent.officer}
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
