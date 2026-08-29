import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from './api';
import { captureDeviceLocation, canUseDeviceGps } from './geolocation';

const PING_INTERVAL_MS = 120_000;

function deviceId(): string {
  const key = 'fp_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID?.() ?? `dev-${Date.now()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

async function capturePing() {
  if (!canUseDeviceGps()) return null;
  try {
    const coords = await captureDeviceLocation();
    return coords;
  } catch {
    return null;
  }
}

export function useDutyTracking(enabled: boolean) {
  const [onDuty, setOnDuty] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushPings = useCallback(async (sid?: string | null) => {
    const coords = await capturePing();
    if (!coords) return;
    try {
      await api.tracking.recordPings({
        session_id: sid ?? sessionId ?? undefined,
        device_id: deviceId(),
        pings: [
          {
            lat: coords.lat,
            lng: coords.lng,
            captured_at: new Date().toISOString(),
            source: 'foreground'
          }
        ]
      });
    } catch {
      // silent — will retry on next interval
    }
  }, [sessionId]);

  const startInterval = useCallback(
    (sid: string) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        void flushPings(sid);
      }, PING_INTERVAL_MS);
    },
    [flushPings]
  );

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setInitializing(false);
      return;
    }
    let cancelled = false;
    api.tracking
      .getSession()
      .then((res) => {
        if (cancelled) return;
        if (res.active && res.session) {
          setOnDuty(true);
          setSessionId(res.session.id);
          setStartedAt(res.session.started_at);
          startInterval(res.session.id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, startInterval]);

  useEffect(() => {
    if (!enabled || !onDuty) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void flushPings();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, onDuty, flushPings]);

  useEffect(() => () => stopInterval(), [stopInterval]);

  const startDuty = async () => {
    if (busy || onDuty) return;
    setBusy(true);
    try {
      const coords = await capturePing();
      const res = await api.tracking.startSession({
        lat: coords?.lat,
        lng: coords?.lng,
        device_id: deviceId()
      });
      setOnDuty(true);
      setSessionId(res.session.id);
      setStartedAt(res.session.started_at);
      startInterval(res.session.id);
      toast.success(res.resumed ? 'Duty session resumed' : 'On duty — journey tracking started');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start duty');
    } finally {
      setBusy(false);
    }
  };

  const endDuty = async () => {
    if (busy || !onDuty) return;
    setBusy(true);
    try {
      const coords = await capturePing();
      await api.tracking.endSession({
        lat: coords?.lat,
        lng: coords?.lng,
        device_id: deviceId()
      });
      stopInterval();
      setOnDuty(false);
      setSessionId(null);
      setStartedAt(null);
      toast.success('Duty ended');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not end duty');
    } finally {
      setBusy(false);
    }
  };

  return {
    onDuty,
    sessionId,
    startedAt,
    busy,
    initializing,
    startDuty,
    endDuty,
    gpsAvailable: canUseDeviceGps()
  };
}
