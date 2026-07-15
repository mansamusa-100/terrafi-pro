import { verifyWebhookSignature } from '../lib/directpay.js';
import { syncCompanySubscription } from '../lib/company-billing.js';
import { prisma } from '../lib/prisma.js';

/**
 * DirectPay / EasyPay outbound webhook receiver.
 * Mounted with a raw body parser BEFORE the JSON + JWT middleware so the HMAC
 * signature can be verified against the exact bytes DirectPay signed.
 *
 * On payment / activation events we re-sync subscription. Collected MRR is
 * applied only when synced status becomes ACTIVE (not TRIALING).
 *
 * Header: X-Easypay-Signature: sha256=<hmac>
 */
const SYNC_EVENTS = new Set([
  'subscription.updated',
  'subscription.created',
  'subscription.payment_succeeded',
  'subscription.activated',
  'subscription.renewed',
  'invoice.paid',
  'invoice.payment_succeeded',
  'invoice.updated',
  'payment.succeeded',
  'payment.completed',
  'payment.paid'
]);

function resolveExternalUserId(payload) {
  return (
    payload.partnerProvisioningExternalUserId?.trim() ||
    payload.externalUserId?.trim() ||
    payload.business?.externalUserId?.trim() ||
    payload.data?.partnerProvisioningExternalUserId?.trim() ||
    payload.data?.externalUserId?.trim() ||
    payload.data?.business?.externalUserId?.trim() ||
    null
  );
}

function resolveBusinessId(payload) {
  return (
    payload.businessId?.trim() ||
    payload.business?.id?.trim() ||
    payload.data?.businessId?.trim() ||
    payload.data?.business?.id?.trim() ||
    payload.subscription?.businessId?.trim() ||
    null
  );
}

export async function handleDirectPayWebhook(req, res, next) {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body ?? {});

    const signature =
      req.headers['x-easypay-signature'] || req.headers['x-bireports-signature'];

    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ message: 'Invalid webhook signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ message: 'Invalid JSON' });
    }

    const event = payload.event || payload.type || payload.name || '';
    // Empty event still syncs if we can resolve the company (some gateways omit type).
    if (event && !SYNC_EVENTS.has(event)) {
      console.info(`[webhook/directpay] ignored event ${event}`);
      return res.status(204).send();
    }

    const externalId = resolveExternalUserId(payload);
    const businessId = resolveBusinessId(payload);

    let company = null;
    if (externalId) {
      company = await prisma.company.findFirst({
        where: { id: externalId },
        select: { id: true, subscriptionStatus: true }
      });
    }
    if (!company && businessId) {
      company = await prisma.company.findFirst({
        where: { directPayBusinessId: businessId },
        select: { id: true, subscriptionStatus: true }
      });
    }

    if (!company) {
      console.warn(
        '[webhook/directpay] no company for',
        event || 'unknown',
        { externalId, businessId }
      );
      return res.status(204).send();
    }

    try {
      const before = company.subscriptionStatus;
      const subscription = await syncCompanySubscription(company.id);
      console.info(
        `[webhook/directpay] synced ${company.id} (${event || 'unknown'}): ${before || 'none'} → ${subscription.status || 'none'} mrr=${subscription.mrr ?? 0}`
      );
    } catch (err) {
      console.error('[webhook/directpay] sync failed:', err.message);
      return res.status(500).json({ message: 'Sync failed' });
    }

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}
