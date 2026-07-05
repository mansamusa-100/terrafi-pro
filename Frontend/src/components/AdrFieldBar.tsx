import React from 'react';
import { LayoutDashboard, Map, Users, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

interface AdrFieldBarProps {
  active: string;
  setActive: (page: string) => void;
  onLogVisit: () => void;
}

const ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
  { id: 'visits', icon: Map, label: 'Visits' },
  { id: 'agents', icon: Users, label: 'Agents' }
] as const;

export function AdrFieldBar({ active, setActive, onLogVisit }: AdrFieldBarProps) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
      aria-label="Field navigation">
      <div className="flex items-stretch h-16 max-w-lg mx-auto relative">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors',
                isActive ? 'text-apsBlue' : 'text-slate-500'
              )}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Log visit"
          onClick={onLogVisit}
          className="absolute left-1/2 -translate-x-1/2 -top-5 w-14 h-14 rounded-full bg-apsBlue text-white shadow-lg flex items-center justify-center hover:bg-apsBlueMid active:scale-95 transition-transform">
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </button>
      </div>
    </nav>
  );
}
