import React, { useEffect, useState } from 'react';
import { Lock, Mail, ArrowRight, Loader2, Building2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { api, ApiError, PublicPlan } from '../lib/api';
import { cn } from '../lib/utils';
import { fmtDalasi } from '../lib/data';
import { BrandMark } from './BrandMark';
import { PwaInstallBanner } from './PwaInstallBanner';
import type { InfoSection } from './InfoPages';

const PLATFORM_BRANDING = {
  title: 'Terrafi Pro',
  subtitle: 'Agent Network Management',
  logo_url: '/icons/terrafi-logo.svg' as string | null
};

type Mode = 'signin' | 'register';

interface LoginScreenProps {
  initialMode?: Mode;
  onBack?: () => void;
  onInfo?: (section: InfoSection) => void;
}

export function LoginScreen({
  initialMode = 'signin',
  onBack,
  onInfo
}: LoginScreenProps) {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [registerForm, setRegisterForm] = useState({
    companyName: '',
    adminName: '',
    adminEmail: '',
    password: '',
    zone: '',
    planTier: 'standard',
    billingInterval: 'monthly' as 'monthly' | 'quarterly'
  });

  useEffect(() => {
    api
      .plans()
      .then((c) => setPlans(c.plans))
      .catch(() => {});
  }, []);

  const selectedPlan = plans.find((p) => p.id === registerForm.planTier);

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
        zone: registerForm.zone.trim() || undefined,
        planTier: registerForm.planTier,
        billingInterval: registerForm.billingInterval
      });
      const payUrl = res.billing?.payUrl;
      const planName =
        selectedPlan?.name || registerForm.planTier;
      if (payUrl) {
        toast.success(`Company registered — activate ${planName}`, {
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
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-6 inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </button>
          )}
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
              ? 'Choose a plan, create your workspace, and invite your team after sign-in.'
              : 'Field visits, float health, compliance, and performance — all in one operations dashboard for mobile money networks.'}
          </p>
        </div>

        <div className="relative z-10 mt-10 lg:mt-0">
          <div className="grid grid-cols-3 gap-4">
            {[
              ['Basic', '25 users'],
              ['Standard', '50 users'],
              ['Unlimited', 'No seat cap']
            ].map(([val, label]) => (
              <div
                key={label}
                className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <div className="text-lg font-bold text-white">{val}</div>
                <div className="text-white/50 text-xs mt-1">{label}</div>
              </div>
            ))}
          </div>
          {onInfo && (
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/50">
              <button type="button" onClick={() => onInfo('terms')} className="hover:text-white">
                Terms
              </button>
              <button type="button" onClick={() => onInfo('privacy')} className="hover:text-white">
                Privacy
              </button>
              <button type="button" onClick={() => onInfo('pricing')} className="hover:text-white">
                Pricing
              </button>
              <button type="button" onClick={() => onInfo('contact')} className="hover:text-white">
                Contact
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-slate-50">
        <PwaInstallBanner />
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-16">
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
                <h2 className="text-2xl font-bold text-slate-900 mb-6">
                  Sign in to your workspace
                </h2>

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
                      placeholder="Your mobile money operator"
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
                      placeholder="Full name"
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
                        setRegisterForm((f) => ({
                          ...f,
                          zone: e.target.value
                        }))
                      }
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue"
                      placeholder="Primary coverage zone"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                      Plan
                    </label>
                    <div className="space-y-2">
                      {(plans.length
                        ? plans
                        : [
                            {
                              id: 'basic',
                              name: 'Basic',
                              seatsLabel: 'Up to 25 users',
                              monthlyPriceGmd: 26590,
                              quarterlyPriceGmd: 79770
                            },
                            {
                              id: 'standard',
                              name: 'Standard',
                              seatsLabel: 'Up to 50 users',
                              monthlyPriceGmd: 31590,
                              quarterlyPriceGmd: 94770
                            },
                            {
                              id: 'unlimited',
                              name: 'Unlimited',
                              seatsLabel: 'Unlimited users',
                              monthlyPriceGmd: 50590,
                              quarterlyPriceGmd: 151770
                            }
                          ]
                      ).map((plan) => {
                        const price =
                          registerForm.billingInterval === 'quarterly'
                            ? plan.quarterlyPriceGmd
                            : plan.monthlyPriceGmd;
                        const selected = registerForm.planTier === plan.id;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() =>
                              setRegisterForm((f) => ({
                                ...f,
                                planTier: plan.id
                              }))
                            }
                            className={cn(
                              'w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors',
                              selected
                                ? 'border-apsBlue bg-apsBlue/5 ring-1 ring-apsBlue/20'
                                : 'border-slate-200 hover:border-slate-300'
                            )}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-900">
                                {plan.name}
                              </span>
                              <span className="font-medium text-slate-800">
                                {fmtDalasi(price)}
                                <span className="text-slate-400 font-normal">
                                  /
                                  {registerForm.billingInterval === 'quarterly'
                                    ? 'qtr'
                                    : 'mo'}
                                </span>
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {plan.seatsLabel}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                      Billing
                    </label>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                      {(
                        [
                          ['monthly', 'Monthly'],
                          ['quarterly', 'Quarterly (3 months)']
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            setRegisterForm((f) => ({
                              ...f,
                              billingInterval: id
                            }))
                          }
                          className={cn(
                            'flex-1 py-2 text-xs font-semibold rounded-md transition-colors',
                            registerForm.billingInterval === id
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600'
                          )}>
                          {label}
                        </button>
                      ))}
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
    </div>
  );
}
