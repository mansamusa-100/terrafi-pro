import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, X, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { ApiError } from '../lib/api';

interface Alert {
  id?: number;
  type: 'critical' | 'warning';
  title: string;
  body: string;
  time: string;
  agent: string | null;
}

interface AlertItemProps {
  alert: Alert;
  onDismiss?: (id: number) => Promise<void>;
}

export function AlertItem({ alert, onDismiss }: AlertItemProps) {
  const isCrit = alert.type === 'critical';
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async () => {
    if (!alert.id || !onDismiss) return;
    setDismissing(true);
    try {
      await onDismiss(alert.id);
      toast.success('Alert dismissed');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not dismiss alert');
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg border mb-2 last:mb-0',
        isCrit
          ? 'bg-apsRedLt border-apsRed/20'
          : 'bg-apsAmberLt border-apsAmber/20'
      )}>
      {isCrit ? (
        <AlertCircle className="w-4 h-4 text-apsRed shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-apsAmber shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-xs font-semibold',
            isCrit ? 'text-apsRed' : 'text-amber-800'
          )}>
          {alert.title}
        </div>
        <div
          className={cn(
            'text-xs mt-1',
            isCrit ? 'text-red-900' : 'text-amber-900'
          )}>
          {alert.body}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div
          className={cn(
            'text-[10px] whitespace-nowrap pt-0.5 font-medium',
            isCrit ? 'text-red-700' : 'text-amber-700'
          )}>
          {alert.time}
        </div>
        {onDismiss && alert.id != null && (
          <button
            type="button"
            aria-label="Dismiss alert"
            disabled={dismissing}
            onClick={handleDismiss}
            className={cn(
              'p-1 rounded hover:bg-black/5 transition-colors',
              isCrit ? 'text-red-700' : 'text-amber-700'
            )}>
            {dismissing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
