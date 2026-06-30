import { prisma } from './prisma.js';

export async function logAudit({
  scope,
  companyId = null,
  actor,
  action,
  entityType = null,
  entityId = null,
  details = null
}) {
  await prisma.auditLog.create({
    data: {
      scope,
      companyId,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      action,
      entityType,
      entityId,
      details: details ? JSON.stringify(details) : null
    }
  });
}

export function isPlatformRole(role) {
  return role === 'system_owner' || role === 'platform_staff';
}

export const PLATFORM_ROLES = ['system_owner', 'platform_staff'];
export const COMPANY_ROLES = ['manager', 'internal', 'adr', 'agent', 'teller'];
