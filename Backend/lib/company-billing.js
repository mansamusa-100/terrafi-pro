import { prisma } from './prisma.js';
import {
  buildGuestInvoicePayUrl,
  extractSubscriptionMrrGmd,
  getDirectPayConfig,
  getSubscription,
  isMrrEligibleStatus,
  issuePayableInvoice,
  provisionBusiness,
  startSubscription
} from './directpay.js';
import {
  assertBillingInterval,
  assertPlanTier,
  canUpgradeTo,
  directPayPlanCodeForTier,
  fromDirectPayBillingInterval,
  getPlanTier
} from './plans.js';
import {
  applySubscriptionLifecycle,
  clearSubscriptionLock,
  subscriptionViewExtras
} from './subscription-lifecycle.js';

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function webhookUrl() {
  const base = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
  if (!base) return null;
  return `${base}/api/webhooks/directpay`;
}

function serializeSubscription(company, overrides = {}) {
  const merged = { ...company, ...overrides };
  const extras = subscriptionViewExtras(merged);
  return {
    status: overrides.status ?? company.subscriptionStatus ?? null,
    planCode: overrides.planCode ?? company.subscriptionPlanCode ?? null,
    periodStart:
      overrides.periodStart ??
      company.subscriptionPeriodStart?.toISOString?.() ??
      company.subscriptionPeriodStart ??
      null,
    periodEnd:
      overrides.periodEnd ??
      company.subscriptionPeriodEnd?.toISOString?.() ??
      company.subscriptionPeriodEnd ??
      null,
    billingInterval:
      overrides.billingInterval ?? company.subscriptionBillingInterval ?? null,
    payUrl: overrides.payUrl ?? company.subscriptionPayUrl ?? null,
    syncedAt:
      overrides.syncedAt ??
      company.subscriptionSyncedAt?.toISOString?.() ??
      company.subscriptionSyncedAt ??
      null,
    mrr: overrides.mrr ?? company.mrr ?? 0,
    provisioned: Boolean(company.directPayBusinessId),
    ...extras,
    accessAllowed:
      overrides.accessAllowed !== undefined
        ? overrides.accessAllowed
        : extras.accessAllowed
  };
}

export async function provisionCompany(company, { ownerEmail, ownerName }) {
  if (company.directPayBusinessId) {
    return {
      businessId: company.directPayBusinessId,
      slug: company.directPaySlug,
      idempotentReplay: true
    };
  }

  const data = await provisionBusiness({
    externalUserId: company.id,
    ownerEmail,
    ownerName,
    businessName: company.name,
    slug: slugify(company.name),
    industry: 'Corporate',
    webhookUrl: webhookUrl()
  });

  await prisma.company.update({
    where: { id: company.id },
    data: {
      directPayBusinessId: data.businessId,
      directPaySlug: data.slug,
      directPaySubscriptionId: data.subscriptionId ?? null
    }
  });

  return data;
}

export async function applyPlanTierToCompany(
  companyId,
  tierId,
  intervalId = 'monthly'
) {
  const plan = assertPlanTier(tierId);
  const interval = assertBillingInterval(intervalId);
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionStatus: true, mrr: true }
  });
  // Collected MRR only when subscription is ACTIVE (paid). Plan price is separate.
  const mrrPatch =
    company?.subscriptionStatus === 'ACTIVE'
      ? { mrr: plan.monthlyPriceGmd }
      : { mrr: 0 };

  return prisma.company.update({
    where: { id: companyId },
    data: {
      plan: plan.name,
      planTier: plan.id,
      userSeats: plan.seats,
      subscriptionBillingInterval: interval.id,
      subscriptionPlanCode: directPayPlanCodeForTier(plan.id),
      ...mrrPatch
    }
  });
}

export async function startCompanySubscription(companyId, opts = {}) {
  const company = await prisma.company.findUnique({
    where: { id: companyId }
  });
  if (!company?.directPayBusinessId) {
    throw new Error('Company is not provisioned in DirectPay');
  }

  const tierId = opts.planTier || company.planTier || 'standard';
  const intervalId =
    opts.billingInterval || company.subscriptionBillingInterval || 'monthly';
  await applyPlanTierToCompany(companyId, tierId, intervalId);

  const planCode = opts.planCode || directPayPlanCodeForTier(tierId);

  // Always CORPORATE (or mapped code) + uppercase DirectPay interval (MONTHLY/QUARTERLY)
  await startSubscription(company.directPayBusinessId, {
    planCode,
    billingInterval: intervalId
  });
  return syncCompanySubscription(companyId);
}

export async function issueCompanyPayLink(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId }
  });
  if (!company?.directPayBusinessId) {
    throw new Error('Company is not provisioned in DirectPay');
  }

  const data = await issuePayableInvoice(company.directPayBusinessId);
  const payUrl =
    data.payUrl ||
    buildGuestInvoicePayUrl(data.pendingInvoice?.guestToken) ||
    company.subscriptionPayUrl ||
    null;

  const invoiceAmount = extractSubscriptionMrrGmd({
    pendingInvoice: data.pendingInvoice,
    subscription: data.subscription
  });
  const status = data.subscription?.status ?? company.subscriptionStatus ?? null;
  const plan = getPlanTier(company.planTier);

  // Do not count MRR from invoice/plan while still TRIALING.
  const mrrPatch = isMrrEligibleStatus(status)
    ? {
        mrr:
          invoiceAmount != null && invoiceAmount > 0
            ? invoiceAmount
            : plan?.monthlyPriceGmd || company.mrr || 0
      }
    : { mrr: 0 };

  await prisma.company.update({
    where: { id: companyId },
    data: {
      subscriptionStatus: status ?? undefined,
      subscriptionPlanCode: data.subscription?.plan?.code ?? undefined,
      subscriptionPayUrl: payUrl ?? undefined,
      ...mrrPatch,
      subscriptionSyncedAt: new Date()
    }
  });

  return {
    payUrl: payUrl ?? null,
    invoiceCreated: Boolean(data.invoiceCreated),
    pendingInvoice: data.pendingInvoice ?? null
  };
}

export async function setupCompanyBilling({
  companyId,
  ownerEmail,
  ownerName,
  planTier = 'standard',
  billingInterval = 'monthly'
}) {
  const { configured } = getDirectPayConfig();
  if (!configured) {
    return { ok: false, skipped: true, reason: 'not_configured' };
  }

  try {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return { ok: false, error: 'Company not found' };

    await applyPlanTierToCompany(companyId, planTier, billingInterval);
    await provisionCompany(company, { ownerEmail, ownerName });
    // CORPORATE + MONTHLY/QUARTERLY — DirectPay typically starts TRIALING.
    await startCompanySubscription(companyId, { planTier, billingInterval });
    // During TRIALING there is often no payable invoice yet — ignore 409.
    const link = await issueCompanyPayLink(companyId).catch((err) => {
      if (err.status === 409) return null;
      console.warn('[billing] pay-link after setup:', err.message);
      return null;
    });

    return {
      ok: true,
      payUrl: link?.payUrl ?? null
    };
  } catch (err) {
    console.error('[billing] setupCompanyBilling failed:', err.message);
    return { ok: false, error: err.message };
  }
}

export async function upgradeCompanyPlan(companyId, toTier, billingInterval) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error('Company not found');
  const from = company.planTier || 'standard';
  if (!canUpgradeTo(from, toTier)) {
    const err = new Error(
      `Cannot upgrade from ${from} to ${toTier}. Choose a higher tier.`
    );
    err.status = 400;
    throw err;
  }
  const interval =
    billingInterval || company.subscriptionBillingInterval || 'monthly';
  await applyPlanTierToCompany(companyId, toTier, interval);
  if (company.directPayBusinessId) {
    await startCompanySubscription(companyId, {
      planTier: toTier,
      billingInterval: interval
    });
    await issueCompanyPayLink(companyId).catch(() => null);
  }
  return syncCompanySubscription(companyId);
}

export async function syncCompanySubscription(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId }
  });
  if (!company) throw new Error('Company not found');

  if (!company.directPayBusinessId) {
    return serializeSubscription(company, {
      status: null,
      planCode: null,
      periodEnd: null,
      payUrl: null,
      mrr: company.mrr || 0,
      accessAllowed: true,
      provisioned: false
    });
  }

  const remote = await getSubscription(company.directPayBusinessId);
  const sub = remote.subscription;
  const status = sub?.status ?? null;
  const planCode = sub?.plan?.code ?? company.subscriptionPlanCode ?? null;
  const periodStart = sub?.currentPeriodStart ?? null;
  const periodEnd = sub?.currentPeriodEnd ?? null;
  const remotePayUrl =
    remote.payUrl ||
    buildGuestInvoicePayUrl(remote.pendingInvoice?.guestToken);
  const payUrl = remotePayUrl || company.subscriptionPayUrl || null;

  const extracted = extractSubscriptionMrrGmd(remote);
  const plan = getPlanTier(company.planTier);
  const previousStatus = company.subscriptionStatus;
  // Collected MRR only when DirectPay reports ACTIVE (paid), not TRIALING.
  let mrr = 0;
  if (isMrrEligibleStatus(status)) {
    mrr =
      extracted != null && extracted > 0
        ? extracted
        : plan?.monthlyPriceGmd || 0;
  }

  const syncedAt = new Date();
  const remoteInterval = fromDirectPayBillingInterval(sub?.billingInterval);
  let updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      directPaySubscriptionId: sub?.id ?? null,
      subscriptionStatus: status,
      subscriptionPlanCode: planCode,
      subscriptionPeriodStart: periodStart ? new Date(periodStart) : null,
      subscriptionPeriodEnd: periodEnd ? new Date(periodEnd) : null,
      subscriptionBillingInterval:
        remoteInterval ?? company.subscriptionBillingInterval ?? null,
      subscriptionPayUrl: payUrl,
      mrr,
      subscriptionSyncedAt: syncedAt
    }
  });

  if (
    previousStatus !== 'ACTIVE' &&
    status === 'ACTIVE' &&
    mrr > 0
  ) {
    console.info(
      `[billing] MRR collected for ${companyId}: D ${mrr} (status ${previousStatus || 'none'} → ACTIVE)`
    );
  }

  if (status === 'ACTIVE' || status === 'TRIALING') {
    updated = await clearSubscriptionLock(companyId);
  } else {
    await applySubscriptionLifecycle(companyId, { notify: true });
    updated = await prisma.company.findUnique({ where: { id: companyId } });
  }

  return serializeSubscription(updated, {
    status: updated.subscriptionStatus,
    planCode: updated.subscriptionPlanCode,
    periodStart: updated.subscriptionPeriodStart?.toISOString() ?? null,
    periodEnd: updated.subscriptionPeriodEnd?.toISOString() ?? null,
    billingInterval: updated.subscriptionBillingInterval,
    payUrl: updated.subscriptionPayUrl,
    syncedAt: syncedAt.toISOString(),
    mrr: updated.mrr
  });
}

export function cachedCompanySubscription(company) {
  return serializeSubscription(company);
}

/** Count seats used by active/invited company users. */
export async function countCompanySeatsUsed(companyId) {
  return prisma.user.count({
    where: {
      companyId,
      status: { in: ['active', 'invited'] }
    }
  });
}

export async function assertCompanyHasSeatCapacity(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { planTier: true, userSeats: true, plan: true }
  });
  if (!company) {
    const err = new Error('Company not found');
    err.status = 404;
    throw err;
  }
  const plan = getPlanTier(company.planTier);
  const seats = company.userSeats ?? plan?.seats ?? null;
  if (seats == null) return { seats: null, used: null };

  const used = await countCompanySeatsUsed(companyId);
  if (used >= seats) {
    const err = new Error(
      `Your ${plan?.name || company.plan || 'current'} plan allows up to ${seats} users. Upgrade to add more.`
    );
    err.status = 403;
    err.code = 'SEAT_LIMIT';
    throw err;
  }
  return { seats, used };
}
