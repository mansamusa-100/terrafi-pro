import { prisma } from './prisma.js';
import { isPlatformRole } from './audit.js';

const ROLE_LABELS = {
  system_owner: 'System owner',
  platform_staff: 'Platform staff',
  manager: 'Network manager',
  internal: 'Internal staff',
  team_lead: 'Team lead',
  adr: 'ADR',
  agent: 'Agent',
  teller: 'Teller',
  system: 'System'
};

/** Automated actor for lifecycle / webhook events (no User FK required). */
export const SYSTEM_ACTOR = {
  id: 'system',
  name: 'Terrafi Pro',
  email: 'system@terrafi.pro',
  role: 'system'
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

export function serializeNotificationReport(row) {
  return {
    id: row.id,
    scope: row.scope,
    type: row.type,
    title: row.title,
    detail: row.detail,
    actor_id: row.actorId,
    actor_name: row.actorName,
    actor_email: row.actorEmail,
    actor_role: row.actorRole,
    actor_role_label: roleLabel(row.actorRole),
    entity_type: row.entityType,
    entity_id: row.entityId,
    entity_label: row.entityLabel,
    temporary_password: row.temporaryPassword,
    credential_delivery: row.credentialDelivery,
    company_id: row.companyId,
    created_at: row.createdAt
  };
}

/**
 * Append a row to the Notification report (ops activity).
 * Does not write to the in-app bell. Failures are logged, never thrown.
 */
export async function logNotificationReport({
  actor = SYSTEM_ACTOR,
  scope = null,
  type,
  title,
  detail,
  companyId = null,
  entityType = null,
  entityId = null,
  entityLabel = null,
  temporaryPassword = null,
  credentialDelivery = null
}) {
  const who = actor?.id ? actor : SYSTEM_ACTOR;
  try {
    await prisma.notificationReport.create({
      data: {
        scope: scope || (companyId ? 'company' : 'platform'),
        companyId,
        type,
        title,
        detail,
        actorId: who.id,
        actorName: who.name,
        actorEmail: who.email,
        actorRole: who.role,
        entityType,
        entityId,
        entityLabel,
        temporaryPassword: temporaryPassword || null,
        credentialDelivery: credentialDelivery || null
      }
    });
  } catch (err) {
    console.error('[notification-report]', err.message);
  }
}

/** Platform admin + company manager both see billing lifecycle events. */
export async function logBillingLifecycleReport({
  company,
  type,
  title,
  detail
}) {
  if (!company?.id) return;
  const base = {
    actor: SYSTEM_ACTOR,
    type,
    title,
    detail,
    companyId: company.id,
    entityType: 'company',
    entityId: company.id,
    entityLabel: company.name
  };
  await Promise.all([
    logNotificationReport({ ...base, scope: 'platform' }),
    logNotificationReport({ ...base, scope: 'company' })
  ]);
}

export async function logAgentOnboardedReport(agent, actor) {
  const zone = agent.zone || 'unspecified zone';
  await logNotificationReport({
    actor,
    companyId: agent.companyId,
    type: 'agent.onboarded',
    title: 'Agent onboarded',
    detail: `${agent.name} (${agent.id}) onboarded in ${zone}`,
    entityType: 'agent',
    entityId: agent.id,
    entityLabel: agent.name
  });
}

export async function logUserInvitedReport({
  user,
  actor,
  temporaryPassword,
  credentialDelivery,
  passwordReused
}) {
  const role = roleLabel(user.role);
  const detail = passwordReused
    ? `${user.name} added as ${role} · ${user.email} (existing password)`
    : `${user.name} invited as ${role} · ${user.email}`;

  await logNotificationReport({
    actor,
    companyId: user.companyId,
    type: 'user.invited',
    title: passwordReused ? 'User added' : 'User invited',
    detail,
    entityType: 'user',
    entityId: user.id,
    entityLabel: user.name,
    temporaryPassword: passwordReused ? null : temporaryPassword,
    credentialDelivery
  });
}

export async function logPasswordResetReport({
  user,
  actor,
  temporaryPassword,
  credentialDelivery
}) {
  await logNotificationReport({
    actor,
    companyId: user.companyId,
    type: 'user.password_reset',
    title: 'Password reset',
    detail: `Temporary password issued for ${user.name} · ${user.email}`,
    entityType: 'user',
    entityId: user.id,
    entityLabel: user.name,
    temporaryPassword,
    credentialDelivery
  });
}

export function notificationReportWhereForUser(user) {
  if (user.role === 'manager') {
    return { scope: 'company', companyId: user.companyId };
  }
  if (user.role === 'system_owner') {
    return {
      OR: [{ scope: 'platform' }, { actorId: user.id }]
    };
  }
  if (isPlatformRole(user.role)) {
    return { scope: 'platform' };
  }
  return null;
}
