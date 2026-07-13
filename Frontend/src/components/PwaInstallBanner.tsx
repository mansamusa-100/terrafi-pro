import React, { useEffect, useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'terrafi-pwa-install-dismissed';
const DISMISS_DAYS = 7;

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    const ms = DISMISS_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < ms;
  } catch {
    return false;
  }
}

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(isDismissedRecently);
  const [installed, setInstalled] = useState(isStandaloneMode);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandaloneMode()) {
      setInstalled(true);
      return;
    }

    const onInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setIosHint(false);
    };

    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', onInstalled);

    if (isIosSafari() && !isDismissedRecently()) {
      setIosHint(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;
  if (!deferred && !iosHint) return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === 'accepted') {
      setInstalled(true);
    }
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setDeferred(null);
    setIosHint(false);
  };

  return (
    <div className="mx-4 mt-3 mb-1 flex items-start gap-3 rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-sky-50 px-4 py-3 text-sm shadow-sm">
      {iosHint ? (
        <Share className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
      ) : (
        <Download className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-teal-600" />
          Install Terrafi Pro
        </div>
        <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
          {iosHint ? (
            <>
              Tap <span className="font-semibold text-slate-800">Share</span>, then{' '}
              <span className="font-semibold text-slate-800">Add to Home Screen</span> for
              quick field access and offline visit capture.
            </>
          ) : (
            <>
              Add Terrafi Pro to your home screen for app-like access, faster load times, and
              offline-ready field visits.
            </>
          )}
        </div>
      </div>
      {!iosHint && (
        <button
          type="button"
          onClick={install}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold">
          Install
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={dismiss}
        className="shrink-0 p-1 text-slate-400 hover:text-slate-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
