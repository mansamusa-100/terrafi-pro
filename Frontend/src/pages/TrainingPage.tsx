import React from 'react';
import { GraduationCap, Users, TrendingUp, CheckCircle } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { pct, initials, avatarColor } from '../lib/data';
import { useAppData } from '../lib/data-context';
import { cn } from '../lib/utils';
export function TrainingPage() {
  const { agents, training } = useAppData();
  const totalCompleted = training.reduce((s, t) => s + t.completed, 0);
  const totalAssigned = training.reduce((s, t) => s + t.assigned, 0);
  const avgCompletion = totalAssigned ? Math.round(totalCompleted / totalAssigned * 100) : 0;
  const totalPassing = training.reduce((s, t) => s + t.passing, 0);
  const avgPassRate = totalCompleted ? Math.round(totalPassing / totalCompleted * 100) : 0;
  return (
    <div className="page-pad">
      <div className="metric-grid mb-6">
        <MetricCard
          label="Modules active"
          value={String(training.length)}
          icon={<GraduationCap className="w-5 h-5" />}
          accent="#1565C0" />
        
        <MetricCard
          label="Agents enrolled"
          value="312"
          sub="100% of network"
          icon={<Users className="w-5 h-5" />}
          accent="#00897B" />
        
        <MetricCard
          label="Avg. completion"
          value={`${avgCompletion}%`}
          sub="across all modules"
          icon={<TrendingUp className="w-5 h-5" />}
          accent="#F59E0B" />
        
        <MetricCard
          label="Avg. pass rate"
          value={`${avgPassRate}%`}
          sub="of completions"
          icon={<CheckCircle className="w-5 h-5" />}
          accent="#22C55E" />
        
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-5">
          Training module progress
        </h3>
        {training.map((t, i) => {
          const comp = pct(t.completed, t.assigned);
          const pass = pct(t.passing, t.assigned);
          return (
            <div
              key={i}
              className="mb-5 pb-5 border-b border-slate-100 last:border-0 last:mb-0 last:pb-0">
              
              <div className="flex justify-between mb-3">
                <h4 className="text-sm font-medium text-slate-900">
                  {t.title}
                </h4>
                <div className="flex gap-4 text-xs">
                  <span className="text-slate-500">
                    Completed: <b className="text-apsBlue">{comp}%</b>
                  </span>
                  <span className="text-slate-500">
                    Passing: <b className="text-apsGreen">{pass}%</b>
                  </span>
                </div>
              </div>
              <div className="relative mb-1">
                <ProgressBar value={comp} color="bg-apsBlue/30" height="h-3" />
                <div className="absolute top-0 left-0 right-0">
                  <ProgressBar value={pass} color="bg-apsBlue" height="h-3" />
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>
                  {t.completed} completed · {t.passing} passed ·{' '}
                  {t.assigned - t.completed} not started
                </span>
                <span>{t.assigned} enrolled</span>
              </div>
            </div>);

        })}
      </div>

      <div className="panel-grid-2">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Agents needing training
          </h3>
          {agents.filter((a) => a.score < 70).
          slice(0, 5).
          map((a, i) => {
            const ac = avatarColor(a.name);
            return (
              <div
                key={i}
                className="flex gap-3 items-center py-2.5 border-b border-slate-100 last:border-0">
                
                  <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                    ac.bg,
                    ac.text
                  )}>
                  
                    {initials(a.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-900">
                      {a.name}
                    </div>
                    <div className="text-[11px] text-slate-500">{a.zone}</div>
                  </div>
                  <span className="bg-apsRedLt text-apsRed border border-apsRed/20 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    {a.score}%
                  </span>
                </div>);

          })}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Top performing agents
          </h3>
          {agents.filter((a) => a.score >= 80).
          sort((a, b) => b.score - a.score).
          slice(0, 5).
          map((a, i) => {
            const ac = avatarColor(a.name);
            return (
              <div
                key={i}
                className="flex gap-3 items-center py-2.5 border-b border-slate-100 last:border-0">
                
                  <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                    ac.bg,
                    ac.text
                  )}>
                  
                    {initials(a.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-900">
                      {a.name}
                    </div>
                    <div className="text-[11px] text-slate-500">{a.zone}</div>
                  </div>
                  <span className="bg-apsGreenLt text-apsTeal border border-apsGreen/20 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    {a.score}%
                  </span>
                </div>);

          })}
        </div>
      </div>
    </div>);

}