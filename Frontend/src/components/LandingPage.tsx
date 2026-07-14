import React, { useEffect, useState } from 'react';
import { ArrowRight, MapPin, ShieldCheck, Wallet, Activity } from 'lucide-react';
import { BrandMark } from './BrandMark';

const BRANDING = {
  title: 'Terrafi Pro',
  subtitle: 'Agent Network Management',
  logo_url: '/icons/terrafi-logo.svg' as string | null
};

interface LandingPageProps {
  onSignIn: () => void;
  onRegister: () => void;
}

export function LandingPage({ onSignIn, onRegister }: LandingPageProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="min-h-screen font-landing bg-[#061018] text-white overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 70% 10%, rgba(0,150,136,0.35), transparent 55%), radial-gradient(ellipse 60% 40% at 10% 80%, rgba(21,101,192,0.25), transparent 50%)'
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
        }}
      />

      <header className="relative z-20 flex items-center justify-between gap-4 px-5 sm:px-10 lg:px-16 py-5">
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark branding={BRANDING} />
          <span className="font-landing-display text-xl sm:text-2xl tracking-tight truncate">
            Terrafi Pro
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onSignIn}
            className="px-3 sm:px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors">
            Sign in
          </button>
          <button
            type="button"
            onClick={onRegister}
            className="px-3 sm:px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-[#061018] text-sm font-semibold transition-colors">
            Get started
          </button>
        </div>
      </header>

      <main className="relative z-10">
        <section className="min-h-[calc(100vh-4.5rem)] flex flex-col justify-center px-5 sm:px-10 lg:px-16 pb-16 pt-8">
          <div
            className={`max-w-3xl transition-all duration-700 ease-out ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}>
            <p className="font-landing-display text-4xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-2">
              Terrafi Pro
            </p>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-medium text-teal-200/90 leading-snug mb-5 max-w-xl">
              Run your mobile money agent network from one place.
            </h1>
            <p className="text-base sm:text-lg text-white/60 leading-relaxed max-w-lg mb-8">
              Field visits, float health, KYC compliance, and performance for
              operators who need clarity across every agent and zone.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onRegister}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-[#061018] text-sm font-semibold transition-all hover:gap-3">
                Register your company
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/20 hover:border-white/40 text-white text-sm font-medium transition-colors">
                Sign in to workspace
              </button>
            </div>
          </div>

          <div
            className={`mt-16 lg:mt-20 transition-all duration-1000 delay-200 ease-out ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
            <div className="relative h-48 sm:h-64 lg:h-72 rounded-none sm:rounded-2xl overflow-hidden border-y sm:border border-white/10 -mx-5 sm:mx-0">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(135deg, #0a2830 0%, #0d3d38 40%, #0a1f2e 100%)'
                }}
              />
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(45,212,191,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.2) 1px, transparent 1px)',
                  backgroundSize: '40px 40px'
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#061018] via-transparent to-transparent" />
              <svg
                className="absolute inset-0 w-full h-full opacity-70"
                viewBox="0 0 800 280"
                preserveAspectRatio="xMidYMid slice"
                aria-hidden>
                <circle cx="160" cy="120" r="6" fill="#2dd4bf" />
                <circle cx="320" cy="80" r="5" fill="#5eead4" />
                <circle cx="480" cy="140" r="7" fill="#2dd4bf" />
                <circle cx="620" cy="90" r="5" fill="#99f6e4" />
                <circle cx="700" cy="180" r="6" fill="#2dd4bf" />
                <path
                  d="M160 120 L320 80 L480 140 L620 90 L700 180"
                  fill="none"
                  stroke="rgba(45,212,191,0.45)"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>
        </section>

        <section className="px-5 sm:px-10 lg:px-16 py-20 border-t border-white/10">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-landing-display text-3xl sm:text-4xl tracking-tight mb-3">
              Built for agent network operations
            </h2>
            <p className="text-white/55 max-w-xl mb-12 text-base leading-relaxed">
              One workspace for managers, field officers, and compliance — with
              roles that match how mobile money networks actually run.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: MapPin,
                  title: 'Field visits that stick',
                  body: 'Schedule, GPS-verify, and log visits so coverage is measured, not guessed.'
                },
                {
                  icon: Wallet,
                  title: 'Float you can trust',
                  body: 'Spot low-float agents early and keep liquidity healthy across the network.'
                },
                {
                  icon: ShieldCheck,
                  title: 'KYC without the chaos',
                  body: 'Collect documents, review in queue, and keep every agent audit-ready.'
                },
                {
                  icon: Activity,
                  title: 'Performance in context',
                  body: 'See ADR and agent trends so coaching happens where it matters.'
                }
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/15 border border-teal-400/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-teal-400" />
                  </div>
                  <h3 className="font-landing-display text-xl tracking-tight">
                    {title}
                  </h3>
                  <p className="text-sm text-white/55 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 sm:px-10 lg:px-16 py-20 border-t border-white/10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-landing-display text-3xl sm:text-4xl tracking-tight mb-4">
              Ready to run your network on Terrafi Pro?
            </h2>
            <p className="text-white/55 mb-8 leading-relaxed">
              Register your organisation in minutes, then invite managers, ADRs,
              and agents into their roles.
            </p>
            <button
              type="button"
              onClick={onRegister}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-[#061018] text-sm font-semibold transition-colors">
              Get started free
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 px-5 sm:px-10 lg:px-16 py-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
        <span className="font-landing-display text-sm text-white/60">
          Terrafi Pro
        </span>
        <span>Agent network management for mobile money operators</span>
      </footer>
    </div>
  );
}
