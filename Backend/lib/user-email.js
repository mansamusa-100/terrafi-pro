import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';

/** Platform-only — one account per email with companyId null. */
export const GLOBAL_EMAIL_ROLES = ['system_owner', 'platform_staff'];

/** Company roles — same personal email allowed across different organisations. */
export const MULTI_ORG_ROLES = [
  'manager',
  'internal',
  'team_lead',
  'adr',
  'agent',
  'teller'
];

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

/**
 * Self-serve company registration: any existing email blocks signup.
 * Extra organisations should use invite (shared password) instead.
 */
export async function findRegistrationEmailConflict(email) {
  const users = await findUsersByEmail(email);
  if (users.length > 0) {
    return 'An account with this email already exists. Sign in, or ask to be invited to another organisation.';
  }
  return null;
}

/** Invite-time check — company staff may reuse email across orgs. */
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
    return 'Platform roles cannot be invited into a company workspace';
  }

  const platformAccount = users.find((u) => u.companyId === null);
  if (platformAccount) {
    return 'This email belongs to a platform account and cannot join a company';
  }

  return null;
}

/**
 * Resolve credentials when inviting someone who already has an account.
 * Reuses their existing password hash so one person keeps one password.
 */
export function resolveInviteCredentials(existingUsers) {
  if (!existingUsers?.length) {
    return { reuseExisting: false };
  }

  const active = existingUsers.find((u) => u.status === 'active');
  const source = active || existingUsers[0];
  return {
    reuseExisting: true,
    passwordHash: source.passwordHash,
    status: active ? 'active' : 'invited',
    hasActiveAccount: Boolean(active)
  };
}

/** Keep one password across every membership for the same email. */
export async function syncPasswordAcrossEmail(email, passwordHash, { activateInvited = false } = {}) {
  const normalized = normalizeEmail(email);
  const data = { passwordHash };
  if (activateInvited) {
    return prisma.user.updateMany({
      where: {
        email: { equals: normalized, mode: 'insensitive' },
        status: { in: ['active', 'invited'] }
      },
      data: { passwordHash, status: 'active' }
    });
  }
  return prisma.user.updateMany({
    where: {
      email: { equals: normalized, mode: 'insensitive' },
      status: { in: ['active', 'invited'] }
    },
    data
  });
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

/** Prefer an active membership when signing in with multiple workspaces. */
export function pickDefaultMembership(users) {
  const eligible = users.filter((u) => !loginEligibilityError(u));
  if (eligible.length === 0) return null;
  return (
    eligible.find((u) => u.status === 'active') ||
    eligible[0]
  );
}

export function serializeWorkspace(user) {
  return {
    userId: user.id,
    name: user.name,
    role: user.role,
    status: user.status,
    companyId: user.companyId,
    companyName: user.company?.name || 'Terrafi Pro Platform'
  };
}
