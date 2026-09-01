import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, BillingStatus } from '../lib/api';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { cn } from '../lib/utils';
import { useSubscriptionPayFlow } from '../lib/useSubscriptionPayFlow';

function messageFor(sub: BillingStatus['subscription']): string {
  if (sub.lockState === 'grace') {
    const until = sub.graceUntil
      ? new Date(sub.graceUntil).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric'
        })
      : 'soon';
    return `Subscription payment overdue. Settle by ${until} to avoid locking team access.`;
  }
  if (sub.lockState === 'locked') {
    return 'Access is locked for your team. Pay now to restore Terrafi Pro.';
  }
  if (!sub.provisioned) {
    return 'Set up your subscription to activate billing for your plan.';
  }
  switch (sub.status) {
    case 'TRIALING':
      return 'You are on a trial. Pay your Corporate invoice in DirectPay anytime to activate billing.';
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
  const { user, setSubscription } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [paying, setPaying] = useState(false);

  const canManage = user ? can(user, 'manageBilling') : false;

  const applySub = useCallback(
    (subscription: BillingStatus['subscription']) => {
      setStatus((s) => (s ? { ...s, subscription } : s));
      setSubscription(subscription);
    },
    [setSubscription]
  );

  const { openPayLink } = useSubscriptionPayFlow({ onUpdate: applySub });

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    api.billing
      .status({ sync: true })
      .then((s) => {
        if (active) {
          setStatus(s);
          setSubscription(s.subscription);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [canManage, setSubscription]);

  const onPay = async () => {
    setPaying(true);
    try {
      await openPayLink(status?.subscription.payUrl);
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
  };

  if (!canManage || !status || !status.configured || dismissed) return null;

  const sub = status.subscription;
  if (sub.status === 'ACTIVE' && sub.lockState !== 'grace' && sub.lockState !== 'locked') {
    return null;
  }

  const severe =
    sub.lockState === 'locked' ||
    sub.status === 'EXPIRED' ||
    sub.status === 'CANCELLED' ||
    !sub.provisioned;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b text-sm',
        severe
          ? 'bg-apsRedLt/60 border-apsRed/20 text-apsRed'
          : 'bg-apsAmberLt/60 border-amber-300/40 text-amber-800'
      )}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0">{messageFor(sub)}</span>
      <button
        type="button"
        onClick={onPay}
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
      {sub.lockState !== 'locked' && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-black/5 shrink-0">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
