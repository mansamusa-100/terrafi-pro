import { verifyWebhookSignature } from '../lib/directpay.js';
import { syncCompanySubscription } from '../lib/company-billing.js';
import { prisma } from '../lib/prisma.js';

/**
 * DirectPay / EasyPay outbound webhook receiver.
 * Mounted with a raw body parser BEFORE the JSON + JWT middleware so the HMAC
 * signature can be verified against the exact bytes DirectPay signed.
 *
 * Events handled: subscription.updated and related payment/invoice events.
 * Header: X-Easypay-Signature: sha256=<hmac>
 */
const SYNC_EVENTS = new Set([
  'subscription.updated',
  'subscription.payment_succeeded',
  'subscription.activated',
  'invoice.paid',
  'invoice.payment_succeeded',
  'payment.succeeded',
  'payment.completed'
]);

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

    const event = payload.event || payload.type || '';
    if (event && !SYNC_EVENTS.has(event)) {
      return res.status(204).send();
    }

    const externalId =
      payload.partnerProvisioningExternalUserId?.trim() ||
      payload.externalUserId?.trim() ||
      payload.business?.externalUserId?.trim() ||
      null;

    if (!externalId) {
      console.warn('[webhook/directpay] missing external user id for', event);
      return res.status(204).send();
    }

    const company = await prisma.company.findFirst({
      where: { id: externalId },
      select: { id: true }
    });
    if (!company) {
      return res.status(204).send();
    }

    try {
      await syncCompanySubscription(company.id);
      console.info(`[webhook/directpay] synced ${company.id} (${event || 'unknown'})`);
    } catch (err) {
      console.error('[webhook/directpay] sync failed:', err.message);
      return res.status(500).json({ message: 'Sync failed' });
    }

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}
