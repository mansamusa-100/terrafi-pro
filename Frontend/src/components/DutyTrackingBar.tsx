import React from 'react';
import { Loader2, MapPinned, Play, Square } from 'lucide-react';
import { cn } from '../lib/utils';

interface DutyTrackingBarProps {
  onDuty: boolean;
  startedAt: string | null;
  busy: boolean;
  initializing: boolean;
  gpsAvailable: boolean;
  onStart: () => void;
  onEnd: () => void;
}

export function DutyTrackingBar({
  onDuty,
  startedAt,
  busy,
  initializing,
  gpsAvailable,
  onStart,
  onEnd
}: DutyTrackingBarProps) {
  if (initializing) return null;

  const startedLabel =
    startedAt &&
    new Date(startedAt).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });

  return (
    <div
      className={cn(
        'border-b px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm',
        onDuty ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'
      )}>
      <div className="flex items-center gap-2 min-w-0">
        <MapPinned
          className={cn('w-4 h-4 shrink-0', onDuty ? 'text-teal-700' : 'text-slate-400')}
        />
        <div className="min-w-0">
          <div className={cn('font-medium', onDuty ? 'text-teal-900' : 'text-slate-700')}>
            {onDuty ? 'On duty · journey tracking active' : 'Off duty'}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {onDuty && startedLabel
              ? `Started ${startedLabel} · GPS pings every 2 min`
              : gpsAvailable
                ? 'Start duty when you begin field work'
                : 'GPS unavailable — use HTTPS or log visits for check-in points'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onDuty ? (
          <button
            type="button"
            disabled={busy}
            onClick={onEnd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-teal-300 text-teal-800 text-xs font-semibold hover:bg-teal-100 disabled:opacity-60">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
            End duty
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onStart}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-60">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Start duty
          </button>
        )}
      </div>
    </div>
  );
}
