import React, { useState } from 'react';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { ROLE_META } from '../lib/rbac';
import { BrandMark } from './BrandMark';

export function SetPasswordScreen() {
  const { user, changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const roleMeta = ROLE_META[user.role];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('Choose a password different from your temporary one');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password set — welcome to Field-Pro');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-navy to-navyMid px-6 py-8 text-center">
          <div className="flex justify-center mb-4">
            <BrandMark branding={user.branding} size="md" />
          </div>
          <h1 className="text-white text-xl font-bold tracking-tight">
            Set your password
          </h1>
          <p className="text-white/60 text-sm mt-2">
            Welcome, {user.name}. Create a personal password before accessing{' '}
            {user.company}.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-white/70 bg-white/10 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            {roleMeta?.label || user.role}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            You signed in with a temporary password from your invitation. Choose
            a new password only you will know.
          </p>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
              Temporary password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue focus:ring-1 focus:ring-apsBlue/20"
                placeholder="From your invitation"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
              New password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue focus:ring-1 focus:ring-apsBlue/20"
                placeholder="At least 6 characters"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
              Confirm new password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue focus:ring-1 focus:ring-apsBlue/20"
                placeholder="Repeat new password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-apsBlue hover:bg-apsBlueMid text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Save password & continue'
            )}
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full text-xs font-medium text-slate-500 hover:text-slate-800 py-1">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
