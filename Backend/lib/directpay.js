import crypto from 'node:crypto';

/**
 * DirectPay / EasyPay internal-partner API client.
 *
 * Field-Pro is a partner app that provisions a DirectPay business per company
 * and drives a CORPORATE platform subscription. Subscription payment happens in
 * DirectPay (guest invoice checkout); Field-Pro only issues/reads the pay link
 * and reacts to subscription.updated webhooks.
 */

const ACTIVE_STATUSES = new Set(['TRIALING', 'ACTIVE', 'PAST_DUE']);

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

export function buildGuestInvoicePayUrl(guestToken) {
  const token = guestToken?.trim();
  if (!token) return null;
  const { publicAppUrl } = getDirectPayConfig();
  if (!publicAppUrl) return null;
  return `${publicAppUrl}/#/guest/subscription-invoice/${encodeURIComponent(token)}`;
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

  const res = await fetch(url, { method, headers, body });
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
  const json = await partnerJson(
    `/businesses/${encodeURIComponent(businessId)}/subscription`,
    {
      method: 'POST',
      body: {
        planCode: input.planCode ?? 'CORPORATE',
        billingInterval: input.billingInterval
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
