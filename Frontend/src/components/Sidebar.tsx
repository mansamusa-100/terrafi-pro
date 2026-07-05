import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { navFor, ROLE_META } from '../lib/rbac';
import { BrandMark } from './BrandMark';

interface SidebarProps {
  active: string;
  setActive: (id: string) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function userInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2);
}

export function Sidebar({
  active,
  setActive,
  collapsed,
  setCollapsed,
  mobileOpen,
  onMobileClose
}: SidebarProps) {
  const { user } = useAuth();
  if (!user) return null;
  const nav = navFor(user.role);
  const meta = ROLE_META[user.role];
  const branding =
    user.branding ??
    ({
      title: user.company || 'Field-Pro',
      subtitle: 'Agent Network',
      logo_url: null
    } as const);

  const handleNav = (id: string) => {
    setActive(id);
    onMobileClose();
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          'bg-navy flex flex-col overflow-hidden shrink-0 z-50',
          'fixed inset-y-0 left-0 w-[min(18rem,85vw)] transition-transform duration-300 ease-in-out',
          'lg:relative lg:inset-auto lg:translate-x-0 lg:transition-[width]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'lg:w-16' : 'lg:w-60'
        )}>
        <div
          className="p-4 sm:p-5 pb-4 border-b border-white/10 flex items-center gap-3 select-none"
          onClick={() => {
            if (window.matchMedia('(min-width: 1024px)').matches) {
              setCollapsed(!collapsed);
            }
          }}>
          <BrandMark branding={branding} size="sm" />
          <div
            className={cn(
              'overflow-hidden flex-1 lg:block min-w-0',
              collapsed && 'lg:hidden'
            )}>
            <div
              className="text-white text-sm font-semibold tracking-wide truncate"
              title={branding.title}>
              {branding.title}
            </div>
            <div className="text-white/50 text-[10px] whitespace-nowrap mt-0.5 uppercase tracking-wider font-medium truncate">
              {branding.subtitle}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={(e) => {
              e.stopPropagation();
              onMobileClose();
            }}
            className="lg:hidden p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1 custom-scrollbar">
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            const badge = (item as { badge?: number }).badge;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg transition-colors relative group',
                  'py-2.5 px-3 justify-start',
                  'lg:py-2',
                  collapsed && 'lg:py-2.5 lg:justify-center lg:px-0',
                  isActive
                    ? 'bg-apsBlue/20 text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                )}>
                <Icon
                  className={cn(
                    'shrink-0 w-[18px] h-[18px]',
                    collapsed && 'lg:w-5 lg:h-5',
                    isActive
                      ? 'text-apsBlueLt'
                      : 'text-white/50 group-hover:text-white/80'
                  )}
                />
                <span
                  className={cn(
                    'text-[13px] font-medium whitespace-nowrap flex-1 text-left',
                    collapsed && 'lg:hidden'
                  )}>
                  {item.label}
                </span>
                {badge != null && (
                  <span
                    className={cn(
                      'bg-apsRed text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                      collapsed && 'lg:hidden'
                    )}>
                    {badge}
                  </span>
                )}
                {collapsed && badge != null && (
                  <span className="hidden lg:block absolute top-2 right-2 w-2 h-2 bg-apsRed rounded-full border border-navy" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-navyMid border border-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {userInitials(user.name)}
          </div>
          <div
            className={cn('overflow-hidden flex-1', collapsed && 'lg:hidden')}>
            <div className="text-white text-xs font-medium whitespace-nowrap truncate">
              {user.name}
            </div>
            <div className="text-white/40 text-[10px] whitespace-nowrap">
              {meta.label}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
