import React, { useEffect, useState, useRef } from 'react';
import { Search, Bell, ChevronDown, LogOut, Repeat, Check, Menu } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ROLE_META } from '../lib/rbac';
import { api, DemoUser } from '../lib/api';
import { cn } from '../lib/utils';

interface TopbarProps {
  page: string;
  searchQ: string;
  setSearchQ: (q: string) => void;
  onMenuClick: () => void;
}

const TITLES: Record<string, string> = {
  dashboard: 'Network Overview',
  companies: 'Companies',
  agents: 'Agent Directory',
  map: 'Network Map',
  visits: 'Field Visits',
  float: 'Float Monitor',
  'float-sync': 'Float sync log',
  performance: 'Performance',
  training: 'Training',
  compliance: 'Compliance',
  users: 'Users & Roles',
  audit: 'Audit log',
  settings: 'Settings'
};

export function Topbar({ page, searchQ, setSearchQ, onMenuClick }: TopbarProps) {
  const { user, logout, switchRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const showAgentSearch = page === 'agents';

  useEffect(() => {
    api.demoUsers().then(setDemoUsers).catch(() => {});
  }, []);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [page]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;
  const meta = ROLE_META[user.role];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shrink-0 shadow-sm">
      <div className="h-14 sm:h-16 flex items-center px-3 sm:px-6 gap-2 sm:gap-4">
        <button
          type="button"
          aria-label="Open menu"
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight truncate">
            {TITLES[page] || 'Dashboard'}
          </h1>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5 font-medium truncate">
            {user.company} · {meta.label}
          </div>
        </div>

        {showAgentSearch && (
          <button
            type="button"
            aria-label="Search agents"
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <Search className="w-5 h-5" />
          </button>
        )}

        <div className="hidden md:flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 gap-2 w-48 lg:w-64 focus-within:border-apsBlue focus-within:ring-1 focus-within:ring-apsBlue/20 transition-all">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={
              showAgentSearch
                ? 'Search agents…'
                : 'Search…'
            }
            className="bg-transparent border-none outline-none text-sm text-slate-800 w-full min-w-0 placeholder:text-slate-400"
          />
        </div>

        <div className="relative hidden sm:block">
          <button
            type="button"
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <span className="absolute top-2 right-2 w-2 h-2 bg-apsRed rounded-full border-2 border-white" />
        </div>

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 sm:gap-2 pl-1 pr-1 sm:pr-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
            <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-xs font-bold text-white">
              {user.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)}
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-[min(16rem,calc(100vw-1.5rem))] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-40">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {user.name}
                </div>
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
              </div>

              <div className="py-2 max-h-48 overflow-y-auto">
                <div className="px-4 pb-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <Repeat className="w-3 h-3" />
                  Switch role
                </div>
                {demoUsers.map((demo) => {
                  const rm = ROLE_META[demo.role];
                  const isCurrent = demo.email === user.email;
                  return (
                    <button
                      key={demo.email}
                      type="button"
                      onClick={() => {
                        switchRole(demo.email);
                        setOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-2 text-left hover:bg-slate-50 transition-colors',
                        isCurrent && 'bg-slate-50'
                      )}>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-900 truncate">
                          {rm.label}
                        </div>
                        <div className="text-[10px] text-slate-500">{rm.level}</div>
                      </div>
                      {isCurrent && (
                        <Check className="w-4 h-4 text-apsBlue shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-apsRed border-t border-slate-100 hover:bg-apsRedLt/40 transition-colors">
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {showAgentSearch && mobileSearchOpen && (
        <div className="md:hidden px-3 pb-3 border-t border-slate-100 pt-2">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              autoFocus
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search agents by name, ID, zone…"
              className="bg-transparent border-none outline-none text-sm text-slate-800 w-full min-w-0 placeholder:text-slate-400"
            />
          </div>
        </div>
      )}
    </header>
  );
}
