import { Resend } from 'resend';

/**
 * Outbound email via Resend.
 * Requires RESEND_API_KEY and a verified domain on the From address.
 *
 * Prefer separate vars in Coolify (angle brackets break some env UIs):
 *   RESEND_FROM_EMAIL=info@tarafipro.com
 *   RESEND_FROM_NAME=Terrafi Pro
 * Or a full RFC string:
 *   RESEND_FROM_EMAIL=Terrafi Pro <info@tarafipro.com>
 */

let client = null;

const EMAIL_RE = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

/** Strip quotes / normalize `Name <email>` or bare email for Resend. */
export function normalizeFromAddress(raw, displayName = '') {
  let value = String(raw || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();

  // Already Name <email@domain>
  const named = value.match(/^(.+?)\s*<([^>]+)>$/);
  if (named) {
    const name = named[1].trim().replace(/^['"]|['"]$/g, '');
    const email = named[2].trim();
    if (!EMAIL_RE.test(email)) {
      throw new Error(`Invalid from email address: ${email}`);
    }
    return name ? `${name} <${email}>` : email;
  }

  // Bare email
  if (EMAIL_RE.test(value)) {
    const name = String(displayName || '')
      .trim()
      .replace(/^['"]|['"]$/g, '');
    return name ? `${name} <${value}>` : value;
  }

  throw new Error(
    `Invalid RESEND_FROM_EMAIL "${raw}". Use info@tarafipro.com or set RESEND_FROM_NAME + RESEND_FROM_EMAIL.`
  );
}

export function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || '';
  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() || 'info@reset.phantommetrics.gm';
  const fromName =
    process.env.RESEND_FROM_NAME?.trim() || 'Terrafi Pro';

  let from = 'Terrafi Pro <info@reset.phantommetrics.gm>';
  try {
    from = normalizeFromAddress(fromEmail, fromName);
  } catch (err) {
    console.error('[email]', err.message);
  }

  const appUrl = (
    process.env.FRONTEND_URL ||
    process.env.APP_PUBLIC_URL ||
    ''
  ).replace(/\/$/, '');

  return {
    apiKey,
    from,
    appUrl,
    configured: Boolean(apiKey)
  };
}

function getResend() {
  const { apiKey, configured } = getEmailConfig();
  if (!configured) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function roleLabel(role) {
  const labels = {
    system_owner: 'Platform owner',
    platform_staff: 'Platform staff',
    manager: 'Network manager',
    internal: 'Internal staff',
    team_lead: 'Team lead',
    adr: 'ADR',
    agent: 'Agent',
    teller: 'Teller'
  };
  return labels[role] || role;
}

function layout({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:#0f172a;padding:20px 24px;">
              <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.02em;">Terrafi Pro</div>
              <div style="color:#94a3b8;font-size:12px;margin-top:4px;">Agent Network Management</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5;">
              This message was sent by Terrafi Pro. If you did not expect it, you can ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function signInBlock(appUrl) {
  if (!appUrl) {
    return `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#334155;">
      Sign in to Terrafi Pro with your email and the temporary password above, then set a new personal password.
    </p>`;
  }
  return `<p style="margin:24px 0 0;">
    <a href="${escapeHtml(appUrl)}"
       style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600;">
      Sign in to Terrafi Pro
    </a>
  </p>
  <p style="margin:12px 0 0;font-size:12px;color:#64748b;">
    Or open <a href="${escapeHtml(appUrl)}" style="color:#0f766e;">${escapeHtml(appUrl)}</a>
  </p>`;
}

/**
 * Low-level send. Returns { ok, id?, error? }.
 * Never throws — callers decide fallback behaviour.
 */
export async function sendEmail({ to, subject, html, text }) {
  const resend = getResend();
  const { from, configured } = getEmailConfig();
  if (!configured || !resend) {
    return { ok: false, skipped: true, error: 'not_configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text
    });
    if (error) {
      console.error(
        '[email] Resend error:',
        error.message || error,
        `(from=${JSON.stringify(from)})`
      );
      return { ok: false, error: error.message || 'send_failed' };
    }
    return { ok: true, id: data?.id || null };
  } catch (err) {
    console.error('[email] Resend exception:', err.message);
    return { ok: false, error: err.message };
  }
}

export async function sendInviteEmail({
  user,
  actor,
  company = null,
  temporaryPassword,
  passwordReused = false
}) {
  const { appUrl } = getEmailConfig();
  const workspace = company?.name || 'Terrafi Pro Platform';
  const role = roleLabel(user.role);

  let bodyHtml;
  let text;

  if (passwordReused) {
    bodyHtml = `
      <h1 style="margin:0 0 12px;font-size:20px;">You've been added to a workspace</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
        Hi ${escapeHtml(user.name)},<br/><br/>
        <strong>${escapeHtml(actor.name)}</strong> added you to
        <strong>${escapeHtml(workspace)}</strong> as <strong>${escapeHtml(role)}</strong>.
      </p>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#334155;">
        Use your existing Terrafi Pro password. After signing in, switch workspace from your profile menu.
      </p>
      ${signInBlock(appUrl)}
    `;
    text = `Hi ${user.name},\n\n${actor.name} added you to ${workspace} as ${role}.\nUse your existing password and switch workspace after sign-in.\n${appUrl || ''}`;
  } else {
    bodyHtml = `
      <h1 style="margin:0 0 12px;font-size:20px;">You're invited to Terrafi Pro</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
        Hi ${escapeHtml(user.name)},<br/><br/>
        <strong>${escapeHtml(actor.name)}</strong> invited you to
        <strong>${escapeHtml(workspace)}</strong> as <strong>${escapeHtml(role)}</strong>.
      </p>
      <p style="margin:16px 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">
        Temporary password
      </p>
      <div style="font-family:ui-monospace,Consolas,monospace;font-size:18px;font-weight:700;letter-spacing:0.06em;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;color:#0f172a;">
        ${escapeHtml(temporaryPassword)}
      </div>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#334155;">
        Sign in with <strong>${escapeHtml(user.email)}</strong> and this temporary password, then choose a new personal password.
      </p>
      ${signInBlock(appUrl)}
    `;
    text = `Hi ${user.name},\n\n${actor.name} invited you to ${workspace} as ${role}.\n\nEmail: ${user.email}\nTemporary password: ${temporaryPassword}\n\nSign in and set a new password.\n${appUrl || ''}`;
  }

  return sendEmail({
    to: user.email,
    subject: passwordReused
      ? `Added to ${workspace} on Terrafi Pro`
      : `Invitation to ${workspace} on Terrafi Pro`,
    html: layout({
      title: 'Terrafi Pro invitation',
      bodyHtml
    }),
    text
  });
}

export async function sendPasswordResetEmail({
  user,
  actor,
  company = null,
  temporaryPassword
}) {
  const { appUrl } = getEmailConfig();
  const workspace = company?.name || 'Terrafi Pro';

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:20px;">Your password was reset</h1>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
      Hi ${escapeHtml(user.name)},<br/><br/>
      <strong>${escapeHtml(actor.name)}</strong> reset your Terrafi Pro password
      for <strong>${escapeHtml(workspace)}</strong>.
    </p>
    <p style="margin:16px 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">
      Temporary password
    </p>
    <div style="font-family:ui-monospace,Consolas,monospace;font-size:18px;font-weight:700;letter-spacing:0.06em;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;color:#0f172a;">
      ${escapeHtml(temporaryPassword)}
    </div>
    <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#334155;">
      Sign in with <strong>${escapeHtml(user.email)}</strong> and this temporary password, then set a new personal password immediately.
    </p>
    ${signInBlock(appUrl)}
  `;

  const text = `Hi ${user.name},\n\n${actor.name} reset your password for ${workspace}.\n\nTemporary password: ${temporaryPassword}\n\nSign in and set a new password.\n${appUrl || ''}`;

  return sendEmail({
    to: user.email,
    subject: `Password reset — ${workspace}`,
    html: layout({
      title: 'Terrafi Pro password reset',
      bodyHtml
    }),
    text
  });
}

export async function sendCompanyWelcomeEmail({
  user,
  company,
  planName = null
}) {
  const { appUrl } = getEmailConfig();
  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:20px;">Welcome to Terrafi Pro</h1>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
      Hi ${escapeHtml(user.name)},<br/><br/>
      Your organisation <strong>${escapeHtml(company.name)}</strong> is ready
      ${planName ? ` on the <strong>${escapeHtml(planName)}</strong> plan` : ''}.
      You are the network manager — invite your team and set up billing from Settings when you are ready.
    </p>
    ${signInBlock(appUrl)}
  `;
  const text = `Hi ${user.name},\n\nWelcome to Terrafi Pro. ${company.name} is ready${planName ? ` on ${planName}` : ''}.\n${appUrl || ''}`;

  return sendEmail({
    to: user.email,
    subject: `Welcome to Terrafi Pro — ${company.name}`,
    html: layout({ title: 'Welcome to Terrafi Pro', bodyHtml }),
    text
  });
}
