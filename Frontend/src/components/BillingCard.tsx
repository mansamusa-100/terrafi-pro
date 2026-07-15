import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, Loader2, RefreshCw, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, BillingStatus } from '../lib/api';
import { fmtDalasi } from '../lib/data';
import { cn } from '../lib/utils';
import { useSubscriptionPayFlow } from '../lib/useSubscriptionPayFlow';

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
  const [data, setData] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const applySub = useCallback((subscription: BillingStatus['subscription']) => {
    setData((d) => (d ? { ...d, subscription } : d));
  }, []);

  const { openPayLink, syncOnce } = useSubscriptionPayFlow({
    onUpdate: applySub
  });

  const load = useCallback(async (live = false) => {
    setLoading(true);
    try {
      setData(await api.billing.status({ sync: live }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  const refresh = async () => {
    setBusy('sync');
    try {
      const subscription = await syncOnce();
      setData((d) => (d ? { ...d, subscription } : d));
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
      await api.billing.startSubscription();
      await load(true);
      toast.success('Corporate subscription started');
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
          {sub.planCode ? sub.planCode : '—'}
        </span>
        <span className="text-slate-500">Amount (monthly)</span>
        <span className="text-slate-900 font-medium text-right">
          {(sub.mrr ?? 0) > 0 ? fmtDalasi(sub.mrr ?? 0) : '—'}
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
            Set up Corporate plan
          </button>
        ) : sub.status !== 'ACTIVE' ? (
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

      <p className="mt-3 text-[11px] text-slate-400">
        Payments are processed in DirectPay (Gambian Dalasi). After you pay, this
        page updates automatically — you can also tap Refresh.
      </p>
    </div>
  );
}
