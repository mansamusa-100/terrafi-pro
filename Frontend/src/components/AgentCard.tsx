import React from 'react';
import { STATUS_META, avatarColor, initials, fmt } from '../lib/data';
import { cn } from '../lib/utils';
import { ProgressBar } from './ProgressBar';
import type { Agent } from '../lib/api';
import { agentDistanceMeters, formatDistance } from '../lib/agent-distance';
import type { GeoCoords } from '../lib/geolocation';
import { GoVisitButton } from './GoVisitButton';
import { Navigation } from 'lucide-react';

interface AgentCardProps {
  agent: Agent;
  userCoords?: GeoCoords | null;
  onClick: (agent: Agent) => void;
}

export function AgentCard({ agent, userCoords = null, onClick }: AgentCardProps) {
  const s = STATUS_META[agent.status];
  const ac = avatarColor(agent.name);
  const floatPct = Math.min(100, Math.round(agent.efloat / 100000 * 100));
  const distance = agentDistanceMeters(agent, userCoords);

  let floatColorClass = 'text-apsGreen';
  let floatBgClass = 'bg-apsGreen';
  if (agent.efloat < 5000) {
    floatColorClass = 'text-apsRed';
    floatBgClass = 'bg-apsRed';
  } else if (agent.efloat < 20000) {
    floatColorClass = 'text-apsAmber';
    floatBgClass = 'bg-apsAmber';
  }

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:border-apsBlue hover:-translate-y-0.5 group"
      onClick={() => onClick(agent)}>
      {agent.location_photo_url && (
        <div className="h-24 overflow-hidden border-b border-slate-100">
          <img
            src={agent.location_photo_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
              ac.bg,
              ac.text
            )}>
            {initials(agent.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate group-hover:text-apsBlue transition-colors">
              {agent.outlet_name || agent.name}
            </div>
            {agent.outlet_name && (
              <div className="text-xs text-slate-600 truncate">{agent.name}</div>
            )}
            <div className="text-xs text-slate-500 mt-0.5 truncate">
              {agent.id} · {agent.zone}
              {agent.town_village ? ` · ${agent.town_village}` : ''}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap',
                s?.bg,
                s?.color
              )}>
              {s?.label}
            </span>
            {distance != null && (
              <span className="text-[10px] font-medium text-apsBlue flex items-center gap-0.5">
                <Navigation className="w-3 h-3" />
                {formatDistance(distance)}
              </span>
            )}
          </div>
        </div>

        <div className="mb-3">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="text-slate-500 font-medium">E-float</span>
            <span className={cn('font-bold', floatColorClass)}>{fmt(agent.efloat)}</span>
          </div>
          <ProgressBar value={floatPct} color={floatBgClass} height="h-1.5" />
        </div>

        <div className="flex justify-between items-center text-xs text-slate-500">
          <span>
            Score: <b className="text-slate-900">{agent.score}%</b>
          </span>
          <span>
            Visits: <b className="text-slate-900">{agent.visits}</b>
          </span>
          <span>
            Last: <b className="text-slate-900">{agent.last_visit ?? '—'}</b>
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100">
          <GoVisitButton agent={agent} variant="compact" fullWidth />
        </div>
      </div>
    </div>
  );
}
