import { verifyBearer, verifySignature, decryptPayload } from '../lib/bireports.js';
import {
  isDeliveryProcessed,
  mergeAgentFloatSnapshot
} from '../lib/float-ingest.js';
import {
  FloatIntegrationError,
  resolveFloatIntegration,
  validateBireportsOrganizationId
} from '../lib/float-integration.js';
import {
  FloatEnvelopeError,
  parseEnvelope,
  parseInnerPayload
} from '../lib/float-envelope.js';

export async function handleAgentFloatDelivery(req, res, next) {
  try {
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      return res.status(400).json({ message: 'Request body is required' });
    }

    const partnerOrgCode = req.headers['x-bireports-partner-org-code'];
    let integration;
    try {
      integration = await resolveFloatIntegration(partnerOrgCode);
    } catch (err) {
      if (err instanceof FloatIntegrationError) {
        return res.status(err.status).json({ message: err.message });
      }
      throw err;
    }

    try {
      validateBireportsOrganizationId(
        req.headers['x-bireports-organization-id'],
        integration.bireportsOrganizationId
      );
    } catch (err) {
      if (err instanceof FloatIntegrationError) {
        return res.status(err.status).json({ message: err.message });
      }
      throw err;
    }

    const { apiKey, hmacSecret, encryptionKey, companyId } = integration;

    if (!verifyBearer(req.headers.authorization, apiKey)) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    const signature = req.headers['x-bireports-signature'];
    if (!verifySignature(rawBody, signature, hmacSecret)) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    let envelopeJson;
    try {
      envelopeJson = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ message: 'Invalid JSON envelope' });
    }

    let envelope;
    try {
      envelope = parseEnvelope(envelopeJson);
    } catch (err) {
      if (err instanceof FloatEnvelopeError) {
        return res.status(err.status).json({ message: err.message });
      }
      throw err;
    }

    const headerDeliveryId = req.headers['x-bireports-delivery-id'];
    if (headerDeliveryId && headerDeliveryId !== envelope.deliveryId) {
      return res.status(400).json({ message: 'delivery_id header mismatch' });
    }

    if (await isDeliveryProcessed(envelope.deliveryId)) {
      return res.status(200).json({
        accepted: true,
        duplicate: true,
        company_id: companyId
      });
    }

    let innerJson;
    try {
      const plaintext = decryptPayload(envelope.encryptedPayload, encryptionKey);
      innerJson = JSON.parse(plaintext);
    } catch (err) {
      console.warn('[float-ingest] decrypt/parse failed:', err.message);
      return res.status(400).json({
        message: 'Failed to decrypt or parse payload'
      });
    }

    let inner;
    try {
      inner = parseInnerPayload(innerJson, envelope, companyId);
    } catch (err) {
      if (err instanceof FloatEnvelopeError) {
        return res.status(err.status).json({ message: err.message });
      }
      throw err;
    }

    const result = await mergeAgentFloatSnapshot({
      companyId,
      deliveryId: envelope.deliveryId,
      snapshotAt: inner.snapshotAt,
      agents: inner.agents
    });

    return res.status(200).json({
      accepted: true,
      delivery_id: envelope.deliveryId,
      company_id: companyId,
      schema_version: envelope.schemaVersion,
      ...result
    });
  } catch (err) {
    next(err);
  }
}
