import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, CreditCard, Loader2, RefreshCw, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, BillingStatus, PublicPlan } from '../lib/api';
import { fmtDalasi } from '../lib/data';
import { cn } from '../lib/utils';
import { useSubscriptionPayFlow } from '../lib/useSubscriptionPayFlow';
import { useAuth } from '../lib/auth';

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-apsGreenLt text-apsGreen border-apsGreen/20',
  TRIALING: 'bg-apsBlueLt text-apsBlue border-apsBlue/20',
  PAST_DUE: 'bg-apsAmberLt text-amber-700 border-amber-300/40',
  EXPIRED: 'bg-apsRedLt text-apsRed border-apsRed/20',
  CANCELLED: 'bg-apsRedLt text-apsRed border-apsRed/20'
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function BillingCard() {
  const { setSubscription } = useAuth();
  const [data, setData] = useState<BillingStatus | null>(null);
  const [upgrades, setUpgrades] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const applySub = useCallback(
    (subscription: BillingStatus['subscription']) => {
      setData((d) => (d ? { ...d, subscription } : d));
      setSubscription(subscription);
    },
    [setSubscription]
  );

  const { openPayLink, syncOnce } = useSubscriptionPayFlow({
    onUpdate: applySub
  });

  const load = useCallback(async (live = false) => {
    setLoading(true);
    try {
      const [status, planInfo] = await Promise.all([
        api.billing.status({ sync: live }),
        api.billing.availableUpgrades().catch(() => null)
      ]);
      setData(status);
      setSubscription(status.subscription);
      if (planInfo) setUpgrades(planInfo.upgrades);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, [setSubscription]);

  useEffect(() => {
    load(true);
  }, [load]);

  const refresh = async () => {
    setBusy('sync');
    try {
      const subscription = await syncOnce();
      applySub(subscription);
      toast.success('Subscription refreshed');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Refresh failed');
    } finally {
      setBusy(null);
    }
  };

  const setUp = async () => {
    setBusy('provision');
    try {
      await api.billing.provision();
      await api.billing.startSubscription(
        undefined,
        data?.subscription.billingInterval || 'monthly'
      );
      await load(true);
      toast.success('Subscription started');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Setup failed');
    } finally {
      setBusy(null);
    }
  };

  const pay = async () => {
    setBusy('pay');
    try {
      await openPayLink(data?.subscription.payUrl);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not open pay link');
    } finally {
      setBusy(null);
    }
  };

  const upgrade = async (tierId: string) => {
    setBusy(`upgrade-${tierId}`);
    try {
      const { subscription } = await api.billing.upgrade(
        tierId,
        data?.subscription.billingInterval || undefined
      );
      applySub(subscription);
      await load(true);
      toast.success(`Upgraded to ${subscription.planName || tierId}`, {
        description: 'Complete payment in DirectPay if an invoice is open.'
      });
      if (subscription.payUrl) {
        window.open(subscription.payUrl, '_blank', 'noopener');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upgrade failed');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading subscription…
      </div>
    );
  }

  if (!data) return null;

  const sub = data.subscription;
  const seatsLabel =
    sub.userSeats == null
      ? 'Unlimited users'
      : `Up to ${sub.userSeats} users`;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Subscription &amp; billing</h3>
        {sub.status ? (
          <span
            className={cn(
              'text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize',
              STATUS_STYLE[sub.status] || 'bg-slate-100 text-slate-600 border-slate-200'
            )}>
            {sub.status.toLowerCase().replace('_', ' ')}
          </span>
        ) : (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
            Not set up
          </span>
        )}
      </div>

      {sub.lockState === 'grace' && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Payment overdue. Full access continues until{' '}
          {formatDate(sub.graceUntil)}. After that only the manager can sign in
          to pay.
        </div>
      )}
      {sub.lockState === 'locked' && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Access is locked for the team. Pay now to restore Terrafi Pro.
        </div>
      )}

      {sub.status === 'TRIALING' && (
        <div className="mb-4 rounded-lg border border-apsBlue/20 bg-apsBlueLt/40 px-3 py-2 text-xs text-apsBlue">
          Corporate subscription is on trial. You can still open DirectPay and pay
          the invoice now to activate billing before the trial ends.
        </div>
      )}

      {!data.configured && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          DirectPay billing is not configured on this server yet. Set the{' '}
          <code className="font-mono">DIRECTPAY_*</code> environment variables to enable
          subscription payments.
        </div>
      )}

      <div className="grid grid-cols-2 gap-y-3 text-sm mb-4">
        <span className="text-slate-500">Plan</span>
        <span className="text-slate-900 font-medium text-right">
          {sub.planName || sub.planTier || sub.planCode || '—'}
        </span>
        <span className="text-slate-500">Seats</span>
        <span className="text-slate-900 font-medium text-right">{seatsLabel}</span>
        <span className="text-slate-500">Amount (monthly)</span>
        <span className="text-slate-900 font-medium text-right">
          {(sub.mrr ?? 0) > 0 ? fmtDalasi(sub.mrr ?? 0) : '—'}
        </span>
        <span className="text-slate-500">Billing interval</span>
        <span className="text-slate-900 font-medium text-right capitalize">
          {sub.billingInterval || '—'}
        </span>
        <span className="text-slate-500">Current period ends</span>
        <span className="text-slate-900 font-medium text-right">
          {formatDate(sub.periodEnd)}
        </span>
        <span className="text-slate-500">Last synced</span>
        <span className="text-slate-900 font-medium text-right">
          {sub.syncedAt ? formatDate(sub.syncedAt) : '—'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!sub.provisioned ? (
          <button
            type="button"
            disabled={!data.configured || busy !== null}
            onClick={setUp}
            className="inline-flex items-center gap-1.5 rounded-md bg-apsBlue px-3 py-1.5 text-xs font-semibold text-white hover:bg-apsBlue/90 disabled:opacity-50">
            {busy === 'provision' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" />
            )}
            Set up billing
          </button>
        ) : sub.status !== 'ACTIVE' ||
          sub.lockState === 'locked' ||
          sub.lockState === 'grace' ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={pay}
            className="inline-flex items-center gap-1.5 rounded-md bg-apsBlue px-3 py-1.5 text-xs font-semibold text-white hover:bg-apsBlue/90 disabled:opacity-50">
            {busy === 'pay' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CreditCard className="w-3.5 h-3.5" />
            )}
            Pay in DirectPay
          </button>
        ) : null}
        <button
          type="button"
          disabled={!data.configured || busy !== null}
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {busy === 'sync' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Refresh
        </button>
      </div>

      {upgrades.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
            Upgrade plan
          </h4>
          <div className="space-y-2">
            {upgrades.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {plan.name}{' '}
                    <span className="text-slate-500 font-normal">
                      · {plan.seatsLabel}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {fmtDalasi(plan.monthlyPriceGmd)}/mo
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => upgrade(plan.id)}
                  className="inline-flex items-center gap-1 shrink-0 rounded-md border border-apsBlue/30 bg-apsBlue/5 px-2.5 py-1.5 text-xs font-semibold text-apsBlue hover:bg-apsBlue/10 disabled:opacity-50">
                  {busy === `upgrade-${plan.id}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  )}
                  Upgrade
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] text-slate-400">
        Payments are processed in DirectPay (Gambian Dalasi). After you pay, this
        page updates automatically — you can also tap Refresh.
      </p>
    </div>
  );
}
