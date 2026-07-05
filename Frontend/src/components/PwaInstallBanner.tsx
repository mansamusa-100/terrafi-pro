import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa-install-dismissed') === '1'
  );

  useEffect(() => {
    const onInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => window.removeEventListener('beforeinstallprompt', onInstall);
  }, []);

  if (dismissed || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  const dismiss = () => {
    localStorage.setItem('pwa-install-dismissed', '1');
    setDismissed(true);
    setDeferred(null);
  };

  return (
    <div className="mx-4 mt-3 mb-1 flex items-center gap-3 rounded-xl border border-apsBlue/20 bg-apsBlueLt px-4 py-3 text-sm">
      <Download className="w-5 h-5 text-apsBlue shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900">Install Field-Pro</div>
        <div className="text-xs text-slate-600">
          Add to your home screen for quick field access with offline-ready shell.
        </div>
      </div>
      <button
        type="button"
        onClick={install}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-apsBlue text-white text-xs font-semibold">
        Install
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="shrink-0 p-1 text-slate-400 hover:text-slate-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
