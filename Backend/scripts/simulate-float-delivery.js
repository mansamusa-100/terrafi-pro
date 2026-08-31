/**
 * Send a test float delivery to the local API (for development).
 * Run: node scripts/simulate-float-delivery.js
 *
 * Requires PARTNER_AGENT_FLOAT_* env vars and seeded agents with phoneNormalized.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';

const API_URL =
  process.env.PARTNER_AGENT_FLOAT_API_URL ||
  `http://localhost:${process.env.PORT || 3001}/api/integrations/agent-float`;

const API_KEY = process.env.PARTNER_AGENT_FLOAT_API_KEY;
const HMAC_SECRET = process.env.PARTNER_AGENT_FLOAT_HMAC_SECRET;
const ENCRYPTION_KEY_B64 = process.env.PARTNER_AGENT_FLOAT_ENCRYPTION_KEY;
const COMPANY_ID = process.env.PARTNER_AGENT_FLOAT_COMPANY_ID || 'co-aps';
const BI_ORG_ID = process.env.PARTNER_AGENT_FLOAT_BIREPORTS_ORG_ID || '';

function encryptPayload(plaintext, keyB64) {
  const key = Buffer.from(keyB64, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

async function main() {
  if (!API_KEY || !HMAC_SECRET || !ENCRYPTION_KEY_B64) {
    console.error('Set PARTNER_AGENT_FLOAT_API_KEY, HMAC_SECRET, and ENCRYPTION_KEY in .env');
    process.exit(1);
  }

  const agents = await prisma.agent.findMany({
    where: { companyId: COMPANY_ID, phoneNormalized: { not: null } },
    take: 5,
    select: { phoneNormalized: true, efloat: true }
  });

  if (agents.length === 0) {
    console.error('No agents with phoneNormalized. Run: node scripts/backfill-phone-normalized.js');
    process.exit(1);
  }

  const deliveryId = crypto.randomUUID();
  const snapshotAt = new Date().toISOString();
  const innerAgents = agents.map((a) => ({
    agent_number: a.phoneNormalized,
    after_balance: (a.efloat + 500).toFixed(2),
    balance_as_of: snapshotAt
  }));

  const inner = {
    schema_version: 1,
    delivery_id: deliveryId,
    snapshot_at: snapshotAt,
    agents: innerAgents
  };

  const envelope = {
    schema_version: 1,
    delivery_id: deliveryId,
    snapshot_at: snapshotAt,
    record_count: innerAgents.length,
    algorithm: 'aes-256-gcm',
    encrypted_payload: encryptPayload(JSON.stringify(inner), ENCRYPTION_KEY_B64)
  };

  const rawBody = JSON.stringify(envelope);
  const signature = `sha256=${crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(rawBody)
    .digest('hex')}`;

  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'X-BIReports-Delivery-Id': deliveryId,
    'X-BIReports-Partner-Org-Code': COMPANY_ID,
    'X-BIReports-Signature': signature
  };
  if (BI_ORG_ID) {
    headers['X-BIReports-Organization-Id'] = BI_ORG_ID;
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: rawBody
  });

  const text = await res.text();
  console.log(res.status, text);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
