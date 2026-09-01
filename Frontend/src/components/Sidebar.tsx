import React, { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { navFor, navGroupForPage, ROLE_META, type NavEntry } from '../lib/rbac';
import { useAppData } from '../lib/data-context';
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

function NavGroupItem({
  entry,
  active,
  collapsed,
  expanded,
  onToggle,
  onNavigate,
  badgeForPage
}: {
  entry: Extract<NavEntry, { kind: 'group' }>;
  active: string;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (id: string) => void;
  badgeForPage: (pageId: string) => number | undefined;
}) {
  const Icon = entry.icon;
  const childActive = entry.children.some((c) => c.id === active);
  const groupActive = childActive;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 rounded-lg transition-colors relative group',
          'py-2.5 px-3 justify-start',
          'lg:py-2',
          collapsed && 'lg:py-2.5 lg:justify-center lg:px-0',
          groupActive
            ? 'bg-apsBlue/20 text-white'
            : 'text-white/60 hover:bg-white/5 hover:text-white'
        )}>
        <Icon
          className={cn(
            'shrink-0 w-[18px] h-[18px]',
            collapsed && 'lg:w-5 lg:h-5',
            groupActive ? 'text-apsBlueLt' : 'text-white/50 group-hover:text-white/80'
          )}
        />
        <span
          className={cn(
            'text-[13px] font-medium whitespace-nowrap flex-1 text-left',
            collapsed && 'lg:hidden'
          )}>
          {entry.label}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 text-white/40 transition-transform',
            collapsed && 'lg:hidden',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {expanded && (
        <div
          className={cn(
            'mt-0.5 space-y-0.5',
            collapsed ? 'lg:hidden' : 'pl-3 ml-3 border-l border-white/10'
          )}>
          {entry.children.map((child) => {
            const isActive = active === child.id;
            const badge = badgeForPage(child.id);
            return (
              <button
                key={child.id}
                type="button"
                onClick={() => onNavigate(child.id)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg py-2 px-3 text-left transition-colors',
                  isActive
                    ? 'bg-apsBlue/15 text-white'
                    : 'text-white/55 hover:bg-white/5 hover:text-white'
                )}>
                <span className="text-[12px] font-medium flex-1 truncate">
                  {child.label}
                </span>
                {badge != null && (
                  <span className="bg-apsRed text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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
  const { agents, kycReviewQueue, stats } = useAppData();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const groupId = navGroupForPage(active);
    if (!groupId) return;
    setExpandedGroups((prev) => {
      if (prev.has(groupId)) return prev;
      const next = new Set(prev);
      next.add(groupId);
      return next;
    });
  }, [active]);

  if (!user) return null;
  const nav = user ? navFor(user) : [];
  const meta = ROLE_META[user.role];

  function navBadge(pageId: string): number | undefined {
    if (pageId === 'agents') {
      const n = stats?.totalAgents ?? agents.length;
      return n > 0 ? n : undefined;
    }
    if (pageId === 'compliance') {
      const n = kycReviewQueue.length;
      return n > 0 ? n : undefined;
    }
    return undefined;
  }

  const branding =
    user.branding ??
    ({
      title: user.company || 'Terrafi Pro',
      subtitle: 'Agent Network',
      logo_url: null
    } as const);

  const handleNav = (id: string) => {
    setActive(id);
    onMobileClose();
  };

  const toggleGroup = (groupId: string) => {
    if (collapsed && window.matchMedia('(min-width: 1024px)').matches) {
      setCollapsed(false);
    }
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          data-app-chrome
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        data-app-chrome
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
            if (item.kind === 'group') {
              return (
                <NavGroupItem
                  key={item.id}
                  entry={item}
                  active={active}
                  collapsed={collapsed}
                  expanded={expandedGroups.has(item.id)}
                  onToggle={() => toggleGroup(item.id)}
                  onNavigate={handleNav}
                  badgeForPage={navBadge}
                />
              );
            }

            const Icon = item.icon;
            const isActive = active === item.id;
            const badge = navBadge(item.id);
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
