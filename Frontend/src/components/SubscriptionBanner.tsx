import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, BillingStatus } from '../lib/api';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { cn } from '../lib/utils';

function messageFor(status: string | null, provisioned: boolean): string {
  if (!provisioned) {
    return 'Set up your subscription to activate Corporate billing.';
  }
  switch (status) {
    case 'TRIALING':
      return 'You are on a trial. Pay your invoice to activate your Corporate plan.';
    case 'PAST_DUE':
      return 'Your subscription payment is past due. Pay now to avoid interruption.';
    case 'EXPIRED':
      return 'Your subscription has expired. Renew to restore full access.';
    case 'CANCELLED':
      return 'Your subscription was cancelled. Renew to reactivate.';
    default:
      return 'Your subscription is not active yet.';
  }
}

export function SubscriptionBanner() {
  const { user } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [paying, setPaying] = useState(false);

  const canManage = user ? can(user.role, 'manageBilling') : false;

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    api.billing
      .status()
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [canManage]);

  const openPayLink = useCallback(async () => {
    setPaying(true);
    try {
      const cached = status?.subscription.payUrl;
      if (cached) {
        window.open(cached, '_blank', 'noopener');
        return;
      }
      const res = await api.billing.payLink();
      if (res.payUrl) {
        window.open(res.payUrl, '_blank', 'noopener');
      } else {
        toast.error('No pay link is available yet.');
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.info('No payable invoice yet', {
          description: 'Your plan has no outstanding invoice right now.'
        });
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Could not open pay link');
      }
    } finally {
      setPaying(false);
    }
  }, [status]);

  if (!canManage || !status || !status.configured || dismissed) return null;

  const sub = status.subscription;
  if (sub.status === 'ACTIVE') return null;

  const severe =
    sub.status === 'EXPIRED' || sub.status === 'CANCELLED' || !sub.provisioned;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b text-sm',
        severe
          ? 'bg-apsRedLt/60 border-apsRed/20 text-apsRed'
          : 'bg-apsAmberLt/60 border-amber-300/40 text-amber-800'
      )}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0">{messageFor(sub.status, sub.provisioned)}</span>
      <button
        type="button"
        onClick={openPayLink}
        disabled={paying}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-60 shrink-0',
          severe ? 'bg-apsRed hover:bg-apsRed/90' : 'bg-amber-600 hover:bg-amber-700'
        )}>
        {paying ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <CreditCard className="w-3.5 h-3.5" />
        )}
        Pay in DirectPay
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-black/5 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
