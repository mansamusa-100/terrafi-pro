import crypto from 'node:crypto';

export function verifyBearer(authHeader, apiKey) {
  if (!apiKey) return false;
  const prefix = 'Bearer ';
  if (!authHeader?.startsWith(prefix)) return false;
  const token = authHeader.slice(prefix.length);
  if (token.length !== apiKey.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(apiKey));
}

export function verifySignature(rawBody, signatureHeader, hmacSecret) {
  if (!hmacSecret || !signatureHeader) return false;
  const expected = `sha256=${crypto
    .createHmac('sha256', hmacSecret)
    .update(rawBody)
    .digest('hex')}`;
  if (expected.length !== signatureHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

export function decryptPayload(ciphertextBase64, encryptionKeyBase64) {
  if (!encryptionKeyBase64) {
    throw new Error('Encryption key not configured');
  }
  const key = Buffer.from(encryptionKeyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (base64-encoded)');
  }

  const data = Buffer.from(ciphertextBase64, 'base64');
  if (data.length < 28) {
    throw new Error('Encrypted payload too short');
  }

  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
