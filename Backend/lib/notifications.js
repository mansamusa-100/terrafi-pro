import { prisma } from './prisma.js';

function uniqueIds(ids) {
  return [...new Set(ids.filter(Boolean))];
}

export function serializeNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    entity_type: row.entityType,
    entity_id: row.entityId,
    company_id: row.companyId,
    read: row.readAt != null,
    read_at: row.readAt,
    created_at: row.createdAt
  };
}

/** Create one in-app notification for a user. */
export async function notifyUser({
  userId,
  companyId = null,
  type,
  title,
  body,
  entityType = null,
  entityId = null
}) {
  if (!userId) return;
  await prisma.notification.create({
    data: {
      userId,
      companyId,
      type,
      title,
      body,
      entityType,
      entityId
    }
  });
}

/** Create the same notification for multiple users (skips excludeUserId). */
export async function notifyUsers({
  userIds,
  companyId = null,
  type,
  title,
  body,
  entityType = null,
  entityId = null,
  excludeUserId = null
}) {
  const targets = uniqueIds(userIds).filter((id) => id !== excludeUserId);
  if (targets.length === 0) return;

  await prisma.notification.createMany({
    data: targets.map((userId) => ({
      userId,
      companyId,
      type,
      title,
      body,
      entityType,
      entityId
    }))
  });
}

export async function notifyCompanyRoles({
  companyId,
  roles,
  type,
  title,
  body,
  entityType = null,
  entityId = null,
  excludeUserId = null
}) {
  const users = await prisma.user.findMany({
    where: {
      companyId,
      role: { in: roles },
      status: { in: ['active', 'invited'] }
    },
    select: { id: true }
  });
  await notifyUsers({
    userIds: users.map((u) => u.id),
    companyId,
    type,
    title,
    body,
    entityType,
    entityId,
    excludeUserId
  });
}

export async function notifyPlatformRoles({
  roles,
  type,
  title,
  body,
  entityType = null,
  entityId = null,
  excludeUserId = null
}) {
  const users = await prisma.user.findMany({
    where: {
      companyId: null,
      role: { in: roles },
      status: { in: ['active', 'invited'] }
    },
    select: { id: true }
  });
  await notifyUsers({
    userIds: users.map((u) => u.id),
    companyId: null,
    type,
    title,
    body,
    entityType,
    entityId,
    excludeUserId
  });
}

export async function notifyKycReviewRequired(agent) {
  await notifyCompanyRoles({
    companyId: agent.companyId,
    roles: ['manager', 'internal'],
    type: 'kyc.review_required',
    title: 'KYC ready for review',
    body: `${agent.name} (${agent.id}) has submitted all required documents.`,
    entityType: 'agent',
    entityId: agent.id
  });
}

export async function notifyKycApproved(agent, reviewer) {
  if (!agent.officerId) return;
  await notifyUser({
    userId: agent.officerId,
    companyId: agent.companyId,
    type: 'kyc.approved',
    title: 'KYC approved',
    body: `${agent.name} (${agent.id}) was verified by ${reviewer.name}.`,
    entityType: 'agent',
    entityId: agent.id
  });
}

export async function notifyKycRejected(agent, reviewer, reason) {
  if (!agent.officerId) return;
  await notifyUser({
    userId: agent.officerId,
    companyId: agent.companyId,
    type: 'kyc.rejected',
    title: 'KYC rejected',
    body: `${agent.name} (${agent.id}) was rejected: ${reason}`,
    entityType: 'agent',
    entityId: agent.id
  });
}

export async function notifyAgentOnboarded(agent, actor) {
  if (actor.role === 'adr') {
    await notifyCompanyRoles({
      companyId: agent.companyId,
      roles: ['manager'],
      type: 'agent.onboarded',
      title: 'New agent onboarded',
      body: `${actor.name} onboarded ${agent.name} (${agent.id}) in ${agent.zone}.`,
      entityType: 'agent',
      entityId: agent.id,
      excludeUserId: actor.id
    });
    return;
  }

  if (agent.officerId && agent.officerId !== actor.id) {
    await notifyUser({
      userId: agent.officerId,
      companyId: agent.companyId,
      type: 'agent.assigned',
      title: 'Agent assigned to you',
      body: `${agent.name} (${agent.id}) in ${agent.zone} was assigned to you.`,
      entityType: 'agent',
      entityId: agent.id
    });
  }
}

export async function notifyVisitLogged(visit, agent, actor) {
  await notifyCompanyRoles({
    companyId: visit.companyId,
    roles: ['manager', 'internal'],
    type: 'visit.logged',
    title: 'Field visit logged',
    body: `${actor.name} completed a ${visit.type} visit with ${agent.name} (${agent.id}).`,
    entityType: 'visit',
    entityId: String(visit.id),
    excludeUserId: actor.id
  });
}

export async function notifyVisitScheduled(visit, agent, actor) {
  const adrUser = await prisma.user.findFirst({
    where: {
      companyId: visit.companyId,
      role: 'adr',
      name: visit.officer
    },
    select: { id: true }
  });

  if (adrUser && adrUser.id !== actor.id) {
    await notifyUser({
      userId: adrUser.id,
      companyId: visit.companyId,
      type: 'visit.scheduled',
      title: 'Visit scheduled',
      body: `${visit.type} with ${agent.name} on ${visit.visitDate} at ${visit.time}.`,
      entityType: 'visit',
      entityId: String(visit.id)
    });
  }

  if (actor.role === 'adr') {
    await notifyCompanyRoles({
      companyId: visit.companyId,
      roles: ['manager'],
      type: 'visit.scheduled',
      title: 'Visit scheduled',
      body: `${actor.name} scheduled a ${visit.type} visit with ${agent.name} on ${visit.visitDate}.`,
      entityType: 'visit',
      entityId: String(visit.id),
      excludeUserId: actor.id
    });
  }
}

export async function notifyFloatAlertCreated(agent, level) {
  const title = level === 'critical' ? 'Critical low float' : 'Low float warning';
  const body = `${agent.name} (${agent.id}) in ${agent.zone} needs attention.`;

  if (agent.officerId) {
    await notifyUser({
      userId: agent.officerId,
      companyId: agent.companyId,
      type: 'float.alert',
      title,
      body,
      entityType: 'agent',
      entityId: agent.id
    });
  }

  await notifyCompanyRoles({
    companyId: agent.companyId,
    roles: ['manager', 'internal'],
    type: 'float.alert',
    title,
    body,
    entityType: 'agent',
    entityId: agent.id
  });
}

export async function notifyFloatAlertResolved(agent) {
  if (!agent.officerId) return;
  await notifyUser({
    userId: agent.officerId,
    companyId: agent.companyId,
    type: 'float.resolved',
    title: 'Float restored',
    body: `${agent.name} (${agent.id}) is back above the alert threshold.`,
    entityType: 'agent',
    entityId: agent.id
  });
}

export async function notifyUserInvited(user, actor) {
  await notifyUser({
    userId: user.id,
    companyId: user.companyId,
    type: 'user.invited',
    title: 'Welcome to Terrafi Pro',
    body: `${actor.name} invited you as ${user.role}. Sign in with your email to get started.`,
    entityType: 'user',
    entityId: user.id
  });
}

export async function notifyCompanyRegistered(company) {
  await notifyPlatformRoles({
    roles: ['system_owner', 'platform_staff'],
    type: 'company.registered',
    title: 'New company registered',
    body: `${company.name} signed up on the Standard plan.`,
    entityType: 'company',
    entityId: company.id
  });
}
