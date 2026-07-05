import React, { useMemo, useState } from 'react';
import {
  BarChart2,
  Target,
  Trophy,
  AlertCircle,
  ArrowUpDown,
  Users
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { BarChart } from '../components/charts/BarChart';
import { Sparkline } from '../components/charts/Sparkline';
import { ProgressBar } from '../components/ProgressBar';
import { ExportButton } from '../components/ExportButton';
import { initials, avatarColor } from '../lib/data';
import { useAppData } from '../lib/data-context';
import { api } from '../lib/api';
import { DataTable } from '../components/DataTable';
import { cn } from '../lib/utils';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function PerformancePage() {
  const { agents, adrPerformance } = useAppData();

  if (!agents.length) {
    return (
      <div className="page-pad text-sm text-slate-500">No agent data available.</div>
    );
  }

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const avgScore = Math.round(
    agents.reduce((s, a) => s + a.score, 0) / agents.length
  );
  const aboveTarget = agents.filter((a) => a.score >= 80).length;
  const topPerformer = agents.reduce(
    (top, a) => (a.score > top.score ? a : top),
    agents[0]
  );
  const needsAttention = agents.reduce(
    (low, a) => (a.score < low.score ? a : low),
    agents[0]
  );

  const sortedAdrs = useMemo(() => {
    const data = [...adrPerformance];
    if (!sortConfig) return data.sort((a, b) => b.score - a.score);
    const { key, direction } = sortConfig;
    data.sort((a, b) => {
      // @ts-expect-error dynamic sort
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      // @ts-expect-error dynamic sort
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [adrPerformance, sortConfig]);

  const sortedAgents = [...agents].sort((a, b) => {
    if (!sortConfig) return b.score - a.score;
    return b.score - a.score;
  });

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

  const adrColumns: [string, string][] = [
    ['name', 'ADR'],
    ['agents', 'Agents'],
    ['visits_done', 'Visits'],
    ['visit_rate', 'Visit rate'],
    ['kyc_rate', 'KYC rate'],
    ['score', 'Score']
  ];

  const agentColumns: [string, string][] = [
    ['name', 'Agent'],
    ['zone', 'Zone'],
    ['score', 'Score'],
    ['visits', 'Visits'],
    ['score', 'Trend']
  ];

  const monthStart = `${todayISO().slice(0, 7)}-01`;

  return (
    <div className="page-pad">
      <div className="flex items-center justify-end gap-2 mb-5 flex-wrap">
        <ExportButton
          path={api.export.agents()}
          filename={`agents-${todayISO()}.csv`}
        />
        <ExportButton
          path={api.export.compliance()}
          filename={`compliance-${todayISO()}.csv`}
          label="Compliance CSV"
        />
        <ExportButton
          path={api.export.adrPerformance()}
          filename={`adr-performance-${todayISO()}.csv`}
          label="ADR report"
        />
      </div>

      <div className="metric-grid mb-6">
        <MetricCard
          label="Avg. agent score"
          value={`${avgScore}%`}
          icon={<BarChart2 className="w-5 h-5" />}
          accent="#1565C0"
        />
        <MetricCard
          label="Agents above target"
          value={String(aboveTarget)}
          sub={`${Math.round((aboveTarget / agents.length) * 100)}% of network`}
          icon={<Target className="w-5 h-5" />}
          accent="#00897B"
        />
        <MetricCard
          label="Top performer"
          value={topPerformer.name}
          sub={`${topPerformer.score}% score`}
          icon={<Trophy className="w-5 h-5" />}
          accent="#22C55E"
        />
        <MetricCard
          label="Needs attention"
          value={needsAttention.name}
          sub={`${needsAttention.score}% score`}
          icon={<AlertCircle className="w-5 h-5" />}
          accent="#EF4444"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              ADR field officer performance
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Live metrics for {monthStart} → {todayISO()}
            </p>
          </div>
          <Users className="w-5 h-5 text-slate-300 shrink-0" />
        </div>

        {sortedAdrs.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            No ADR performance data yet.
          </p>
        ) : (
          <DataTable minWidth="720px">
            <div className="grid grid-cols-6 gap-4 pb-3 mb-3 border-b border-slate-200">
              {adrColumns.map(([key, label]) => (
                <div
                  key={label}
                  onClick={() => requestSort(key)}
                  className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:text-slate-900">
                  {label}
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              ))}
            </div>
            {sortedAdrs.map((o) => {
              const bgColor =
                o.score >= 80
                  ? 'bg-apsGreen'
                  : o.score >= 60
                    ? 'bg-apsAmber'
                    : 'bg-apsRed';
              const tc =
                o.score >= 80
                  ? 'text-apsGreen'
                  : o.score >= 60
                    ? 'text-apsAmber'
                    : 'text-apsRed';
              const ac = avatarColor(o.name);
              return (
                <div
                  key={o.id}
                  className="grid grid-cols-6 gap-4 py-3 border-b border-slate-100 last:border-0 items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                        ac.bg,
                        ac.text
                      )}>
                      {initials(o.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-900 truncate">
                        {o.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {o.zone}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">{o.agents}</div>
                  <div className="text-xs text-slate-600">
                    {o.visits_done}/{o.visit_target}
                    {o.visits_missed > 0 && (
                      <span className="text-apsRed ml-1">
                        · {o.visits_missed} missed
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-700">
                    {o.visit_rate}%
                  </div>
                  <div className="text-xs text-slate-600">
                    {o.kyc_verified}/{o.agents} ({o.kyc_rate}%)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-bold w-8', tc)}>
                      {o.score}%
                    </span>
                    <div className="flex-1 max-w-[5rem]">
                      <ProgressBar value={o.score} color={bgColor} height="h-1.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </DataTable>
        )}
      </div>

      <div className="panel-grid-2 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Visit completion by ADR
          </h3>
          {sortedAdrs.length > 0 ? (
            <BarChart
              labels={sortedAdrs.map((o) => o.name.split(' ')[0])}
              values={sortedAdrs.map((o) => o.visits_done)}
              color="#1565C0"
            />
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-slate-500">
              No data
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Agent score distribution
          </h3>
          <BarChart
            labels={['<40', '40–59', '60–79', '80–94', '95+']}
            values={[
              agents.filter((a) => a.score < 40).length,
              agents.filter((a) => a.score >= 40 && a.score < 60).length,
              agents.filter((a) => a.score >= 60 && a.score < 80).length,
              agents.filter((a) => a.score >= 80 && a.score < 95).length,
              agents.filter((a) => a.score >= 95).length
            ]}
            color="#1565C0"
          />
          <div className="grid grid-cols-3 gap-3 mt-4">
            {(
              [
                ['Top (≥80)', agents.filter((a) => a.score >= 80).length, 'text-apsGreen'],
                [
                  'Mid (60–79)',
                  agents.filter((a) => a.score >= 60 && a.score < 80).length,
                  'text-apsAmber'
                ],
                ['Low (<60)', agents.filter((a) => a.score < 60).length, 'text-apsRed']
              ] as [string, number, string][]
            ).map(([label, value, color]) => (
              <div
                key={label}
                className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <div className={cn('text-xl font-bold', color)}>{value}</div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          Agent scorecards
        </h3>
        <DataTable minWidth="560px">
          <div className="grid grid-cols-5 gap-2 border-b border-slate-200 pb-2 mb-2">
            {agentColumns.map(([key, label]) => (
              <div
                key={label}
                onClick={() => requestSort(key)}
                className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:text-slate-900">
                {label}
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              </div>
            ))}
          </div>
          {sortedAgents.map((a) => {
            const c =
              a.score >= 80
                ? 'bg-apsGreen'
                : a.score >= 60
                  ? 'bg-apsAmber'
                  : 'bg-apsRed';
            const tc =
              a.score >= 80
                ? 'text-apsGreen'
                : a.score >= 60
                  ? 'text-apsAmber'
                  : 'text-apsRed';
            const hexColor =
              a.score >= 80 ? '#22C55E' : a.score >= 60 ? '#F59E0B' : '#EF4444';
            const sparkData = [
              a.score - 8,
              a.score - 3,
              a.score + 2,
              a.score - 1,
              a.score + 4,
              a.score - 2,
              a.score
            ].map((v) => Math.max(0, Math.min(100, v)));
            return (
              <div
                key={a.id}
                className="grid grid-cols-5 gap-2 py-2.5 border-b border-slate-100 last:border-0 items-center">
                <div className="text-xs font-medium text-slate-900">{a.name}</div>
                <div className="text-xs text-slate-500">{a.zone}</div>
                <div className="flex items-center gap-3">
                  <div className={cn('text-xs font-bold w-8', tc)}>
                    {a.score}%
                  </div>
                  <div className="w-12">
                    <ProgressBar value={a.score} color={c} height="h-1.5" />
                  </div>
                </div>
                <div className="text-xs text-slate-500">{a.visits} visits</div>
                <div>
                  <Sparkline data={sparkData} color={hexColor} />
                </div>
              </div>
            );
          })}
        </DataTable>
      </div>
    </div>
  );
}
