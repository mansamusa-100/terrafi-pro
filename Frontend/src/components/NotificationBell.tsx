import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Building2,
  Check,
  MapPin,
  Shield,
  TrendingDown,
  User,
  UserPlus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppData } from '../lib/data-context';
import type { Notification } from '../lib/api';
import type { Agent } from '../lib/api';

interface NotificationBellProps {
  setPage: (page: string) => void;
  setSelectedAgent: (agent: Agent | null) => void;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function iconForType(type: string) {
  if (type.startsWith('kyc.')) return Shield;
  if (type.startsWith('agent.')) return User;
  if (type.startsWith('visit.')) return MapPin;
  if (type.startsWith('float.')) return TrendingDown;
  if (type.startsWith('user.')) return UserPlus;
  if (type.startsWith('company.')) return Building2;
  return Bell;
}

function pageForNotification(n: Notification): string {
  if (n.type.startsWith('kyc.')) return 'compliance';
  if (n.type.startsWith('agent.')) return 'agents';
  if (n.type.startsWith('visit.')) return 'visits';
  if (n.type.startsWith('float.')) return 'dashboard';
  if (n.type.startsWith('user.')) return 'users';
  if (n.type.startsWith('company.')) return 'companies';
  return 'dashboard';
}

export function NotificationBell({
  setPage,
  setSelectedAgent
}: NotificationBellProps) {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    refreshNotifications,
    agents
  } = useAppData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      refreshNotifications().catch(() => {});
    }, 30_000);
    return () => window.clearInterval(id);
  }, [refreshNotifications]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleClick = async (n: Notification) => {
    if (!n.read) await markNotificationRead(n.id);
    setOpen(false);
    setPage(pageForNotification(n));
    if (n.entity_type === 'agent' && n.entity_id) {
      const agent = agents.find((a) => a.id === n.entity_id);
      if (agent) setSelectedAgent(agent);
    } else {
      setSelectedAgent(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen((v) => !v)}
        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
        <Bell className="w-5 h-5" />
      </button>
      {unreadNotificationCount > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[1.125rem] h-[1.125rem] px-1 bg-apsRed text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
          {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
        </span>
      )}

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-1.5rem))] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="text-sm font-semibold text-slate-900">Notifications</div>
            {unreadNotificationCount > 0 && (
              <button
                type="button"
                onClick={() => markAllNotificationsRead()}
                className="text-xs font-medium text-apsBlue hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = iconForType(n.type);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0',
                      !n.read && 'bg-apsBlueLt/20'
                    )}>
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                        n.read ? 'bg-slate-100 text-slate-500' : 'bg-apsBlueLt text-apsBlue'
                      )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={cn(
                            'text-xs font-semibold text-slate-900',
                            !n.read && 'text-slate-950'
                          )}>
                          {n.title}
                        </div>
                        {n.read && (
                          <Check className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {formatWhen(n.created_at)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
