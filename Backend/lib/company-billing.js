import { prisma } from './prisma.js';
import {
  buildGuestInvoicePayUrl,
  extractSubscriptionMrrGmd,
  getDirectPayConfig,
  getSubscription,
  isMrrEligibleStatus,
  isSubscriptionAccessAllowed,
  issuePayableInvoice,
  provisionBusiness,
  startSubscription
} from './directpay.js';

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
    accessAllowed: isSubscriptionAccessAllowed(
      overrides.status ?? company.subscriptionStatus
    )
  };
}

/**
 * Create the DirectPay business for a company (idempotent). Stores the
 * DirectPay ids on the company. Requires a billing owner email + name.
 */
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

/** Start the CORPORATE subscription for a provisioned company, then sync. */
export async function startCompanySubscription(companyId, opts = {}) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { directPayBusinessId: true }
  });
  if (!company?.directPayBusinessId) {
    throw new Error('Company is not provisioned in DirectPay');
  }
  await startSubscription(company.directPayBusinessId, {
    planCode: opts.planCode ?? 'CORPORATE',
    billingInterval: opts.billingInterval
  });
  return syncCompanySubscription(companyId);
}

/**
 * Ensure a payable subscription invoice exists and return its guest pay URL.
 * Uses the authoritative payUrl returned by DirectPay when available.
 */
export async function issueCompanyPayLink(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      directPayBusinessId: true,
      subscriptionPayUrl: true,
      mrr: true
    }
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

  await prisma.company.update({
    where: { id: companyId },
    data: {
      subscriptionStatus: data.subscription?.status ?? undefined,
      subscriptionPlanCode: data.subscription?.plan?.code ?? undefined,
      subscriptionPayUrl: payUrl ?? undefined,
      ...(invoiceAmount != null && invoiceAmount > 0
        ? { mrr: invoiceAmount }
        : {}),
      subscriptionSyncedAt: new Date()
    }
  });

  return {
    payUrl: payUrl ?? null,
    invoiceCreated: Boolean(data.invoiceCreated),
    pendingInvoice: data.pendingInvoice ?? null
  };
}

/**
 * Full self-service setup: provision -> start CORPORATE -> ensure pay link.
 * Best-effort: never throws (returns { ok, error }) so it can run inline during
 * company registration without blocking signup when DirectPay is unavailable.
 */
export async function setupCompanyBilling({ companyId, ownerEmail, ownerName }) {
  const { configured } = getDirectPayConfig();
  if (!configured) {
    return { ok: false, skipped: true, reason: 'not_configured' };
  }

  try {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return { ok: false, error: 'Company not found' };

    await provisionCompany(company, { ownerEmail, ownerName });
    await startCompanySubscription(companyId);
    const link = await issueCompanyPayLink(companyId).catch(() => null);

    return {
      ok: true,
      payUrl: link?.payUrl ?? null
    };
  } catch (err) {
    console.error('[billing] setupCompanyBilling failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Pull the latest subscription state from DirectPay and cache it on the company.
 * Returns the serialized subscription view (incl. MRR in Dalasi).
 */
export async function syncCompanySubscription(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      directPayBusinessId: true,
      subscriptionPayUrl: true,
      mrr: true,
      subscriptionStatus: true,
      subscriptionPlanCode: true,
      subscriptionPeriodStart: true,
      subscriptionPeriodEnd: true,
      subscriptionBillingInterval: true,
      subscriptionSyncedAt: true
    }
  });
  if (!company) throw new Error('Company not found');

  if (!company.directPayBusinessId) {
    return {
      status: null,
      planCode: null,
      periodEnd: null,
      payUrl: null,
      mrr: 0,
      accessAllowed: false,
      provisioned: false
    };
  }

  const remote = await getSubscription(company.directPayBusinessId);
  const sub = remote.subscription;
  const status = sub?.status ?? null;
  const planCode = sub?.plan?.code ?? null;
  const periodStart = sub?.currentPeriodStart ?? null;
  const periodEnd = sub?.currentPeriodEnd ?? null;
  const remotePayUrl =
    remote.payUrl ||
    buildGuestInvoicePayUrl(remote.pendingInvoice?.guestToken);
  const payUrl = remotePayUrl || company.subscriptionPayUrl || null;

  const extracted = extractSubscriptionMrrGmd(remote);
  let mrr = 0;
  if (isMrrEligibleStatus(status)) {
    mrr =
      extracted != null && extracted > 0
        ? extracted
        : company.mrr > 0
          ? company.mrr
          : 0;
  }

  const syncedAt = new Date();
  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      directPaySubscriptionId: sub?.id ?? null,
      subscriptionStatus: status,
      subscriptionPlanCode: planCode,
      subscriptionPeriodStart: periodStart ? new Date(periodStart) : null,
      subscriptionPeriodEnd: periodEnd ? new Date(periodEnd) : null,
      subscriptionBillingInterval: sub?.billingInterval ?? null,
      subscriptionPayUrl: payUrl,
      mrr,
      subscriptionSyncedAt: syncedAt
    }
  });

  return serializeSubscription(updated, {
    status,
    planCode,
    periodStart: periodStart ? new Date(periodStart).toISOString() : null,
    periodEnd: periodEnd ? new Date(periodEnd).toISOString() : null,
    billingInterval: sub?.billingInterval ?? null,
    payUrl,
    syncedAt: syncedAt.toISOString(),
    mrr
  });
}

export function cachedCompanySubscription(company) {
  return serializeSubscription(company);
}
