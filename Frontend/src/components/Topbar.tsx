import React, { useEffect, useState, useRef } from 'react';
import {
  Search,
  ChevronDown,
  LogOut,
  Menu,
  Repeat,
  Check,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { ROLE_META, pageTitleFor } from '../lib/rbac';
import { api, ApiError, LoginWorkspace } from '../lib/api';
import { cn } from '../lib/utils';
import { NotificationBell } from './NotificationBell';
import type { Agent } from '../lib/api';

interface TopbarProps {
  page: string;
  searchQ: string;
  setSearchQ: (q: string) => void;
  onMenuClick: () => void;
  setPage: (page: string) => void;
  setSelectedAgent: (agent: Agent | null) => void;
}

export function Topbar({
  page,
  searchQ,
  setSearchQ,
  onMenuClick,
  setPage,
  setSelectedAgent
}: TopbarProps) {
  const { user, logout, switchWorkspace } = useAuth();
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<LoginWorkspace[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const showAgentSearch = page === 'agents';

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [page]);

  useEffect(() => {
    if (!open || !user) return;
    api
      .workspaces()
      .then((res) => setWorkspaces(res.workspaces))
      .catch(() => setWorkspaces([]));
  }, [open, user?.id]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;
  const meta = ROLE_META[user.role];
  const pageTitle = pageTitleFor(page, user.role);

  const canSwitch = workspaces.length > 1;

  const handleSwitch = async (userId: string) => {
    if (userId === user.id) return;
    setSwitchingId(userId);
    try {
      await switchWorkspace(userId);
      setOpen(false);
      toast.success('Workspace switched');
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not switch workspace'
      );
    } finally {
      setSwitchingId(null);
    }
  };

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
            {pageTitle}
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
            placeholder={showAgentSearch ? 'Search agents…' : 'Search…'}
            className="bg-transparent border-none outline-none text-sm text-slate-800 w-full min-w-0 placeholder:text-slate-400"
          />
        </div>

        <NotificationBell setPage={setPage} setSelectedAgent={setSelectedAgent} />

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
            <div className="absolute right-0 mt-2 w-[min(18rem,calc(100vw-1.5rem))] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-40">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {user.name}
                </div>
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {user.company} · {meta.label}
                </div>
              </div>

              {canSwitch && (
                <div className="py-2 border-b border-slate-100 max-h-56 overflow-y-auto">
                  <div className="px-4 pb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Repeat className="w-3 h-3" />
                    Switch workspace
                  </div>
                  {workspaces.map((ws) => {
                    const rm = ROLE_META[ws.role];
                    const isCurrent = ws.userId === user.id;
                    return (
                      <button
                        key={ws.userId}
                        type="button"
                        disabled={isCurrent || switchingId != null}
                        onClick={() => handleSwitch(ws.userId)}
                        className={cn(
                          'w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors',
                          isCurrent
                            ? 'bg-slate-50'
                            : 'hover:bg-slate-50 disabled:opacity-60'
                        )}>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {ws.companyName}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {rm?.label || ws.role}
                            {ws.status === 'invited' ? ' · set password first' : ''}
                          </div>
                        </div>
                        {switchingId === ws.userId ? (
                          <Loader2 className="w-4 h-4 animate-spin text-apsBlue shrink-0" />
                        ) : isCurrent ? (
                          <Check className="w-4 h-4 text-apsBlue shrink-0" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-apsRed hover:bg-apsRedLt/40 transition-colors">
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
