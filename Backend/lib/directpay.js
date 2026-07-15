import crypto from 'node:crypto';
import { fromDirectPayBillingInterval, toDirectPayBillingInterval } from './plans.js';

/**
 * DirectPay / EasyPay internal-partner API client.
 *
 * Field-Pro is a partner app that provisions a DirectPay business per company
 * and drives a CORPORATE platform subscription. Subscription payment happens in
 * DirectPay (guest invoice checkout); Field-Pro only issues/reads the pay link
 * and reacts to subscription.updated webhooks.
 *
 * All Terrafi tiers (basic / standard / unlimited) map to DirectPay planCode
 * CORPORATE (or DIRECTPAY_DEFAULT_PLAN_CODE) so businesses start on the
 * payable Corporate path, typically in TRIALING.
 */

const ACTIVE_STATUSES = new Set(['TRIALING', 'ACTIVE', 'PAST_DUE']);
/** Collected platform MRR — only after payment (ACTIVE). Not during TRIALING. */
const MRR_STATUSES = new Set(['ACTIVE']);
const DIRECTPAY_TIMEOUT_MS = Number(process.env.DIRECTPAY_TIMEOUT_MS || 20000);

export function getDirectPayConfig() {
  const baseUrl = (process.env.DIRECTPAY_API_BASE_URL || '').replace(/\/$/, '');
  const apiSecret = (process.env.DIRECTPAY_INTERNAL_PARTNER_API_SECRET || '').trim();
  const publicAppUrl = (process.env.DIRECTPAY_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const webhookSecret = (process.env.DIRECTPAY_WEBHOOK_SECRET || '').trim() || null;
  // EasyPay only accepts partnerApp of "default" | "analytics-bi" | "vpay".
  // "analytics-bi" is the only value that yields a *payable* CORPORATE plan
  // (platformBillingWaived: false). Overridable once EasyPay adds "field-pro".
  const partnerApp = (process.env.DIRECTPAY_PARTNER_APP || 'analytics-bi').trim();

  return {
    baseUrl,
    apiSecret,
    publicAppUrl,
    webhookSecret,
    partnerApp,
    configured: Boolean(baseUrl && apiSecret)
  };
}

export function isSubscriptionAccessAllowed(status) {
  if (!status) return false;
  return ACTIVE_STATUSES.has(status);
}

export function isMrrEligibleStatus(status) {
  return Boolean(status && MRR_STATUSES.has(status));
}

export function buildGuestInvoicePayUrl(guestToken) {
  const token = guestToken?.trim();
  if (!token) return null;
  const { publicAppUrl } = getDirectPayConfig();
  if (!publicAppUrl) return null;
  return `${publicAppUrl}/#/guest/subscription-invoice/${encodeURIComponent(token)}`;
}

/** Parse a money value from DirectPay (string/number/nested) into major units. */
export function parseMoneyAmount(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === 'object') {
    return (
      parseMoneyAmount(value.amount) ??
      parseMoneyAmount(value.value) ??
      parseMoneyAmount(value.total) ??
      parseMoneyAmount(value.price)
    );
  }
  return null;
}

/**
 * Best-effort monthly subscription amount in Gambian Dalasi (integer major units).
 * Prefers pending invoice, then plan price fields; optional env fallback.
 */
export function extractSubscriptionMrrGmd(remote) {
  const plan = remote?.subscription?.plan;
  const invoice = remote?.pendingInvoice;
  const candidates = [
    invoice?.amount,
    invoice?.total,
    invoice?.totalAmount,
    plan?.amount,
    plan?.price,
    plan?.monthlyAmount,
    plan?.amountGmd,
    plan?.priceGmd,
    remote?.subscription?.amount,
    remote?.subscription?.price
  ];

  for (const c of candidates) {
    const n = parseMoneyAmount(c);
    if (n != null && n >= 0) return Math.round(n);
  }

  const fallback = Number(process.env.DIRECTPAY_CORPORATE_MRR_GMD || '');
  if (Number.isFinite(fallback) && fallback > 0) return Math.round(fallback);
  return null;
}

async function partnerJson(path, init = {}) {
  const { baseUrl, apiSecret, configured } = getDirectPayConfig();
  if (!configured) {
    const err = new Error('DirectPay partner API is not configured');
    err.code = 'DIRECTPAY_NOT_CONFIGURED';
    throw err;
  }

  const url = `${baseUrl}/api/internal-partner/v1${path.startsWith('/') ? path : `/${path}`}`;
  const method = init.method || 'GET';
  const headers = {
    Authorization: `Bearer ${apiSecret}`,
    Accept: 'application/json'
  };
  let body;
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIRECTPAY_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error(
        `DirectPay ${method} ${path} timed out after ${DIRECTPAY_TIMEOUT_MS}ms`
      );
      timeoutErr.code = 'DIRECTPAY_TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(
      `DirectPay ${method} ${path} failed: ${res.status} ${text.slice(0, 500)}`
    );
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export async function provisionBusiness(input) {
  const { partnerApp } = getDirectPayConfig();
  const json = await partnerJson('/provision', {
    method: 'POST',
    body: { ...input, partnerApp }
  });
  return json.data;
}

export async function getSubscription(businessId) {
  const json = await partnerJson(
    `/businesses/${encodeURIComponent(businessId)}/subscription`
  );
  return json.data;
}

export async function startSubscription(businessId, input = {}) {
  const planCode = input.planCode?.trim() || 'CORPORATE';
  const billingInterval = toDirectPayBillingInterval(
    input.billingInterval || 'monthly'
  );

  const json = await partnerJson(
    `/businesses/${encodeURIComponent(businessId)}/subscription`,
    {
      method: 'POST',
      body: {
        planCode,
        billingInterval
      }
    }
  );
  return json.data;
}

/**
 * Ensure a payable pending subscription invoice exists and return the
 * authoritative guest pay URL. Idempotent — returns the existing pending
 * invoice if one is already open. Throws { status: 409 } when nothing payable.
 */
export async function issuePayableInvoice(businessId) {
  const json = await partnerJson(
    `/businesses/${encodeURIComponent(businessId)}/subscription/invoices`,
    { method: 'POST', body: {} }
  );
  return json.data;
}

export function verifyWebhookSignature(rawBody, signatureHeader) {
  const { webhookSecret } = getDirectPayConfig();
  if (!webhookSecret || !signatureHeader?.trim()) return false;
  const expected = `sha256=${crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex')}`;
  const provided = signatureHeader.trim();
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}
