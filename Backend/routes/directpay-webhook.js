import { verifyWebhookSignature } from '../lib/directpay.js';
import { syncCompanySubscription } from '../lib/company-billing.js';
import { prisma } from '../lib/prisma.js';

/**
 * DirectPay / EasyPay outbound webhook receiver.
 * Mounted with a raw body parser BEFORE the JSON + JWT middleware so the HMAC
 * signature can be verified against the exact bytes DirectPay signed.
 *
 * Event handled: subscription.updated
 * Header: X-Easypay-Signature: sha256=<hmac>
 */
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

    if (payload.event !== 'subscription.updated') {
      return res.status(204).send();
    }

    const externalId = payload.partnerProvisioningExternalUserId?.trim();
    if (!externalId) {
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
    } catch (err) {
      console.error('[webhook/directpay] sync failed:', err.message);
      return res.status(500).json({ message: 'Sync failed' });
    }

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}
