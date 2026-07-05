import { prisma } from './prisma.js';
import {
  buildGuestInvoicePayUrl,
  getDirectPayConfig,
  getSubscription,
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
    select: { directPayBusinessId: true }
  });
  if (!company?.directPayBusinessId) {
    throw new Error('Company is not provisioned in DirectPay');
  }

  const data = await issuePayableInvoice(company.directPayBusinessId);
  const payUrl =
    data.payUrl || buildGuestInvoicePayUrl(data.pendingInvoice?.guestToken);

  await prisma.company.update({
    where: { id: companyId },
    data: {
      subscriptionStatus: data.subscription?.status ?? undefined,
      subscriptionPlanCode: data.subscription?.plan?.code ?? undefined,
      subscriptionPayUrl: payUrl ?? undefined,
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
 * Returns the serialized subscription view.
 */
export async function syncCompanySubscription(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, directPayBusinessId: true }
  });
  if (!company) throw new Error('Company not found');

  if (!company.directPayBusinessId) {
    return {
      status: null,
      planCode: null,
      periodEnd: null,
      payUrl: null,
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
  const payUrl = buildGuestInvoicePayUrl(remote.pendingInvoice?.guestToken);

  await prisma.company.update({
    where: { id: companyId },
    data: {
      directPaySubscriptionId: sub?.id ?? null,
      subscriptionStatus: status,
      subscriptionPlanCode: planCode,
      subscriptionPeriodStart: periodStart ? new Date(periodStart) : null,
      subscriptionPeriodEnd: periodEnd ? new Date(periodEnd) : null,
      subscriptionBillingInterval: sub?.billingInterval ?? null,
      subscriptionPayUrl: payUrl,
      subscriptionSyncedAt: new Date()
    }
  });

  return {
    status,
    planCode,
    periodEnd,
    payUrl,
    accessAllowed: isSubscriptionAccessAllowed(status),
    provisioned: true
  };
}

export function cachedCompanySubscription(company) {
  return {
    status: company.subscriptionStatus ?? null,
    planCode: company.subscriptionPlanCode ?? null,
    periodStart: company.subscriptionPeriodStart?.toISOString() ?? null,
    periodEnd: company.subscriptionPeriodEnd?.toISOString() ?? null,
    billingInterval: company.subscriptionBillingInterval ?? null,
    payUrl: company.subscriptionPayUrl ?? null,
    syncedAt: company.subscriptionSyncedAt?.toISOString() ?? null,
    provisioned: Boolean(company.directPayBusinessId),
    accessAllowed: isSubscriptionAccessAllowed(company.subscriptionStatus)
  };
}
