import React from 'react';
import {
  CheckCircle2,
  MapPin,
  User,
  Hash,
  Shield,
  Store,
  Phone
} from 'lucide-react';
import type { Agent } from '../lib/api';
import { useAuth } from '../lib/auth';
import { initials, avatarColor } from '../lib/data';
import { cn } from '../lib/utils';

interface AgentCreatedSuccessProps {
  agent: Agent;
  onDone: () => void;
  onRegisterAnother: () => void;
}

function telHref(phone: string) {
  return `tel:${phone.replace(/\s/g, '')}`;
}

export function AgentCreatedSuccess({
  agent,
  onDone,
  onRegisterAnother
}: AgentCreatedSuccessProps) {
  const { user } = useAuth();
  const networkName = user?.branding?.title ?? user?.company ?? 'your company';
  const ac = avatarColor(agent.name);

  return (
    <div className="flex flex-col items-center text-center py-4 px-2">
      {agent.location_photo_url && (
        <div className="w-full mb-5 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <img
            src={agent.location_photo_url}
            alt={`${agent.outlet_name || agent.name} location`}
            className="w-full h-44 object-cover"
          />
        </div>
      )}

      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-apsGreenLt flex items-center justify-center ring-4 ring-apsGreen/20">
          <CheckCircle2 className="w-10 h-10 text-apsGreen" strokeWidth={2.5} />
        </div>
        <div
          className={cn(
            'absolute -bottom-1 -right-1 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-md border-2 border-white',
            ac.bg,
            ac.text
          )}>
          {initials(agent.name)}
        </div>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
        Congratulations!
      </h2>
      <p className="text-slate-600 text-sm mt-2 max-w-sm leading-relaxed">
        <span className="font-semibold text-slate-900">{agent.name}</span> has
        been registered on the {networkName} agent network.
      </p>

      <div className="w-full mt-6 rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-100 text-left">
        <div className="flex items-center gap-3 px-4 py-3">
          <Hash className="w-4 h-4 text-slate-400 shrink-0" />
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Agent ID
            </div>
            <div className="text-sm font-semibold text-slate-900">{agent.id}</div>
          </div>
        </div>
        {agent.outlet_name && (
          <div className="flex items-center gap-3 px-4 py-3">
            <Store className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Outlet
              </div>
              <div className="text-sm font-medium text-slate-900">{agent.outlet_name}</div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-3">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Zone · Town
            </div>
            <div className="text-sm font-medium text-slate-900">
              {agent.zone}
              {agent.town_village ? ` · ${agent.town_village}` : ''}
            </div>
          </div>
        </div>
        {agent.personal_phone && (
          <div className="flex items-center gap-3 px-4 py-3">
            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Personal contact
              </div>
              <a
                href={telHref(agent.personal_phone)}
                className="text-sm font-medium text-apsBlue hover:underline">
                {agent.personal_phone}
              </a>
            </div>
          </div>
        )}
        {agent.officer && agent.officer !== 'Unassigned' && (
          <div className="flex items-center gap-3 px-4 py-3">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Field officer
              </div>
              <div className="text-sm font-medium text-slate-900">
                {agent.officer}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 w-full">
        <Shield className="w-4 h-4 shrink-0 text-amber-600" />
        <span className="text-left">
          KYC documents submitted — pending manager review before full activation.
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full mt-6">
        <button
          type="button"
          onClick={onRegisterAnother}
          className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          Register another
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex-1 py-2.5 rounded-lg bg-apsBlue text-white text-sm font-semibold hover:bg-apsBlueMid transition-colors">
          Done
        </button>
      </div>
    </div>
  );
}
