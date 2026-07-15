/**
 * Terrafi Pro subscription plan catalogue (Gambian Dalasi, monthly).
 * Quarterly billing = 3 × monthly amount paid upfront for a 3‑month period.
 */

export const PLAN_TIERS = {
  basic: {
    id: 'basic',
    name: 'Basic',
    description: 'For growing agent networks getting started.',
    seats: 25,
    monthlyPriceGmd: 26590,
    features: [
      'Up to 25 team users',
      'Agent directory & network map',
      'Field visits & GPS check-in',
      'Float monitoring',
      'KYC compliance queue',
      'Email support'
    ]
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'For operators managing mid-size field teams.',
    seats: 50,
    monthlyPriceGmd: 31590,
    features: [
      'Up to 50 team users',
      'Everything in Basic',
      'Performance & ADR insights',
      'Bulk import & KYC tools',
      'Audit log',
      'Priority support'
    ]
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    description: 'For large networks with no seat ceiling.',
    seats: null,
    monthlyPriceGmd: 50590,
    features: [
      'Unlimited team users',
      'Everything in Standard',
      'Full platform capacity',
      'Dedicated onboarding help',
      'Priority support'
    ]
  }
};

export const PLAN_TIER_ORDER = ['basic', 'standard', 'unlimited'];

export const BILLING_INTERVALS = {
  monthly: {
    id: 'monthly',
    label: 'Monthly',
    months: 1,
    description: 'Billed every month'
  },
  quarterly: {
    id: 'quarterly',
    label: 'Quarterly',
    months: 3,
    description: 'Pay 3 months upfront'
  }
};

/** Map our tiers to DirectPay plan codes (override via env if needed). */
export function directPayPlanCodeForTier(tierId) {
  const envKey = `DIRECTPAY_PLAN_${String(tierId || '').toUpperCase()}`;
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  // Default: all tiers use CORPORATE payable path until DirectPay adds distinct codes.
  return process.env.DIRECTPAY_DEFAULT_PLAN_CODE?.trim() || 'CORPORATE';
}

export function getPlanTier(tierId) {
  const id = String(tierId || '').toLowerCase();
  return PLAN_TIERS[id] || null;
}

export function assertPlanTier(tierId) {
  const plan = getPlanTier(tierId);
  if (!plan) {
    const err = new Error('Invalid plan tier. Choose basic, standard, or unlimited.');
    err.status = 400;
    throw err;
  }
  return plan;
}

export function assertBillingInterval(intervalId) {
  const id = String(intervalId || 'monthly').toLowerCase();
  const interval = BILLING_INTERVALS[id];
  if (!interval) {
    const err = new Error('Invalid billing interval. Choose monthly or quarterly.');
    err.status = 400;
    throw err;
  }
  return interval;
}

export function priceFor(tierId, intervalId = 'monthly') {
  const plan = assertPlanTier(tierId);
  const interval = assertBillingInterval(intervalId);
  return plan.monthlyPriceGmd * interval.months;
}

export function nextUpgradeTiers(currentTierId) {
  const idx = PLAN_TIER_ORDER.indexOf(String(currentTierId || '').toLowerCase());
  if (idx < 0) return PLAN_TIER_ORDER.map((id) => PLAN_TIERS[id]);
  return PLAN_TIER_ORDER.slice(idx + 1).map((id) => PLAN_TIERS[id]);
}

export function canUpgradeTo(fromTier, toTier) {
  const from = PLAN_TIER_ORDER.indexOf(String(fromTier || '').toLowerCase());
  const to = PLAN_TIER_ORDER.indexOf(String(toTier || '').toLowerCase());
  return from >= 0 && to > from;
}

export function listPlansPublic() {
  return PLAN_TIER_ORDER.map((id) => {
    const p = PLAN_TIERS[id];
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      seats: p.seats,
      seatsLabel: p.seats == null ? 'Unlimited users' : `Up to ${p.seats} users`,
      monthlyPriceGmd: p.monthlyPriceGmd,
      quarterlyPriceGmd: p.monthlyPriceGmd * 3,
      features: p.features
    };
  });
}

export const RENEWAL_NOTICE_DAYS = 7;
export const GRACE_DAYS = 7;

export const LOCK_STATES = {
  OPEN: 'open',
  GRACE: 'grace',
  LOCKED: 'locked'
};
