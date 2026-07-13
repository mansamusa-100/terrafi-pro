import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';

/** Full staff — one email across the whole platform (per org for managers). */
export const GLOBAL_EMAIL_ROLES = [
  'system_owner',
  'platform_staff',
  'manager',
  'internal'
];

/** Contract / field roles — same personal email allowed in different companies. */
export const MULTI_ORG_ROLES = ['team_lead', 'adr', 'agent', 'teller'];

export function isMultiOrgRole(role) {
  return MULTI_ORG_ROLES.includes(role);
}

export function isGlobalEmailRole(role) {
  return GLOBAL_EMAIL_ROLES.includes(role);
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export async function findUsersByEmail(email) {
  return prisma.user.findMany({
    where: { email: { equals: normalizeEmail(email), mode: 'insensitive' } },
    include: { company: true }
  });
}

/** Accounts that block self-serve company registration (manager signup). */
export async function findRegistrationEmailConflict(email) {
  const users = await findUsersByEmail(email);
  const blocker = users.find(
    (u) => u.companyId === null || isGlobalEmailRole(u.role)
  );
  if (!blocker) return null;
  return 'An account with this email already exists';
}

/** Invite-time check — field staff may reuse email across companies. */
export async function findInviteEmailConflict(email, role, companyId) {
  const users = await findUsersByEmail(email);

  if (companyId == null) {
    if (users.some((u) => u.companyId === null)) {
      return 'A platform account with this email already exists';
    }
    return null;
  }

  if (users.some((u) => u.companyId === companyId)) {
    return 'This person is already on your team with this email';
  }

  if (isGlobalEmailRole(role)) {
    const staffElsewhere = users.find(
      (u) => u.companyId === null || isGlobalEmailRole(u.role)
    );
    if (staffElsewhere) {
      return 'This email is already used by a manager or staff account';
    }
  }

  return null;
}

export function usersMatchingPassword(users, password) {
  return users.filter((u) => bcrypt.compareSync(password, u.passwordHash));
}

export function loginEligibilityError(user) {
  if (user.status === 'suspended') {
    return 'Your account has been suspended';
  }
  if (user.companyId && user.company?.status === 'suspended') {
    return 'This organisation has been suspended. Contact platform support.';
  }
  return null;
}

export function serializeWorkspace(user) {
  return {
    userId: user.id,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    companyName: user.company?.name || 'Terrafi Pro Platform'
  };
}
