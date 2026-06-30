import React from 'react';
import { Shield, AlertCircle, UserX, CheckCircle } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { AlertItem } from '../components/AlertItem';
import { DonutChart } from '../components/charts/DonutChart';
import { useAppData } from '../lib/data-context';
export function CompliancePage() {
  const { alerts } = useAppData();
  return (
    <div className="page-pad">
      <div className="metric-grid mb-6">
        <MetricCard
          label="Open issues"
          value={String(alerts.length)}
          icon={<Shield className="w-5 h-5" />}
          accent="#EF4444" />
        
        <MetricCard
          label="KYC expired"
          value="4"
          sub="agents need renewal"
          icon={<AlertCircle className="w-5 h-5" />}
          accent="#F59E0B" />
        
        <MetricCard
          label="Suspended agents"
          value="7"
          sub="pending review"
          icon={<UserX className="w-5 h-5" />}
          accent="#64748B" />
        
        <MetricCard
          label="Fully compliant"
          value="289"
          sub="92.6% of network"
          icon={<CheckCircle className="w-5 h-5" />}
          accent="#22C55E" />
        
      </div>

      <div className="panel-grid-2">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Active compliance issues
          </h3>
          {alerts.map((a, i) =>
          <AlertItem key={i} alert={a} />
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            KYC status overview
          </h3>
          <div className="flex justify-center mb-4">
            <DonutChart
              data={[
              {
                value: 289,
                color: '#22C55E',
                label: 'Verified'
              },
              {
                value: 15,
                color: '#F59E0B',
                label: 'Pending renewal'
              },
              {
                value: 8,
                color: '#EF4444',
                label: 'Expired'
              }]
              } />
            
          </div>
          <div className="space-y-2">
            {[
            ['Verified', 289, '#22C55E'],
            ['Pending renewal', 15, '#F59E0B'],
            ['Expired / action needed', 8, '#EF4444']].
            map(([label, value, color]) =>
            <div
              key={label as string}
              className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50">
              
                <div className="flex items-center gap-2">
                  <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{
                    backgroundColor: color as string
                  }} />
                
                  <span className="text-xs text-slate-900">{label}</span>
                </div>
                <span
                className="text-xs font-semibold"
                style={{
                  color: color as string
                }}>
                
                  {value}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>);

}