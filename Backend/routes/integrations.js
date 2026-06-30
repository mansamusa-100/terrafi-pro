import { verifyBearer, verifySignature, decryptPayload } from '../lib/bireports.js';
import {
  isDeliveryProcessed,
  mergeAgentFloatSnapshot
} from '../lib/float-ingest.js';

function integrationConfig() {
  const apiKey = process.env.PARTNER_AGENT_FLOAT_API_KEY;
  const hmacSecret = process.env.PARTNER_AGENT_FLOAT_HMAC_SECRET;
  const encryptionKey = process.env.PARTNER_AGENT_FLOAT_ENCRYPTION_KEY;
  const companyId = process.env.PARTNER_AGENT_FLOAT_COMPANY_ID || 'co-aps';

  return { apiKey, hmacSecret, encryptionKey, companyId };
}

function configError(res) {
  return res.status(503).json({
    message: 'Float integration is not configured on this server'
  });
}

export async function handleAgentFloatDelivery(req, res, next) {
  try {
    const { apiKey, hmacSecret, encryptionKey, companyId } = integrationConfig();

    if (!apiKey || !hmacSecret || !encryptionKey) {
      return configError(res);
    }

    if (!verifyBearer(req.headers.authorization, apiKey)) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      return res.status(400).json({ message: 'Request body is required' });
    }

    const signature = req.headers['x-bireports-signature'];
    if (!verifySignature(rawBody, signature, hmacSecret)) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    let envelope;
    try {
      envelope = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ message: 'Invalid JSON envelope' });
    }

    const {
      schema_version: schemaVersion,
      delivery_id: deliveryId,
      snapshot_at: snapshotAt,
      record_count: recordCount,
      encrypted_payload: encryptedPayload
    } = envelope;

    if (schemaVersion !== 1) {
      return res.status(400).json({ message: 'Unsupported schema_version' });
    }
    if (!deliveryId || !snapshotAt || !encryptedPayload) {
      return res.status(400).json({ message: 'Missing required envelope fields' });
    }

    const headerDeliveryId = req.headers['x-bireports-delivery-id'];
    if (headerDeliveryId && headerDeliveryId !== deliveryId) {
      return res.status(400).json({ message: 'delivery_id header mismatch' });
    }

    if (await isDeliveryProcessed(deliveryId)) {
      return res.status(200).json({ accepted: true, duplicate: true });
    }

    let inner;
    try {
      const plaintext = decryptPayload(encryptedPayload, encryptionKey);
      inner = JSON.parse(plaintext);
    } catch (err) {
      return res.status(400).json({
        message: 'Failed to decrypt or parse payload',
        detail: err.message
      });
    }

    if (inner.schema_version !== 1) {
      return res.status(400).json({ message: 'Unsupported inner schema_version' });
    }
    if (inner.delivery_id !== deliveryId) {
      return res.status(400).json({ message: 'Inner delivery_id mismatch' });
    }
    if (!Array.isArray(inner.agents)) {
      return res.status(400).json({ message: 'agents must be an array' });
    }
    if (inner.agents.length !== recordCount) {
      return res.status(400).json({ message: 'Record count mismatch' });
    }

    const result = await mergeAgentFloatSnapshot({
      companyId,
      deliveryId,
      snapshotAt: inner.snapshot_at || snapshotAt,
      agents: inner.agents
    });

    return res.status(200).json({
      accepted: true,
      delivery_id: deliveryId,
      ...result
    });
  } catch (err) {
    next(err);
  }
}
