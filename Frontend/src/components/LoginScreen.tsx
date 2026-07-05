import React, { useEffect, useState } from 'react';
import { Lock, Mail, ArrowRight, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_META, Role } from '../lib/rbac';
import { useAuth } from '../lib/auth';
import { api, DemoUser, ApiError } from '../lib/api';
import { cn } from '../lib/utils';
import { BrandMark } from './BrandMark';

const PLATFORM_BRANDING = {
  title: 'Field-Pro',
  subtitle: 'Agent Network Management',
  logo_url: null as string | null
};

type Mode = 'signin' | 'register';

export function LoginScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('adama@apswallet.gm');
  const [password, setPassword] = useState('demo');
  const [loading, setLoading] = useState(false);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [registerForm, setRegisterForm] = useState({
    companyName: '',
    adminName: '',
    adminEmail: '',
    password: '',
    zone: ''
  });

  useEffect(() => {
    api.demoUsers().then(setDemoUsers).catch(() => {});
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.registerCompany({
        companyName: registerForm.companyName.trim(),
        adminName: registerForm.adminName.trim(),
        adminEmail: registerForm.adminEmail.trim(),
        password: registerForm.password,
        zone: registerForm.zone.trim() || undefined
      });
      const payUrl = res.billing?.payUrl;
      if (payUrl) {
        toast.success('Company registered — activate your Corporate plan', {
          description: 'Pay your first subscription invoice in DirectPay.',
          duration: 10000,
          action: {
            label: 'Pay now',
            onClick: () => window.open(payUrl, '_blank', 'noopener')
          }
        });
      } else {
        toast.success(res.message);
      }
      await login(registerForm.adminEmail.trim(), registerForm.password);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Registration failed'
      );
    } finally {
      setLoading(false);
    }
  };

  const quickSignIn = async (demoEmail: string) => {
    setLoading(true);
    try {
      await login(demoEmail, 'demo');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const showcaseRoles: Role[] = [
    'system_owner',
    'platform_staff',
    'manager',
    'internal',
    'team_lead',
    'adr',
    'agent',
    'teller'
  ];

  const quickRoles = showcaseRoles
    .map((role) => demoUsers.find((u) => u.role === role))
    .filter(Boolean) as DemoUser[];

  return (
    <div className="min-h-screen w-full bg-navy flex flex-col lg:flex-row">
      <div className="lg:w-1/2 bg-gradient-to-br from-navy to-navyMid p-6 sm:p-10 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <BrandMark branding={PLATFORM_BRANDING} />
            <div>
              <div className="text-white text-lg font-bold tracking-wide">
                {PLATFORM_BRANDING.title}
              </div>
              <div className="text-white/50 text-xs uppercase tracking-widest font-medium">
                {PLATFORM_BRANDING.subtitle}
              </div>
            </div>
          </div>

          <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
            {mode === 'register'
              ? 'Register your organisation'
              : 'Monitor your agent network in real time'}
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-md">
            {mode === 'register'
              ? 'Create your mobile money operator workspace. You become the network manager and can invite your team after sign-in.'
              : 'Field visits, float health, compliance, and performance — all in one operations dashboard for mobile money networks.'}
          </p>
        </div>

        <div className="relative z-10 mt-10 lg:mt-0">
          <div className="grid grid-cols-3 gap-4">
            {[
              ['Self-serve', 'Onboarding'],
              ['Multi-tenant', 'Workspaces'],
              ['Secure', 'Audit logs']
            ].map(([val, label]) => (
              <div
                key={label}
                className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{val}</div>
                <div className="text-white/50 text-xs mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-16 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="flex gap-2 mb-6 p-1 bg-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={cn(
                'flex-1 py-2 text-sm font-semibold rounded-md transition-colors',
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}>
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={cn(
                'flex-1 py-2 text-sm font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5',
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}>
              <Building2 className="w-4 h-4" />
              Register company
            </button>
          </div>

          {mode === 'signin' ? (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">
                Sign in to your workspace
              </h2>
              <p className="text-slate-500 text-sm mb-2">
                Demo password for all accounts:{' '}
                <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs font-mono">
                  demo
                </code>
              </p>
              <div className="mb-6 rounded-lg border border-apsBlue/20 bg-apsBlueLt/40 px-3 py-2.5 text-xs text-slate-700">
                <span className="font-semibold text-apsBlue">System Owner:</span>{' '}
                <code className="font-mono">owner@anms.platform</code> / demo
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue focus:ring-1 focus:ring-apsBlue/20 transition-all"
                      placeholder="you@company.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue focus:ring-1 focus:ring-apsBlue/20 transition-all"
                      placeholder="••••••••"
                      required
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
                    <>
                      Sign in
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Quick access by role
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {quickRoles.map((u) => {
                    const rm = ROLE_META[u.role];
                    return (
                      <button
                        key={u.email}
                        type="button"
                        disabled={loading}
                        onClick={() => quickSignIn(u.email)}
                        className="text-left px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-apsBlue hover:bg-apsBlueLt/30 transition-all disabled:opacity-60">
                        <div className="text-xs font-semibold text-slate-900">
                          {rm.label}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {u.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">
                Register your company
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                You will be the network manager for your organisation.
              </p>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    Company name
                  </label>
                  <input
                    required
                    value={registerForm.companyName}
                    onChange={(e) =>
                      setRegisterForm((f) => ({
                        ...f,
                        companyName: e.target.value
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue"
                    placeholder="APS Wallet Gambia"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    Your full name
                  </label>
                  <input
                    required
                    value={registerForm.adminName}
                    onChange={(e) =>
                      setRegisterForm((f) => ({
                        ...f,
                        adminName: e.target.value
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue"
                    placeholder="Adama Jallow"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    Work email
                  </label>
                  <input
                    type="email"
                    required
                    value={registerForm.adminEmail}
                    onChange={(e) =>
                      setRegisterForm((f) => ({
                        ...f,
                        adminEmail: e.target.value
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    Password (min 6 characters)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm((f) => ({
                        ...f,
                        password: e.target.value
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    Primary zone (optional)
                  </label>
                  <input
                    value={registerForm.zone}
                    onChange={(e) =>
                      setRegisterForm((f) => ({ ...f, zone: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue"
                    placeholder="Greater Banjul"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-apsBlue hover:bg-apsBlueMid text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
