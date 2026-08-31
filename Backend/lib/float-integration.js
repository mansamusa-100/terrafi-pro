import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { decryptSecret, encryptSecret } from './secret-store.js';

export class FloatIntegrationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function generateFloatCredentials() {
  return {
    apiKey: crypto.randomBytes(32).toString('hex'),
    hmacSecret: crypto.randomBytes(32).toString('hex'),
    encryptionKey: crypto.randomBytes(32).toString('base64')
  };
}

function envFallbackCredentials(companyId) {
  const envCompanyId = process.env.PARTNER_AGENT_FLOAT_COMPANY_ID || 'co-aps';
  if (companyId !== envCompanyId) return null;

  const apiKey = process.env.PARTNER_AGENT_FLOAT_API_KEY?.trim();
  const hmacSecret = process.env.PARTNER_AGENT_FLOAT_HMAC_SECRET?.trim();
  const encryptionKey = process.env.PARTNER_AGENT_FLOAT_ENCRYPTION_KEY?.trim();
  if (!apiKey || !hmacSecret || !encryptionKey) return null;

  return { apiKey, hmacSecret, encryptionKey, source: 'env' };
}

function rowCredentials(row) {
  if (!row?.apiKeyEnc || !row?.hmacSecretEnc || !row?.encryptionKeyEnc) {
    return null;
  }
  return {
    apiKey: decryptSecret(row.apiKeyEnc),
    hmacSecret: decryptSecret(row.hmacSecretEnc),
    encryptionKey: decryptSecret(row.encryptionKeyEnc),
    bireportsOrganizationId: row.bireportsOrganizationId,
    source: 'database'
  };
}

export async function resolveFloatIntegration(partnerOrgCode) {
  const companyId = String(partnerOrgCode || '').trim();
  if (!companyId) {
    throw new FloatIntegrationError(
      400,
      'Missing X-BIReports-Partner-Org-Code header'
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true }
  });
  if (!company) {
    throw new FloatIntegrationError(404, 'Unknown partner org code');
  }

  const row = await prisma.companyFloatIntegration.findUnique({
    where: { companyId }
  });

  if (row && !row.enabled) {
    throw new FloatIntegrationError(
      403,
      'Float integration is disabled for this organization'
    );
  }

  const fromDb = rowCredentials(row);
  if (fromDb) {
    return { companyId, ...fromDb };
  }

  const fromEnv = envFallbackCredentials(companyId);
  if (fromEnv) {
    return { companyId, bireportsOrganizationId: null, ...fromEnv };
  }

  throw new FloatIntegrationError(
    503,
    'Float integration is not configured for this organization'
  );
}

export function validateBireportsOrganizationId(
  headerOrgId,
  storedOrgId
) {
  if (!storedOrgId) return;

  const received = String(headerOrgId || '').trim();
  if (!received) {
    throw new FloatIntegrationError(
      400,
      'Missing X-BIReports-Organization-Id header'
    );
  }
  if (received !== storedOrgId) {
    throw new FloatIntegrationError(403, 'Organization ID mismatch');
  }
}

export function ingestUrl() {
  const base = (
    process.env.APP_PUBLIC_URL ||
    process.env.FRONTEND_URL ||
    ''
  ).replace(/\/$/, '');
  if (!base) return null;
  return `${base}/api/agent-float`;
}

export async function getFloatIntegrationSettings(companyId) {
  const row = await prisma.companyFloatIntegration.findUnique({
    where: { companyId }
  });

  return {
    partner_org_code: companyId,
    bireports_organization_id: row?.bireportsOrganizationId ?? null,
    enabled: row?.enabled ?? true,
    configured: Boolean(row?.apiKeyEnc),
    ingest_url: ingestUrl(),
    updated_at: row?.updatedAt?.toISOString() ?? null
  };
}

export async function upsertFloatIntegrationSettings(companyId, body) {
  const data = {};

  if (body.bireports_organization_id !== undefined) {
    const value = String(body.bireports_organization_id || '').trim();
    data.bireportsOrganizationId = value || null;
  }

  if (body.enabled !== undefined) {
    data.enabled = Boolean(body.enabled);
  }

  const hasCredentialFields =
    body.api_key !== undefined ||
    body.hmac_secret !== undefined ||
    body.encryption_key !== undefined;

  if (hasCredentialFields) {
    const apiKey = String(body.api_key || '').trim();
    const hmacSecret = String(body.hmac_secret || '').trim();
    const encryptionKey = String(body.encryption_key || '').trim();
    if (!apiKey || !hmacSecret || !encryptionKey) {
      throw new Error(
        'api_key, hmac_secret, and encryption_key must all be provided together'
      );
    }
    const keyBytes = Buffer.from(encryptionKey, 'base64');
    if (keyBytes.length !== 32) {
      throw new Error('encryption_key must be base64-encoded 32 bytes');
    }
    data.apiKeyEnc = encryptSecret(apiKey);
    data.hmacSecretEnc = encryptSecret(hmacSecret);
    data.encryptionKeyEnc = encryptSecret(encryptionKey);
  }

  if (Object.keys(data).length === 0) {
    throw new Error('No float integration fields provided');
  }

  const row = await prisma.companyFloatIntegration.upsert({
    where: { companyId },
    create: { companyId, enabled: true, ...data },
    update: data
  });

  return getFloatIntegrationSettings(companyId).then((settings) => ({
    ...settings,
    updated_at: row.updatedAt.toISOString()
  }));
}

export async function generateAndStoreFloatCredentials(companyId) {
  const credentials = generateFloatCredentials();
  await upsertFloatIntegrationSettings(companyId, {
    api_key: credentials.apiKey,
    hmac_secret: credentials.hmacSecret,
    encryption_key: credentials.encryptionKey
  });
  return {
    ...(await getFloatIntegrationSettings(companyId)),
    credentials: {
      api_key: credentials.apiKey,
      hmac_secret: credentials.hmacSecret,
      encryption_key: credentials.encryptionKey
    }
  };
}
