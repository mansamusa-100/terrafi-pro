import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { cn } from '../lib/utils';

export type FieldBarItem = {
  id: string;
  icon: LucideIcon;
  label: string;
  /** When set, used instead of `active === id` to mark the tab active. */
  isActive?: (page: string) => boolean;
};

interface MobileFieldBarProps {
  active: string;
  setActive: (page: string) => void;
  items: readonly FieldBarItem[];
  fab?: {
    onClick: () => void;
    ariaLabel: string;
  };
  ariaLabel?: string;
}

export function MobileFieldBar({
  active,
  setActive,
  items,
  fab,
  ariaLabel = 'Field navigation'
}: MobileFieldBarProps) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      aria-label={ariaLabel}>
      <div className="flex items-stretch h-16 max-w-lg mx-auto relative">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.isActive?.(active) ?? active === item.id;
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
        {fab && (
          <button
            type="button"
            aria-label={fab.ariaLabel}
            onClick={fab.onClick}
            className="absolute left-1/2 -translate-x-1/2 -top-5 w-14 h-14 rounded-full bg-apsBlue text-white shadow-lg flex items-center justify-center hover:bg-apsBlueMid active:scale-95 transition-transform">
            <Plus className="w-7 h-7" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </nav>
  );
}
