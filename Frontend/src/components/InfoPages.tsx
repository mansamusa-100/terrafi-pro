import React, { useEffect, useState } from 'react';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import { api, PlansCatalogue, PublicPlan } from '../lib/api';
import { fmtDalasi } from '../lib/data';
import { BrandMark } from './BrandMark';

export type InfoSection = 'pricing' | 'terms' | 'privacy' | 'contact';

const BRANDING = {
  title: 'Terrafi Pro',
  subtitle: 'Agent Network Management',
  logo_url: '/icons/terrafi-logo.svg' as string | null
};

const SECTIONS: { id: InfoSection; label: string }[] = [
  { id: 'pricing', label: 'Pricing' },
  { id: 'terms', label: 'Terms of Service' },
  { id: 'privacy', label: 'Data Privacy' },
  { id: 'contact', label: 'Contact' }
];

interface InfoPagesProps {
  section: InfoSection;
  onSection: (s: InfoSection) => void;
  onBack: () => void;
  onRegister?: () => void;
}

function PlanCards({
  plans,
  interval,
  onPick
}: {
  plans: PublicPlan[];
  interval: 'monthly' | 'quarterly';
  onPick?: () => void;
}) {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {plans.map((plan) => {
        const price =
          interval === 'quarterly'
            ? plan.quarterlyPriceGmd
            : plan.monthlyPriceGmd;
        const highlighted = plan.id === 'standard';
        return (
          <div
            key={plan.id}
            className={`rounded-2xl border p-6 flex flex-col ${
              highlighted
                ? 'border-teal-400/50 bg-teal-500/10'
                : 'border-white/10 bg-white/5'
            }`}>
            <h3 className="font-landing-display text-2xl tracking-tight mb-1">
              {plan.name}
            </h3>
            <p className="text-sm text-white/55 mb-4">{plan.description}</p>
            <p className="text-3xl font-semibold tracking-tight mb-1">
              {fmtDalasi(price)}
            </p>
            <p className="text-xs text-white/45 mb-1">
              {interval === 'quarterly' ? 'per quarter (3 months)' : 'per month'}
            </p>
            <p className="text-sm text-teal-200/90 mb-5">{plan.seatsLabel}</p>
            <ul className="space-y-2 text-sm text-white/65 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-teal-400 shrink-0">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {onPick && (
              <button
                type="button"
                onClick={onPick}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  highlighted
                    ? 'bg-teal-500 hover:bg-teal-400 text-[#061018]'
                    : 'border border-white/20 hover:border-white/40 text-white'
                }`}>
                Choose {plan.name}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function InfoPages({
  section,
  onSection,
  onBack,
  onRegister
}: InfoPagesProps) {
  const [catalogue, setCatalogue] = useState<PlansCatalogue | null>(null);
  const [interval, setInterval] = useState<'monthly' | 'quarterly'>('monthly');

  useEffect(() => {
    api.plans().then(setCatalogue).catch(() => setCatalogue(null));
  }, []);

  return (
    <div className="min-h-screen font-landing bg-[#061018] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 70% 10%, rgba(0,150,136,0.35), transparent 55%), radial-gradient(ellipse 60% 40% at 10% 80%, rgba(21,101,192,0.25), transparent 50%)'
        }}
      />

      <header className="relative z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 sm:px-10 lg:px-16 py-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />
            Home
          </button>
          <div className="hidden sm:flex items-center gap-2 ml-2">
            <BrandMark branding={BRANDING} />
            <span className="font-landing-display text-lg">Terrafi Pro</span>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1 sm:gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSection(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                section === s.id
                  ? 'bg-white/15 text-white'
                  : 'text-white/55 hover:text-white'
              }`}>
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="relative z-10 px-5 sm:px-10 lg:px-16 pb-20 pt-6 max-w-5xl mx-auto">
        {section === 'pricing' && (
          <div className="space-y-8">
            <div>
              <h1 className="font-landing-display text-4xl sm:text-5xl tracking-tight mb-3">
                Pricing
              </h1>
              <p className="text-white/60 max-w-2xl leading-relaxed">
                Three tiers for Gambian Dalasi (D), billed monthly or quarterly
                upfront. Upgrade anytime as your agent network grows.
              </p>
            </div>

            <div className="inline-flex p-1 rounded-lg bg-white/10 border border-white/10">
              {(['monthly', 'quarterly'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInterval(id)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                    interval === id
                      ? 'bg-teal-500 text-[#061018]'
                      : 'text-white/70 hover:text-white'
                  }`}>
                  {id}
                </button>
              ))}
            </div>

            {catalogue ? (
              <PlanCards
                plans={catalogue.plans}
                interval={interval}
                onPick={onRegister}
              />
            ) : (
              <p className="text-white/50 text-sm">Loading plans…</p>
            )}

            {catalogue && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/60 space-y-2">
                <p>{catalogue.policies.renewalNotice}</p>
                <p>{catalogue.policies.gracePeriod}</p>
              </div>
            )}
          </div>
        )}

        {section === 'terms' && (
          <article className="prose-invert space-y-5 max-w-3xl">
            <h1 className="font-landing-display text-4xl tracking-tight">
              Terms of Service
            </h1>
            <p className="text-white/55 text-sm">Last updated: July 2026</p>
            <p className="text-white/70 leading-relaxed">
              By registering for Terrafi Pro you agree that your organisation
              will use the platform for legitimate agent-network operations, keep
              account credentials secure, and pay subscription fees for the plan
              you select.
            </p>
            <h2 className="font-landing-display text-2xl pt-2">Accounts</h2>
            <p className="text-white/70 leading-relaxed">
              The network manager is responsible for inviting users, assigning
              roles, and ensuring team members follow applicable law and your
              internal policies. Seat limits on Basic and Standard plans apply to
              active and invited users.
            </p>
            <h2 className="font-landing-display text-2xl pt-2">
              Billing &amp; access
            </h2>
            <p className="text-white/70 leading-relaxed">
              Subscriptions are priced in Gambian Dalasi and may be paid monthly
              or quarterly. We notify managers about one week before a period
              ends. After the period ends, a seven-day grace period applies. If
              payment is still outstanding after grace, access is locked for all
              users except the network manager, who may sign in only to settle
              payment.
            </p>
            <h2 className="font-landing-display text-2xl pt-2">Acceptable use</h2>
            <p className="text-white/70 leading-relaxed">
              You must not misuse the service, attempt unauthorised access, or
              upload unlawful content. We may suspend organisations that violate
              these terms or that remain unpaid beyond the grace period.
            </p>
            <h2 className="font-landing-display text-2xl pt-2">Liability</h2>
            <p className="text-white/70 leading-relaxed">
              Terrafi Pro is provided to support operational workflows. You remain
              responsible for decisions made from platform data and for compliance
              with mobile-money and data-protection rules that apply to your
              business.
            </p>
          </article>
        )}

        {section === 'privacy' && (
          <article className="prose-invert space-y-5 max-w-3xl">
            <h1 className="font-landing-display text-4xl tracking-tight">
              Data Privacy
            </h1>
            <p className="text-white/55 text-sm">Last updated: July 2026</p>
            <p className="text-white/70 leading-relaxed">
              We process account, agent, visit, float, and KYC-related data so
              your organisation can operate its network. Each company&apos;s data
              is isolated in a multi-tenant workspace.
            </p>
            <h2 className="font-landing-display text-2xl pt-2">What we collect</h2>
            <p className="text-white/70 leading-relaxed">
              User profiles (name, email, role), agent and location records,
              visit and GPS check-in metadata, float and performance metrics,
              KYC document paths, audit logs, and billing subscription status.
            </p>
            <h2 className="font-landing-display text-2xl pt-2">How we use it</h2>
            <p className="text-white/70 leading-relaxed">
              Data is used to provide the product, send operational
              notifications (including renewal and grace notices), process
              payments via DirectPay/EasyPay, and improve reliability and
              security. We do not sell personal data.
            </p>
            <h2 className="font-landing-display text-2xl pt-2">Retention</h2>
            <p className="text-white/70 leading-relaxed">
              Data is retained while your organisation is active and as needed
              for legal, audit, and dispute purposes. Managers may request
              export or deletion assistance through the contact channels below.
            </p>
            <h2 className="font-landing-display text-2xl pt-2">Security</h2>
            <p className="text-white/70 leading-relaxed">
              Access is role-based. Passwords are hashed. Payment card data is
              handled by the payment provider, not stored on Terrafi Pro servers.
            </p>
          </article>
        )}

        {section === 'contact' && (
          <div className="max-w-xl space-y-6">
            <div>
              <h1 className="font-landing-display text-4xl tracking-tight mb-3">
                Contact
              </h1>
              <p className="text-white/60 leading-relaxed">
                Questions about plans, billing, onboarding, or privacy — reach
                the Terrafi Pro team.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-white/45 uppercase tracking-wide mb-1">
                    Email
                  </p>
                  <a
                    href={`mailto:${catalogue?.contact.email || 'support@terrafi.pro'}`}
                    className="text-teal-200 hover:text-teal-100">
                    {catalogue?.contact.email || 'support@terrafi.pro'}
                  </a>
                </div>
              </div>
              {catalogue?.contact.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-white/45 uppercase tracking-wide mb-1">
                      Phone
                    </p>
                    <a
                      href={`tel:${catalogue.contact.phone.replace(/\s/g, '')}`}
                      className="text-teal-200 hover:text-teal-100">
                      {catalogue.contact.phone}
                    </a>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-white/45 uppercase tracking-wide mb-1">
                    Location
                  </p>
                  <p className="text-white/80">
                    {catalogue?.contact.address || 'Banjul, The Gambia'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export { PlanCards };
