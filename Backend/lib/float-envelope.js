const SUPPORTED_SCHEMA_VERSIONS = new Set([1, 2]);

export class FloatEnvelopeError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Accept numeric or string schema versions from PrixBI. */
export function parseSchemaVersion(value) {
  if (value === 1 || value === '1') return 1;
  if (value === 2 || value === '2') return 2;
  return null;
}

function readOrganization(block) {
  if (!block || typeof block !== 'object') return null;
  const id = String(block.id ?? '').trim() || null;
  const partnerOrgCode =
    String(block.partner_org_code ?? block.partnerOrgCode ?? '').trim() || null;
  if (!id && !partnerOrgCode) return null;
  return { id, partnerOrgCode };
}

export function parseEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new FloatEnvelopeError(400, 'Invalid JSON envelope');
  }

  const schemaVersion = parseSchemaVersion(envelope.schema_version);
  if (!schemaVersion || !SUPPORTED_SCHEMA_VERSIONS.has(schemaVersion)) {
    throw new FloatEnvelopeError(
      400,
      `Unsupported schema_version: ${envelope.schema_version ?? '(missing)'}`
    );
  }

  const deliveryId = String(envelope.delivery_id ?? '').trim();
  const snapshotAt = envelope.snapshot_at;
  const recordCount = Number(envelope.record_count);
  const encryptedPayload = envelope.encrypted_payload;

  if (!deliveryId || !snapshotAt || !encryptedPayload) {
    throw new FloatEnvelopeError(400, 'Missing required envelope fields');
  }
  if (!Number.isInteger(recordCount) || recordCount < 0) {
    throw new FloatEnvelopeError(400, 'Invalid record_count');
  }

  return {
    schemaVersion,
    deliveryId,
    snapshotAt: String(snapshotAt),
    recordCount,
    encryptedPayload: String(encryptedPayload),
    organization: readOrganization(envelope.organization)
  };
}

export function parseInnerPayload(inner, envelope, companyId) {
  if (!inner || typeof inner !== 'object') {
    throw new FloatEnvelopeError(400, 'Invalid decrypted payload');
  }

  const schemaVersion = parseSchemaVersion(inner.schema_version);
  if (!schemaVersion || !SUPPORTED_SCHEMA_VERSIONS.has(schemaVersion)) {
    throw new FloatEnvelopeError(
      400,
      `Unsupported inner schema_version: ${inner.schema_version ?? '(missing)'}`
    );
  }

  const deliveryId = String(inner.delivery_id ?? '').trim();
  if (deliveryId !== envelope.deliveryId) {
    throw new FloatEnvelopeError(400, 'Inner delivery_id mismatch');
  }

  if (!Array.isArray(inner.agents)) {
    throw new FloatEnvelopeError(400, 'agents must be an array');
  }
  if (inner.agents.length !== envelope.recordCount) {
    throw new FloatEnvelopeError(400, 'Record count mismatch');
  }

  const innerOrg = readOrganization(inner.organization);
  if (envelope.organization && innerOrg) {
    if (
      envelope.organization.id &&
      innerOrg.id &&
      envelope.organization.id !== innerOrg.id
    ) {
      throw new FloatEnvelopeError(400, 'organization.id mismatch');
    }
    if (
      envelope.organization.partnerOrgCode &&
      innerOrg.partnerOrgCode &&
      envelope.organization.partnerOrgCode !== innerOrg.partnerOrgCode
    ) {
      throw new FloatEnvelopeError(400, 'organization.partner_org_code mismatch');
    }
  }

  const partnerOrgCode =
    innerOrg?.partnerOrgCode || envelope.organization?.partnerOrgCode;
  if (partnerOrgCode && partnerOrgCode !== companyId) {
    throw new FloatEnvelopeError(403, 'partner_org_code mismatch');
  }

  return {
    schemaVersion,
    snapshotAt: String(inner.snapshot_at || envelope.snapshotAt),
    agents: inner.agents
  };
}
