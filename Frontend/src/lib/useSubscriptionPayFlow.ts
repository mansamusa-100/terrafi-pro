import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api, ApiError, type SubscriptionView } from './api';

const POLL_MS = 3000;
const POLL_MAX_MS = 3 * 60 * 1000;

type Options = {
  onUpdate?: (subscription: SubscriptionView) => void;
  /** When true, toast on becoming ACTIVE */
  notifyOnActive?: boolean;
};

/**
 * Opens a fresh DirectPay pay link and polls /billing/sync until ACTIVE
 * (or timeout). Also re-syncs when the tab regains focus.
 */
export function useSubscriptionPayFlow({
  onUpdate,
  notifyOnActive = true
}: Options = {}) {
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadline = useRef<number>(0);
  const lastStatus = useRef<string | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    pollDeadline.current = 0;
  }, []);

  const applySubscription = useCallback((subscription: SubscriptionView) => {
    const prev = lastStatus.current;
    lastStatus.current = subscription.status;
    onUpdateRef.current?.(subscription);
    if (
      notifyOnActive &&
      subscription.status === 'ACTIVE' &&
      prev &&
      prev !== 'ACTIVE'
    ) {
      toast.success('Subscription activated', {
        description: 'DirectPay payment confirmed.'
      });
      stopPolling();
    }
    if (subscription.status === 'ACTIVE') {
      stopPolling();
    }
  }, [notifyOnActive, stopPolling]);

  const syncOnce = useCallback(async () => {
    const res = await api.billing.sync();
    applySubscription(res.subscription);
    return res.subscription;
  }, [applySubscription]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollDeadline.current = Date.now() + POLL_MAX_MS;
    pollTimer.current = setInterval(async () => {
      if (Date.now() > pollDeadline.current) {
        stopPolling();
        return;
      }
      try {
        await syncOnce();
      } catch {
        /* keep trying until deadline */
      }
    }, POLL_MS);
  }, [stopPolling, syncOnce]);

  useEffect(() => {
    const onFocus = () => {
      if (lastStatus.current === 'ACTIVE') return;
      syncOnce().catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      stopPolling();
    };
  }, [syncOnce, stopPolling]);

  const openPayLink = useCallback(
    async (cachedPayUrl?: string | null) => {
      let url: string | null = null;
      try {
        const res = await api.billing.payLink();
        url = res.payUrl;
      } catch (err) {
        if (cachedPayUrl) {
          url = cachedPayUrl;
        } else if (err instanceof ApiError && err.status === 409) {
          toast.info('No payable invoice right now', {
            description:
              'DirectPay has no open invoice yet. Tap Refresh shortly, or open billing again from Settings.'
          });
          startPolling();
          return;
        } else {
          throw err;
        }
      }

      if (!url) {
        toast.error('No pay link available yet');
        return;
      }

      window.open(url, '_blank', 'noopener');
      toast.info('Complete payment in DirectPay', {
        description: 'This page will update automatically when payment clears.'
      });
      startPolling();
      // Immediate sync shortly after open in case payment is very fast
      setTimeout(() => {
        syncOnce().catch(() => {});
      }, 4000);
    },
    [startPolling, syncOnce]
  );

  return { openPayLink, syncOnce, startPolling, stopPolling };
}
