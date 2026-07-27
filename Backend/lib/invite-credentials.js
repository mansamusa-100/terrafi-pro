import crypto from 'node:crypto';
import {
  getEmailConfig,
  sendInviteEmail,
  sendPasswordResetEmail
} from './email.js';

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
  return getEmailConfig().configured;
}

/**
 * Deliver credentials by email when Resend is configured; otherwise log to console.
 * Returns { credentialDelivery, emailConfigured, passwordReused, emailSent, emailError }.
 */
export async function deliverTemporaryCredentials({
  user,
  actor,
  company = null,
  temporaryPassword = null,
  passwordReused = false,
  purpose = 'invite'
}) {
  const emailConfigured = isEmailDeliveryConfigured();

  if (passwordReused) {
    if (emailConfigured) {
      const result = await sendInviteEmail({
        user,
        actor,
        company,
        temporaryPassword: null,
        passwordReused: true
      });
      if (result.ok) {
        return {
          credentialDelivery: 'reused_existing',
          emailConfigured: true,
          passwordReused: true,
          emailSent: true
        };
      }
      console.warn(
        '[credentials] reuse-notify email failed, continuing:',
        result.error
      );
    }
    logCredentialsToConsole({
      user,
      actor,
      company,
      temporaryPassword: null,
      passwordReused: true,
      purpose
    });
    return {
      credentialDelivery: 'reused_existing',
      emailConfigured,
      passwordReused: true,
      emailSent: false
    };
  }

  if (emailConfigured && temporaryPassword) {
    const result =
      purpose === 'password_reset'
        ? await sendPasswordResetEmail({
            user,
            actor,
            company,
            temporaryPassword
          })
        : await sendInviteEmail({
            user,
            actor,
            company,
            temporaryPassword,
            passwordReused: false
          });

    if (result.ok) {
      console.info(
        `[credentials] ${purpose} email sent to ${user.email} (id=${result.id || 'n/a'})`
      );
      return {
        credentialDelivery: 'email',
        emailConfigured: true,
        passwordReused: false,
        emailSent: true
      };
    }

    console.error(
      `[credentials] ${purpose} email failed for ${user.email}:`,
      result.error
    );
    logCredentialsToConsole({
      user,
      actor,
      company,
      temporaryPassword,
      passwordReused: false,
      purpose
    });
    return {
      credentialDelivery: 'log_only',
      emailConfigured: true,
      passwordReused: false,
      emailSent: false,
      emailError: result.error
    };
  }

  logCredentialsToConsole({
    user,
    actor,
    company,
    temporaryPassword,
    passwordReused: false,
    purpose
  });
  return {
    credentialDelivery: 'log_only',
    emailConfigured: false,
    passwordReused: false,
    emailSent: false
  };
}

function logCredentialsToConsole({
  user,
  actor,
  company,
  temporaryPassword,
  passwordReused,
  purpose
}) {
  const title =
    purpose === 'password_reset'
      ? 'Terrafi Pro — password reset'
      : 'Terrafi Pro — user invited';

  const lines = [
    '',
    '══════════════════════════════════════════════════════════',
    ` ${title}`,
    '══════════════════════════════════════════════════════════',
    `  Name:            ${user.name}`,
    `  Email:           ${user.email}`,
    `  Role:            ${user.role}`,
    passwordReused
      ? '  Credentials:     Existing password reused (notify other workspaces)'
      : `  Temporary password: ${temporaryPassword}`,
    `  User ID:         ${user.id}`,
    purpose === 'password_reset'
      ? `  Reset by:        ${actor.name} <${actor.email}>`
      : `  Invited by:      ${actor.name} <${actor.email}>`,
    company
      ? `  Company:         ${company.name} (${company.id})`
      : '  Company:         Platform',
    passwordReused
      ? '  User can switch workspace after signing in.'
      : purpose === 'password_reset'
        ? '  Share this temporary password with the user. They must set a new one on sign-in.'
        : '  Share these credentials with the user manually (email not configured or send failed).',
    '══════════════════════════════════════════════════════════',
    ''
  ];
  console.info(lines.join('\n'));
}

/**
 * Log-only helper (no send). Prefer deliverTemporaryCredentials.
 */
export function logTemporaryCredentials(opts) {
  const emailConfigured = isEmailDeliveryConfigured();
  const passwordReused = Boolean(opts.passwordReused);
  const credentialDelivery = passwordReused
    ? 'reused_existing'
    : emailConfigured
      ? 'email'
      : 'log_only';

  if (!emailConfigured || passwordReused) {
    logCredentialsToConsole({
      ...opts,
      purpose: opts.purpose || 'invite'
    });
  }

  return {
    credentialDelivery,
    emailConfigured,
    passwordReused
  };
}

/** @deprecated Use deliverTemporaryCredentials */
export function logInviteCredentials(opts) {
  return logTemporaryCredentials({ ...opts, purpose: 'invite' });
}
