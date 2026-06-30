import React, { useState } from 'react';
import {
  Wallet,
  Banknote,
  AlertTriangle,
  Siren,
  ArrowUpDown
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { BarChart } from '../components/charts/BarChart';
import { FloatTrendChart } from '../components/charts/FloatTrendChart';
import { ProgressBar } from '../components/ProgressBar';
import { fmt } from '../lib/data';
import { useAppData } from '../lib/data-context';
import { cn } from '../lib/utils';
import { DataTable } from '../components/DataTable';

export function FloatPage() {
  const { agents, zones, floatTrend } = useAppData();
  const floatData = floatTrend ?? { labels: [], efloat: [], cash: [] };
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const zoneFloat = zones
    .map((zone) => ({
      zone,
      total: agents
        .filter((a) => a.zone === zone)
        .reduce((s, a) => s + a.efloat + a.cash, 0)
    }))
    .filter((z) => z.total > 0)
    .sort((a, b) => b.total - a.total);

  const sortedAgents = [...agents]
    .map((a) => ({
      ...a,
      total: a.efloat + a.cash
    }))
    .sort((a, b) => {
      if (!sortConfig) return b.total - a.total;
      const { key, direction } = sortConfig;
      // @ts-expect-error dynamic sort key
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      // @ts-expect-error dynamic sort key
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
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

  const columns: [string, string, boolean][] = [
    ['name', 'Agent', true],
    ['zone', 'Zone', true],
    ['efloat', 'E-float', true],
    ['cash', 'Cash', true],
    ['', 'Float level', false]
  ];

  return (
    <div className="page-pad">
      <div className="metric-grid mb-6">
        <MetricCard
          label="Total e-float"
          value={fmt(agents.reduce((s, a) => s + a.efloat, 0))}
          icon={<Wallet className="w-5 h-5" />}
          accent="#1565C0"
        />
        <MetricCard
          label="Total cash float"
          value={fmt(agents.reduce((s, a) => s + a.cash, 0))}
          icon={<Banknote className="w-5 h-5" />}
          accent="#00897B"
        />
        <MetricCard
          label="Low float agents"
          value={agents.filter((a) => a.efloat < 20000).length}
          icon={<AlertTriangle className="w-5 h-5" />}
          accent="#F59E0B"
        />
        <MetricCard
          label="Critical (<D5K)"
          value={agents.filter((a) => a.efloat < 5000).length}
          icon={<Siren className="w-5 h-5" />}
          accent="#EF4444"
        />
      </div>

      <div className="panel-grid-2 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Float by zone</h3>
          <BarChart
            labels={zoneFloat.map((z) => z.zone.split(' ')[0])}
            values={zoneFloat.map((z) => Math.round(z.total / 1000))}
            color="#00897B"
          />
          <div className="text-[10px] text-slate-500 text-center mt-2">
            Values in D thousands
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Float trend (7 days)
          </h3>
          <FloatTrendChart data={floatData} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          All agents — float status
        </h3>
        <DataTable minWidth="520px">
          <div className="grid grid-cols-5 gap-2 border-b border-slate-200 pb-2 mb-2">
            {columns.map(([key, label, sortable]) => (
              <div
                key={label}
                onClick={() => sortable && requestSort(key)}
                className={cn(
                  'text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1',
                  sortable && 'cursor-pointer hover:text-slate-900'
                )}>
                {label}
                {sortable && <ArrowUpDown className="w-3 h-3 opacity-50" />}
              </div>
            ))}
          </div>
          {sortedAgents.map((a) => {
            const fc =
              a.efloat < 5000
                ? 'text-apsRed'
                : a.efloat < 20000
                  ? 'text-apsAmber'
                  : 'text-apsGreen';
            const fbg =
              a.efloat < 5000
                ? 'bg-apsRed'
                : a.efloat < 20000
                  ? 'bg-apsAmber'
                  : 'bg-apsGreen';
            const p = Math.min(100, Math.round(a.efloat / 100000 * 100));
            return (
              <div
                key={a.id}
                className="grid grid-cols-5 gap-2 py-2.5 border-b border-slate-100 last:border-0 items-center">
                <div className="text-xs font-medium text-slate-900">{a.name}</div>
                <div className="text-xs text-slate-500">{a.zone}</div>
                <div className={cn('text-xs font-bold', fc)}>{fmt(a.efloat)}</div>
                <div className="text-xs text-slate-500">{fmt(a.cash)}</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ProgressBar value={p} color={fbg} height="h-1.5" />
                  </div>
                  <span className={cn('text-[10px] font-bold w-8', fc)}>{p}%</span>
                </div>
              </div>
            );
          })}
        </DataTable>
      </div>
    </div>
  );
}
