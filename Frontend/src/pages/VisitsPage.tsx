import React, { useMemo, useState } from 'react';
import {
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowUpDown,
  Plus,
  CalendarPlus } from
'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { BarChart } from '../components/charts/BarChart';
import { ProgressBar } from '../components/ProgressBar';
import { VisitLogModal } from '../components/VisitLogModal';
import { useAppData } from '../lib/data-context';
import { DataTable } from '../components/DataTable';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
export function VisitsPage() {
  const { user } = useAuth();
  const { visits, officers, logVisit } = useAppData();
  const canLog = user ? can(user.role, 'logVisit') : false;
  const canSchedule = user ? can(user.role, 'scheduleVisit') : false;
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const weeks = ['W22', 'W23', 'W24', 'W25', 'W26', 'W27', 'W28'];
  const weeklyVisits = [87, 94, 78, 102, 98, 88, 91];
  const sortedVisits = useMemo(() => {
    const data = [...visits];
    if (sortConfig) {
      const { key, direction } = sortConfig;
      data.sort((a, b) => {
        // @ts-ignore
        if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
        // @ts-ignore
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
    sortConfig.direction === 'asc')
    {
      direction = 'desc';
    }
    setSortConfig({
      key,
      direction
    });
  };
  const columns: [string, string, boolean][] = [
  ['agent', 'Agent', true],
  ['zone', 'Zone', true],
  ['officer', 'Officer', true],
  ['type', 'Type', true],
  ['time', 'Time', true],
  ['status', 'Status', true]];

  return (
    <div className="page-pad">
      {/* Header actions */}
      {(canSchedule || canLog) &&
      <div className="flex items-center justify-end gap-2 mb-5">
          {canSchedule &&
        <button
          onClick={() =>
          toast.info('Schedule a visit', {
            description:
            'Assign agents to a field officer with a target date'
          })
          }
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-slate-300 transition-colors">
          
              <CalendarPlus className="w-4 h-4 text-slate-400" />
              Schedule visit
            </button>
        }
          {canLog &&
        <button
          onClick={() => setLogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-apsBlue text-white text-sm font-medium hover:bg-apsBlueMid transition-colors">
          
              <Plus className="w-4 h-4" />
              Log visit
            </button>
        }
        </div>
      }

      <div className="metric-grid mb-6">
        <MetricCard
          label="Total visits (month)"
          value="274"
          sub="100% vs target"
          icon={<MapPin className="w-5 h-5" />}
          accent="#1565C0" />
        
        <MetricCard
          label="Completed today"
          value="18"
          sub="of 27 scheduled"
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="#00897B" />
        
        <MetricCard
          label="Pending today"
          value="7"
          sub="due by 6pm"
          icon={<Clock className="w-5 h-5" />}
          accent="#F59E0B" />
        
        <MetricCard
          label="Missed today"
          value="2"
          sub="need rescheduling"
          icon={<XCircle className="w-5 h-5" />}
          accent="#EF4444" />
        
      </div>

      <div className="metric-grid-3 mb-5">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Weekly visit volume
          </h3>
          <BarChart labels={weeks} values={weeklyVisits} color="#1565C0" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Completion rate
          </h3>
          <div className="space-y-4">
            {officers.map((o) => {
              const colorClass =
              o.score >= 80 ?
              'bg-apsGreen' :
              o.score >= 60 ?
              'bg-apsAmber' :
              'bg-apsRed';
              const textColorClass =
              o.score >= 80 ?
              'text-apsGreen' :
              o.score >= 60 ?
              'text-apsAmber' :
              'text-apsRed';
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
                  <ProgressBar
                    value={o.score}
                    color={colorClass}
                    height="h-2" />
                  
                </div>);

            })}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          Today's visit log
        </h3>
        <DataTable minWidth="720px">
        <div className="grid grid-cols-6 gap-4 pb-3 mb-3 border-b border-slate-200">
          {columns.map(([key, label]) =>
          <div
            key={label}
            onClick={() => requestSort(key)}
            className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:text-slate-900">
            
              {label}
              <ArrowUpDown className="w-3 h-3 opacity-50" />
            </div>
          )}
        </div>
        {sortedVisits.map((v, i) => {
          const sc = {
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
            }
          }[v.status];
          return (
            <div
              key={i}
              className="grid grid-cols-6 gap-4 py-3 border-b border-slate-100 last:border-0 items-center hover:bg-slate-50 -mx-2 px-2 rounded transition-colors">
              
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
            </div>);

        })}
        </DataTable>
      </div>

      <VisitLogModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSubmit={logVisit} />
    </div>);

}