import React, { useState } from 'react';
import { CreditCard, Loader2, Lock, LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { fmtDalasi } from '../lib/data';
import { BrandMark } from './BrandMark';
import { useSubscriptionPayFlow } from '../lib/useSubscriptionPayFlow';

export function PaymentRequiredScreen() {
  const { user, subscription, logout, setSubscription, refreshProfile } =
    useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  const { openPayLink, syncOnce } = useSubscriptionPayFlow({
    onUpdate: (sub) => setSubscription(sub)
  });

  if (!user) return null;

  const planLabel = subscription?.planName || subscription?.planTier || 'plan';
  const grace = subscription?.graceUntil
    ? new Date(subscription.graceUntil).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : null;

  const pay = async () => {
    setBusy('pay');
    try {
      await openPayLink(subscription?.payUrl);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not open pay link');
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    setBusy('sync');
    try {
      const sub = await syncOnce();
      setSubscription(sub);
      await refreshProfile();
      if (sub.lockState === 'open' || sub.status === 'ACTIVE') {
        toast.success('Payment confirmed — access restored');
      } else {
        toast.info('Subscription refreshed. Complete payment to unlock.');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Refresh failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-navy to-navyMid px-6 py-8 text-center">
          <div className="flex justify-center mb-4">
            <BrandMark branding={user.branding} size="md" />
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-100 bg-amber-500/20 px-3 py-1 rounded-full mb-3">
            <Lock className="w-3.5 h-3.5" />
            Access locked
          </div>
          <h1 className="text-white text-xl font-bold tracking-tight">
            Subscription payment required
          </h1>
          <p className="text-white/65 text-sm mt-2 leading-relaxed">
            The grace period for {user.company} has ended. Only you, as network
            manager, can access Terrafi Pro until the {planLabel} subscription is
            paid.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm space-y-1.5">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Plan</span>
              <span className="font-medium text-slate-900">{planLabel}</span>
            </div>
            {(subscription?.mrr ?? 0) > 0 && (
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Monthly rate</span>
                <span className="font-medium text-slate-900">
                  {fmtDalasi(subscription?.mrr ?? 0)}
                </span>
              </div>
            )}
            {grace && (
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Grace ended</span>
                <span className="font-medium text-slate-900">{grace}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Team members cannot sign in until payment succeeds. After you pay in
            DirectPay, tap Refresh to restore full access.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={pay}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-apsBlue px-4 py-2.5 text-sm font-semibold text-white hover:bg-apsBlue/90 disabled:opacity-60">
              {busy === 'pay' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              Pay subscription
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={refresh}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              {busy === 'sync' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full inline-flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-800 py-2">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
