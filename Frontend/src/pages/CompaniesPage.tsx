import React from 'react';
import { Building2, Users, UserCog, DollarSign } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { useAppData } from '../lib/data-context';
import { DataTable } from '../components/DataTable';

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-apsGreenLt text-apsGreen border-apsGreen/20',
  suspended: 'bg-apsRedLt text-apsRed border-apsRed/20'
};

export function CompaniesPage() {
  const { companies } = useAppData();
  const totalAgents = companies.reduce((s, c) => s + c.agents, 0);
  const activeCos = companies.filter((c) => c.status === 'active').length;
  const suspendedCos = companies.filter((c) => c.status === 'suspended').length;
  const mrr = companies.reduce((s, c) => s + c.mrr, 0);

  return (
    <div className="page-pad">
      <div className="metric-grid mb-6">
        <MetricCard
          label="Subscriber companies"
          value={companies.length}
          sub={`${activeCos} active${suspendedCos ? ` · ${suspendedCos} suspended` : ''}`}
          icon={<Building2 className="w-5 h-5" />}
          accent="#1565C0"
        />
        <MetricCard
          label="Total agents (platform)"
          value={totalAgents.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
          accent="#00897B"
        />
        <MetricCard
          label="Field officers"
          value={companies.reduce((s, c) => s + c.officers, 0)}
          icon={<UserCog className="w-5 h-5" />}
          accent="#F59E0B"
        />
        <MetricCard
          label="Monthly recurring rev."
          value={`$${mrr.toLocaleString()}`}
          sub="across active plans"
          subColor="text-apsGreen"
          icon={<DollarSign className="w-5 h-5" />}
          accent="#22C55E"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Subscriber companies
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Companies self-register — billing and subscriptions are handled
            separately
          </p>
        </div>

        <DataTable minWidth="720px">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 pb-3 mb-2 border-b border-slate-200">
          {['Company', 'Plan', 'Agents', 'Officers', 'MRR', 'Status'].map(
            (h) => (
              <div
                key={h}
                className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {h}
              </div>
            )
          )}
        </div>

        {companies.map((c) => (
          <div
            key={c.id}
            className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 py-3 border-b border-slate-100 last:border-0 items-center hover:bg-slate-50 -mx-2 px-2 rounded transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0">
                {c.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {c.name}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {c.contactEmail || `since ${c.since}`}
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-700 font-medium">{c.plan}</div>
            <div className="text-xs text-slate-700">
              {c.agents.toLocaleString()}
            </div>
            <div className="text-xs text-slate-700">{c.officers}</div>
            <div className="text-xs text-slate-700">
              {c.mrr ? `$${c.mrr.toLocaleString()}` : '—'}
            </div>
            <span
              className={cn(
                'text-[11px] font-semibold px-2.5 py-1 rounded-full border w-fit capitalize',
                STATUS_STYLE[c.status] || 'bg-slate-100 text-slate-600 border-slate-200'
              )}>
              {c.status}
            </span>
          </div>
        ))}
        </DataTable>
      </div>
    </div>
  );
}
