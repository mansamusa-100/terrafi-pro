import React from 'react';
import { Lock, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { BrandMark } from './BrandMark';

/** Shown when a non-manager session remains after the org is locked. */
export function AccessLockedScreen() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-navy to-navyMid px-6 py-8 text-center">
          <div className="flex justify-center mb-4">
            <BrandMark branding={user.branding} size="md" />
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-100 bg-amber-500/20 px-3 py-1 rounded-full mb-3">
            <Lock className="w-3.5 h-3.5" />
            Access locked
          </div>
          <h1 className="text-white text-xl font-bold tracking-tight">
            Subscription locked
          </h1>
          <p className="text-white/65 text-sm mt-2 leading-relaxed">
            {user.company}&apos;s subscription grace period has ended. Only your
            network manager can sign in to settle payment and restore access.
          </p>
        </div>
        <div className="p-6">
          <button
            type="button"
            onClick={logout}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-white py-2.5 text-sm font-semibold hover:bg-slate-800">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
