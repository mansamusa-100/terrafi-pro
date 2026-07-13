import React from 'react';
import { AlertCircle, UserX, CheckCircle, ClipboardList } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { AlertItem } from '../components/AlertItem';
import { DonutChart } from '../components/charts/DonutChart';
import { KycReviewQueue } from '../components/KycReviewQueue';
import { ExportButton } from '../components/ExportButton';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { api } from '../lib/api';

import type { Agent } from '../lib/api';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface CompliancePageProps {
  onOpenAgent?: (agent: Agent) => void;
}

export function CompliancePage({ onOpenAgent }: CompliancePageProps) {
  const { alerts, kycStats, kycReviewQueue, agents, dismissAlert } = useAppData();
  const { user } = useAuth();
  const canReview = user ? can(user.role, 'reviewKyc') : false;

  const openAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) onOpenAgent?.(agent);
  };

  const counts = kycStats?.counts ?? {
    verified: 0,
    pending: 0,
    incomplete: 0,
    expired: 0
  };
  const total = kycStats?.total ?? agents.length;
  const suspended =
    kycStats?.suspended ??
    agents.filter((a) => a.status === 'suspended').length;
  const complianceRate = kycStats?.complianceRate ?? 0;

  const chartData = [
    { value: counts.verified, color: '#22C55E', label: 'Verified' },
    { value: counts.pending, color: '#F59E0B', label: 'Awaiting review' },
    { value: counts.incomplete, color: '#94A3B8', label: 'Incomplete' },
    { value: counts.expired, color: '#EF4444', label: 'Expired' }
  ].filter((d) => d.value > 0);

  const chartLegend = [
    ['Verified', counts.verified, '#22C55E'],
    ['Awaiting review', counts.pending, '#F59E0B'],
    ['Incomplete docs', counts.incomplete, '#94A3B8'],
    ['Expired / rejected', counts.expired, '#EF4444']
  ] as const;

  return (
    <div className="page-pad">
      {user && can(user.role, 'exportData') && (
        <div className="flex justify-end mb-4">
          <ExportButton
            path={api.export.compliance()}
            filename={`compliance-${todayISO()}.csv`}
          />
        </div>
      )}
      <div className="metric-grid mb-6">
        <MetricCard
          label="Awaiting KYC review"
          value={String(kycReviewQueue.length)}
          sub={
            kycReviewQueue.length
              ? `${kycReviewQueue.length} in queue`
              : 'Queue is clear'
          }
          icon={<ClipboardList className="w-5 h-5" />}
          accent="#F59E0B"
        />
        <MetricCard
          label="KYC expired"
          value={String(counts.expired)}
          sub={
            counts.expired
              ? `${counts.expired} need renewal`
              : 'No expired KYC'
          }
          icon={<AlertCircle className="w-5 h-5" />}
          accent="#EF4444"
        />
        <MetricCard
          label="Suspended agents"
          value={String(suspended)}
          sub={
            suspended
              ? `${suspended} suspended`
              : 'None suspended'
          }
          icon={<UserX className="w-5 h-5" />}
          accent="#64748B"
        />
        <MetricCard
          label="Fully compliant"
          value={String(counts.verified)}
          sub={`${complianceRate}% of ${total} agents`}
          icon={<CheckCircle className="w-5 h-5" />}
          accent="#22C55E"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              KYC review queue
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {canReview
                ? 'Approve or reject agents with all required documents uploaded'
                : 'View-only — managers approve or reject submissions'}
            </p>
          </div>
          <span className="text-xs font-semibold text-apsAmber bg-apsAmberLt px-2.5 py-1 rounded-full">
            {kycReviewQueue.length} pending
          </span>
        </div>
        <KycReviewQueue onOpenAgent={openAgent} />
      </div>

      <div className="panel-grid-2">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Active compliance issues
          </h3>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No open alerts.</p>
          ) : (
            alerts.map((a) => (
              <AlertItem key={a.id ?? a.title} alert={a} onDismiss={dismissAlert} />
            ))
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            KYC status overview
          </h3>
          {chartData.length > 0 ? (
            <div className="flex justify-center mb-4">
              <DonutChart data={chartData} />
            </div>
          ) : (
            <div className="flex justify-center mb-4 py-8 text-sm text-slate-500">
              No agent KYC data yet
            </div>
          )}
          <div className="space-y-2">
            {chartLegend.map(([label, value, color]) => (
              <div
                key={label}
                className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-slate-900">{label}</span>
                </div>
                <span
                  className="text-xs font-semibold"
                  style={{ color }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
