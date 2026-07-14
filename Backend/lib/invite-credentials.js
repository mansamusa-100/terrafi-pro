import crypto from 'node:crypto';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Readable one-time password for invited users (no ambiguous 0/O/1/l). */
export function generateTemporaryPassword(length = 10) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CHARSET[bytes[i] % CHARSET.length];
  }
  return out;
}

/** True when an outbound email provider is configured on this server. */
export function isEmailDeliveryConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() ||
      process.env.EMAIL_PROVIDER?.trim() ||
      process.env.RESEND_API_KEY?.trim()
  );
}

/**
 * Log invite credentials to the server console when email cannot deliver them.
 * Also returns metadata for audit / API responses.
 */
export function logInviteCredentials({
  user,
  actor,
  company = null,
  temporaryPassword = null,
  passwordReused = false
}) {
  const emailConfigured = isEmailDeliveryConfigured();
  const credentialDelivery = passwordReused
    ? 'reused_existing'
    : emailConfigured
      ? 'email'
      : 'log_only';

  if (!emailConfigured || passwordReused) {
    const lines = [
      '',
      '══════════════════════════════════════════════════════════',
      ' Terrafi Pro — user invited',
      '══════════════════════════════════════════════════════════',
      `  Name:            ${user.name}`,
      `  Email:           ${user.email}`,
      `  Role:            ${user.role}`,
      passwordReused
        ? '  Credentials:     Existing password reused (notify other workspaces)'
        : `  Temporary password: ${temporaryPassword}`,
      `  User ID:         ${user.id}`,
      `  Invited by:      ${actor.name} <${actor.email}>`,
      company
        ? `  Company:         ${company.name} (${company.id})`
        : '  Company:         Platform',
      passwordReused
        ? '  User can switch workspace after signing in.'
        : '  Share these credentials with the user manually.',
      '══════════════════════════════════════════════════════════',
      ''
    ];
    console.info(lines.join('\n'));
  }

  return {
    credentialDelivery,
    emailConfigured,
    passwordReused
  };
}
