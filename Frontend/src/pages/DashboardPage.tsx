import React from 'react';
import { TrendingUp, Users, Wallet, AlertCircle } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { AlertItem } from '../components/AlertItem';
import { FloatTrendChart } from '../components/charts/FloatTrendChart';
import { DonutChart } from '../components/charts/DonutChart';
import { ProgressBar } from '../components/ProgressBar';
import {
  fmt,
  initials,
  avatarColor } from
'../lib/data';
import { useAppData } from '../lib/data-context';
import type { Agent } from '../lib/api';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { Pagination } from '../components/Pagination';
import { PAGE_SIZE, useClientPagination } from '../lib/useClientPagination';

interface DashboardPageProps {
  setActive: (page: string) => void;
  setSelectedAgent: (agent: Agent) => void;
}
export function DashboardPage({
  setActive,
  setSelectedAgent
}: DashboardPageProps) {
  const { user } = useAuth();
  const { agents, alerts, visits, floatTrend, stats, dismissAlert, adrMyPerformance } =
    useAppData();
  const networkFloat = agents.reduce((s, a) => s + a.efloat + a.cash, 0);
  const activeCount = stats?.activeCount ?? agents.filter((a) => a.status === 'active').length;
  const alertCount = stats?.alertCount ?? alerts.length;
  const totalAgents = stats?.totalAgents ?? agents.length;
  const statusCounts = stats?.statusCounts ?? {};
  const visitsToday = stats?.visitsToday ?? {};
  const floatData = floatTrend ?? { labels: [], efloat: [], cash: [] };

  const {
    pageItems: pageVisits,
    total: dashVisitTotal,
    limit: dashVisitLimit,
    offset: dashVisitOffset,
    setOffset: setDashVisitOffset
  } = useClientPagination(visits, PAGE_SIZE.compact);

  const {
    pageItems: pageAlerts,
    total: dashAlertTotal,
    limit: dashAlertLimit,
    offset: dashAlertOffset,
    setOffset: setDashAlertOffset
  } = useClientPagination(alerts, PAGE_SIZE.compact);

  const agentsAddedSub =
    (stats?.agentsAddedThisMonth ?? 0) > 0
      ? `↑ ${stats!.agentsAddedThisMonth} added this month`
      : 'No new agents this month';

  const activitySub =
    stats?.activityRate != null
      ? `${stats.activityRate}% activity rate`
      : totalAgents > 0
        ? `${Math.round((activeCount / totalAgents) * 100)}% activity rate`
        : 'No agents yet';

  const floatSub = (() => {
    const pct = stats?.floatChangePct;
    if (pct == null) return 'Network float today';
    if (pct === 0) return 'Unchanged vs yesterday';
    return `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs yesterday`;
  })();

  const floatSubColor =
    stats?.floatChangePct != null && stats.floatChangePct < 0
      ? 'text-apsAmber'
      : 'text-apsGreen';

  const alertsSub = (() => {
    const critical = stats?.alertsCritical ?? alerts.filter((a) => a.type === 'critical').length;
    const warning = stats?.alertsWarning ?? alerts.filter((a) => a.type === 'warning').length;
    if (critical === 0 && warning === 0) return alertCount ? `${alertCount} open` : 'All clear';
    return `${critical} critical · ${warning} warnings`;
  })();
  return (
    <div className="page-pad">
      {user?.role === 'adr' && adrMyPerformance && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm mb-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Your performance this month
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {adrMyPerformance.visits_done}/{adrMyPerformance.visit_target}
              </div>
              <div className="text-xs text-slate-500">Visits completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {adrMyPerformance.agents}
              </div>
              <div className="text-xs text-slate-500">Agents assigned</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {adrMyPerformance.kyc_rate}%
              </div>
              <div className="text-xs text-slate-500">KYC verified</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-apsBlue">
                {adrMyPerformance.score}%
              </div>
              <div className="text-xs text-slate-500">Overall score</div>
              <ProgressBar
                value={adrMyPerformance.score}
                color={
                  adrMyPerformance.score >= 80
                    ? 'bg-apsGreen'
                    : adrMyPerformance.score >= 60
                      ? 'bg-apsAmber'
                      : 'bg-apsRed'
                }
                height="h-1.5"
              />
            </div>
          </div>
        </div>
      )}
      {/* Metrics */}
      <div className="metric-grid mb-6">
        <MetricCard
          animDelay={0}
          label="Total agents"
          value={String(totalAgents)}
          sub={agentsAddedSub}
          subColor="text-apsGreen"
          icon={<Users className="w-5 h-5" />}
          accent="#1565C0"
          onClick={() => setActive('agents')} />
        
        <MetricCard
          animDelay={80}
          label="Active today"
          value={activeCount}
          sub={activitySub}
          icon={<TrendingUp className="w-5 h-5" />}
          accent="#00897B"
          onClick={() => setActive('agents')} />
        
        <MetricCard
          animDelay={160}
          label="Network float"
          value={fmt(networkFloat)}
          sub={floatSub}
          subColor={floatSubColor}
          icon={<Wallet className="w-5 h-5" />}
          accent="#F59E0B"
          onClick={() => setActive('float')} />
        
        <MetricCard
          animDelay={240}
          label="Active alerts"
          value={alertCount}
          sub={alertsSub}
          subColor="text-apsRed"
          icon={<AlertCircle className="w-5 h-5" />}
          accent="#EF4444"
          onClick={() => setActive('compliance')} />
        
      </div>

      {/* Charts row */}
      <div className="metric-grid-3 mb-5">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Float trend — last 7 days
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                E-float vs cash across all agents
              </p>
            </div>
            <div className="flex gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-5 h-0.5 bg-apsBlue" />
                E-float
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-0.5 bg-apsTeal"
                  style={{
                    backgroundImage:
                    'repeating-linear-gradient(to right, #00897B 0, #00897B 4px, transparent 4px, transparent 7px)'
                  }} />
                
                Cash
              </div>
            </div>
          </div>
          <FloatTrendChart data={floatData} />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col items-center">
          <h3 className="text-sm font-semibold text-slate-900 w-full mb-4">
            Agent status
          </h3>
          <DonutChart
            data={[
            {
              value: statusCounts.active ?? activeCount,
              color: '#22C55E',
              label: 'Active'
            },
            {
              value: statusCounts.low_float ?? 0,
              color: '#F59E0B',
              label: 'Low float'
            },
            {
              value: statusCounts.critical ?? 0,
              color: '#EF4444',
              label: 'Critical'
            },
            {
              value: statusCounts.suspended ?? 0,
              color: '#94A3B8',
              label: 'Suspended'
            }]
            } />
          
          <div className="grid grid-cols-2 gap-2 w-full mt-4">
            {[
            ['Active', statusCounts.active ?? activeCount, '#22C55E'],
            ['Low float', statusCounts.low_float ?? 0, '#F59E0B'],
            ['Critical', statusCounts.critical ?? 0, '#EF4444'],
            ['Suspended', statusCounts.suspended ?? 0, '#94A3B8']].
            map(([label, value, color]) =>
            <div key={label as string} className="flex items-center gap-2">
                <div
                className="w-2 h-2 rounded-sm shrink-0"
                style={{
                  backgroundColor: color as string
                }} />
              
                <span className="text-xs text-slate-500">
                  {label} <b className="text-slate-900">{value}</b>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="metric-grid-3">
        {/* Top agents */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Top agents by float
            </h3>
            <button
              onClick={() => setActive('agents')}
              className="text-xs text-apsBlue hover:text-apsBlueMid font-medium">
              
              View all →
            </button>
          </div>
          {[...agents].sort((a, b) => b.efloat - a.efloat).slice(0, 5).map((agent) => {
            const fc =
            agent.efloat < 5000 ?
            'bg-apsRed' :
            agent.efloat < 20000 ?
            'bg-apsAmber' :
            'bg-apsTeal';
            const avatarColors = avatarColor(agent.name);
            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded transition-colors">
                
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                    avatarColors.bg,
                    avatarColors.text
                  )}>
                  
                  {initials(agent.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-900 truncate">
                    {agent.name}
                  </div>
                  <div className="text-[10px] text-slate-500">{agent.zone}</div>
                </div>
                <div className="text-right">
                  <div
                    className={cn(
                      'text-xs font-semibold',
                      agent.efloat < 5000 ?
                      'text-apsRed' :
                      agent.efloat < 20000 ?
                      'text-apsAmber' :
                      'text-apsTeal'
                    )}>
                    
                    {fmt(agent.efloat)}
                  </div>
                  <div className="w-14 mt-1">
                    <ProgressBar
                      value={Math.min(
                        100,
                        Math.round(agent.efloat / 100000 * 100)
                      )}
                      color={fc}
                      height="h-1" />
                    
                  </div>
                </div>
              </div>);

          })}
        </div>

        {/* Alerts */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Active alerts
          </h3>
          {pageAlerts.map((a) => (
            <AlertItem key={a.id ?? a.title} alert={a} onDismiss={dismissAlert} />
          ))}
          <Pagination
            total={dashAlertTotal}
            limit={dashAlertLimit}
            offset={dashAlertOffset}
            onPageChange={setDashAlertOffset}
          />
        </div>

        {/* Visits today */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Today's visits
            </h3>
            <div className="flex gap-3">
              {[
              ['Done', visitsToday.done ?? 0, 'text-apsGreen'],
              ['Pending', visitsToday.pending ?? 0, 'text-apsAmber'],
              ['Missed', visitsToday.missed ?? 0, 'text-apsRed']].
              map(([label, value, color]) =>
              <div key={label as string} className="text-center">
                  <div className={cn('text-base font-bold', color as string)}>
                    {value}
                  </div>
                  <div className="text-[10px] text-slate-500">{label}</div>
                </div>
              )}
            </div>
          </div>
          {pageVisits.map((v, i) => {
            const statusConfig = {
              done: {
                icon: '✓',
                color: 'text-apsGreen'
              },
              pending: {
                icon: '○',
                color: 'text-apsAmber'
              },
              missed: {
                icon: '✕',
                color: 'text-apsRed'
              }
            }[v.status];
            return (
              <div
                key={v.id ?? `${v.agent}-${v.time}-${i}`}
                className="flex gap-3 py-2 border-b border-slate-100 last:border-0">
                
                <div
                  className={cn(
                    'text-sm font-bold shrink-0 mt-0.5',
                    statusConfig?.color
                  )}>
                  
                  {statusConfig?.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-900">
                    {v.agent}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {v.officer} · {v.type}
                  </div>
                </div>
                <div
                  className={cn('text-[10px] font-medium', statusConfig?.color)}>
                  
                  {v.time}
                </div>
              </div>);

          })}
          <Pagination
            total={dashVisitTotal}
            limit={dashVisitLimit}
            offset={dashVisitOffset}
            onPageChange={setDashVisitOffset}
          />
        </div>
      </div>
    </div>);

}