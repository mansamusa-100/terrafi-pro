import crypto from 'node:crypto';

function masterKey() {
  const raw =
    process.env.FLOAT_INTEGRATION_MASTER_KEY?.trim() ||
    process.env.JWT_SECRET?.trim();
  if (!raw) {
    throw new Error(
      'FLOAT_INTEGRATION_MASTER_KEY or JWT_SECRET is required to store integration secrets'
    );
  }
  return crypto.createHash('sha256').update(raw).digest();
}

/** Encrypt a string for at-rest storage (AES-256-GCM). */
export function encryptSecret(plaintext) {
  const key = masterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/** Decrypt a value produced by encryptSecret. */
export function decryptSecret(ciphertextBase64) {
  const key = masterKey();
  const data = Buffer.from(ciphertextBase64, 'base64');
  if (data.length < 28) {
    throw new Error('Encrypted secret too short');
  }
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8'
  );
}
