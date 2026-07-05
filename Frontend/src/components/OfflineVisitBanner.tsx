import React from 'react';
import { CloudOff, CloudUpload, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { isBrowserOnline } from '../lib/offline-visits';

interface OfflineVisitBannerProps {
  count: number;
  syncing: boolean;
  onSync: () => void;
}

export function OfflineVisitBanner({
  count,
  syncing,
  onSync
}: OfflineVisitBannerProps) {
  const online = isBrowserOnline();

  if (count === 0 && online) return null;

  return (
    <div
      className={cn(
        'mx-4 mt-2 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm',
        online
          ? 'border-amber-200 bg-amber-50'
          : 'border-slate-200 bg-slate-100'
      )}>
      {online ? (
        <CloudUpload className="w-5 h-5 text-amber-600 shrink-0" />
      ) : (
        <WifiOff className="w-5 h-5 text-slate-500 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        {!online ? (
          <>
            <div className="font-semibold text-slate-900">You&apos;re offline</div>
            <div className="text-xs text-slate-600">
              Visits you log are saved on this device with GPS captured at the agent.
              {count > 0 && ` ${count} waiting.`}
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold text-amber-900">
              {count} visit{count === 1 ? '' : 's'} waiting to sync
            </div>
            <div className="text-xs text-amber-800">
              Tap sync to upload queued field visits to the server.
            </div>
          </>
        )}
      </div>
      {online && count > 0 && (
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold disabled:opacity-60">
          {syncing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Sync
        </button>
      )}
      {!online && count > 0 && (
        <CloudOff className="w-5 h-5 text-slate-400 shrink-0" />
      )}
    </div>
  );
}
