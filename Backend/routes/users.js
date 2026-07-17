import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { companyFilter } from '../middleware/user.js';
import { requireRoles } from '../middleware/auth.js';
import { logAudit, isPlatformRole, PLATFORM_ROLES, COMPANY_ROLES } from '../lib/audit.js';
import { notifyMembershipAdded, notifyPasswordReset } from '../lib/notifications.js';
import { loadSupervisedAdrs, setSupervisedAdrs } from '../lib/team-lead.js';
import {
  generateTemporaryPassword,
  logInviteCredentials,
  logTemporaryCredentials
} from '../lib/invite-credentials.js';
import {
  findInviteEmailConflict,
  findUsersByEmail,
  resolveInviteCredentials,
  syncPasswordAcrossEmail
} from '../lib/user-email.js';
import { assertCompanyHasSeatCapacity } from '../lib/company-billing.js';

const router = Router();

async function findUserInScope(req, email) {
  const normalized = email.trim().toLowerCase();
  if (isPlatformRole(req.user.role)) {
    return prisma.user.findFirst({
      where: {
        email: { equals: normalized, mode: 'insensitive' },
        companyId: null
      }
    });
  }
  const companyId = req.user.companyId;
  if (!companyId) return null;
  return prisma.user.findFirst({
    where: {
      email: { equals: normalized, mode: 'insensitive' },
      companyId
    }
  });
}

/** Resolve target user for password reset (manager or system owner). */
async function findUserForPasswordReset(req, email) {
  const normalized = email.trim().toLowerCase();

  if (req.user.role === 'system_owner') {
    const companyId = req.body?.companyId?.trim() || req.query?.companyId?.trim();
    if (companyId) {
      return prisma.user.findFirst({
        where: {
          email: { equals: normalized, mode: 'insensitive' },
          companyId,
          role: 'manager'
        }
      });
    }
    return prisma.user.findFirst({
      where: {
        email: { equals: normalized, mode: 'insensitive' },
        companyId: null,
        role: { not: 'system_owner' }
      }
    });
  }

  if (req.user.role === 'manager') {
    if (!req.user.companyId) return null;
    return prisma.user.findFirst({
      where: {
        email: { equals: normalized, mode: 'insensitive' },
        companyId: req.user.companyId,
        role: { not: 'manager' }
      }
    });
  }

  return null;
}

async function mapUser(u) {
  const base = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    zone: u.zone,
    status: u.status,
    scope: u.companyId ? 'company' : 'platform'
  };
  if (u.role === 'team_lead') {
    const supervised = await loadSupervisedAdrs(u.id);
    base.supervised_adr_ids = supervised.supervisedAdrIds;
  }
  return base;
}

router.get('/', async (req, res, next) => {
  try {
    if (isPlatformRole(req.user.role)) {
      const users = await prisma.user.findMany({
        where: { companyId: null, role: { in: PLATFORM_ROLES } },
        orderBy: { name: 'asc' }
      });
      const mapped = await Promise.all(users.map(mapUser));
      return res.json(mapped.map((u) => ({ ...u, scope: 'platform' })));
    }

    const companyId = companyFilter(req.user);
    if (!companyId) return res.json([]);

    const users = await prisma.user.findMany({
      where: { companyId, role: { in: COMPANY_ROLES } },
      orderBy: { name: 'asc' }
    });

    res.json(await Promise.all(users.map(mapUser)));
  } catch (err) {
    next(err);
  }
});

router.post('/invite', requireRoles('system_owner', 'platform_staff', 'manager'), async (req, res, next) => {
  try {
    const { name, email, role, zone, supervised_adr_ids } = req.body;
    if (!name?.trim() || !email?.trim() || !role) {
      return res.status(400).json({ error: 'Name, email, and role are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailConflict = await findInviteEmailConflict(
      normalizedEmail,
      role,
      isPlatformRole(req.user.role) ? null : req.user.companyId
    );
    if (emailConflict) {
      return res.status(409).json({ error: emailConflict });
    }

    const isPlatform = isPlatformRole(req.user.role);
    let companyId = null;
    let allowedRoles;
    let auditScope;

    if (isPlatform) {
      if (!PLATFORM_ROLES.includes(role) || role === 'system_owner') {
        return res.status(400).json({
          error: 'Platform can only invite platform_staff users'
        });
      }
      allowedRoles = ['platform_staff'];
      auditScope = 'platform';
    } else {
      companyId = req.user.companyId;
      if (!COMPANY_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Invalid company role' });
      }
      allowedRoles = COMPANY_ROLES;
      auditScope = 'company';
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role for this scope' });
    }

    if (companyId) {
      try {
        await assertCompanyHasSeatCapacity(companyId);
      } catch (err) {
        if (err.status === 403 || err.code === 'SEAT_LIMIT') {
          return res.status(403).json({ error: err.message, code: 'SEAT_LIMIT' });
        }
        throw err;
      }
    }

    const existingUsers = await findUsersByEmail(normalizedEmail);
    const credentials = resolveInviteCredentials(existingUsers);
    let temporaryPassword = null;
    let passwordHash;
    let status;

    if (credentials.reuseExisting) {
      passwordHash = credentials.passwordHash;
      status = credentials.status;
    } else {
      temporaryPassword = generateTemporaryPassword();
      passwordHash = bcrypt.hashSync(temporaryPassword, 10);
      status = 'invited';
    }

    const user = await prisma.user.create({
      data: {
        id: `usr-${Date.now().toString(36)}`,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role,
        companyId,
        scope: isPlatform ? 'Platform operations' : zone?.trim() || 'Invited',
        zone: zone?.trim() || null,
        status
      }
    });

    if (role === 'team_lead' && companyId && Array.isArray(supervised_adr_ids)) {
      await setSupervisedAdrs(user.id, companyId, supervised_adr_ids);
    }

    const company = companyId
      ? await prisma.company.findUnique({
          where: { id: companyId },
          select: { id: true, name: true }
        })
      : null;

    await notifyMembershipAdded(user, req.user, company?.name || null);

    const { credentialDelivery } = logInviteCredentials({
      user,
      actor: req.user,
      company,
      temporaryPassword,
      passwordReused: credentials.reuseExisting
    });

    await logAudit({
      scope: auditScope,
      companyId,
      actor: req.user,
      action: 'user.invited',
      entityType: 'user',
      entityId: user.id,
      details: {
        email: user.email,
        role: user.role,
        invitedName: user.name,
        credentialDelivery,
        passwordReused: credentials.reuseExisting,
        ...(credentialDelivery === 'log_only' && temporaryPassword
          ? { temporaryPassword }
          : {})
      }
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      zone: user.zone,
      status: user.status,
      temporaryPassword: temporaryPassword || undefined,
      credentialDelivery,
      passwordReused: credentials.reuseExisting,
      message: credentials.reuseExisting
        ? credentials.hasActiveAccount
          ? 'Added to workspace. They keep their existing password and can switch after signing in.'
          : 'Added to workspace. They use the same temporary password as their other invite.'
        : undefined
    });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:email/role',
  requireRoles('system_owner', 'platform_staff', 'manager'),
  async (req, res, next) => {
    try {
      const { role } = req.body;
      const user = await findUserInScope(req, req.params.email);

      if (!user) return res.status(404).json({ error: 'User not found' });

      if (isPlatformRole(req.user.role)) {
        if (user.companyId != null) {
          return res.status(403).json({ error: 'Cannot manage company users from platform' });
        }
        if (!PLATFORM_ROLES.includes(role) || role === 'system_owner') {
          return res.status(400).json({ error: 'Invalid platform role' });
        }
      } else {
        if (user.companyId !== req.user.companyId) {
          return res.status(403).json({ error: 'Access denied' });
        }
        if (!COMPANY_ROLES.includes(role)) {
          return res.status(400).json({ error: 'Invalid company role' });
        }
        if (user.role === 'manager') {
          return res.status(400).json({
            error: 'Network manager role cannot be changed'
          });
        }
        if (role === 'manager' && user.role !== 'manager') {
          return res.status(400).json({
            error: 'Cannot promote users to network manager. Invite a new manager instead.'
          });
        }
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role }
      });

      if (role === 'team_lead' && user.companyId) {
        await setSupervisedAdrs(user.id, user.companyId, []);
      }

      await logAudit({
        scope: user.companyId ? 'company' : 'platform',
        companyId: user.companyId,
        actor: req.user,
        action: 'user.role_updated',
        entityType: 'user',
        entityId: user.id,
        details: { email: user.email, from: user.role, to: role }
      });

      res.json(await mapUser(updated));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:email/supervised-adrs',
  requireRoles('manager'),
  async (req, res, next) => {
    try {
      const user = await findUserInScope(req, req.params.email);
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (user.role !== 'team_lead') {
        return res.status(400).json({ error: 'User is not a team lead' });
      }

      const adrIds = Array.isArray(req.body.adr_ids) ? req.body.adr_ids : [];
      await setSupervisedAdrs(user.id, user.companyId, adrIds);

      await logAudit({
        scope: 'company',
        companyId: user.companyId,
        actor: req.user,
        action: 'user.supervised_adrs_updated',
        entityType: 'user',
        entityId: user.id,
        details: { email: user.email, adrCount: adrIds.length }
      });

      res.json(await mapUser(user));
    } catch (err) {
      if (err.message?.includes('invalid') || err.message?.includes('Invalid')) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  }
);

router.patch(
  '/:email',
  requireRoles('system_owner', 'platform_staff', 'manager'),
  async (req, res, next) => {
    try {
      const user = await findUserInScope(req, req.params.email);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const actorIsPlatform = isPlatformRole(req.user.role);

      if (actorIsPlatform) {
        if (user.companyId != null) {
          return res.status(403).json({ error: 'Cannot manage company users from platform' });
        }
        if (user.role === 'system_owner' && req.user.role !== 'system_owner') {
          return res.status(403).json({ error: 'Cannot edit system owner' });
        }
      } else if (user.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const data = {};
      if (req.body.name?.trim()) data.name = req.body.name.trim();
      if (!actorIsPlatform && req.body.zone !== undefined) {
        data.zone = req.body.zone?.trim() || null;
      }
      if (req.body.status && ['active', 'invited', 'suspended'].includes(req.body.status)) {
        if (user.role === 'system_owner' && req.body.status !== 'active') {
          return res.status(400).json({ error: 'Cannot suspend system owner' });
        }
        if (user.role === 'manager' && req.body.status !== user.status) {
          return res.status(400).json({
            error: 'Network manager status cannot be changed'
          });
        }
        data.status = req.body.status;
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data
      });

      if (!actorIsPlatform && updated.role === 'adr' && data.name && data.name !== user.name) {
        await prisma.agent.updateMany({
          where: { officerId: updated.id },
          data: { officer: updated.name }
        });
      }

      await logAudit({
        scope: user.companyId ? 'company' : 'platform',
        companyId: user.companyId,
        actor: req.user,
        action: 'user.updated',
        entityType: 'user',
        entityId: user.id,
        details: { email: user.email, fields: Object.keys(data) }
      });

      res.json(await mapUser(updated));
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Manager / system owner: issue a new temporary password (invite-style).
 * System owner may reset a company's network manager (pass companyId in body).
 */
router.post(
  '/:email/reset-password',
  requireRoles('system_owner', 'manager'),
  async (req, res, next) => {
    try {
      const user = await findUserForPasswordReset(req, req.params.email);
      if (!user) {
        const companyId = req.body?.companyId?.trim();
        if (req.user.role === 'system_owner' && companyId) {
          return res.status(404).json({
            error: 'Network manager not found for this company'
          });
        }
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.id === req.user.id) {
        return res.status(400).json({
          error: 'Use Change password for your own account'
        });
      }
      if (user.role === 'system_owner') {
        return res.status(403).json({ error: 'Cannot reset system owner password' });
      }

      if (req.user.role === 'manager' && user.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = bcrypt.hashSync(temporaryPassword, 10);
      await syncPasswordAcrossEmail(user.email, passwordHash, {
        forceInvited: true
      });

      const updated = await prisma.user.findUnique({ where: { id: user.id } });

      const company = user.companyId
        ? await prisma.company.findUnique({
            where: { id: user.companyId },
            select: { id: true, name: true }
          })
        : null;

      const { credentialDelivery } = logTemporaryCredentials({
        user: updated,
        actor: req.user,
        company,
        temporaryPassword,
        purpose: 'password_reset'
      });

      await notifyPasswordReset(updated, req.user).catch(() => null);

      await logAudit({
        scope: user.companyId ? 'company' : 'platform',
        companyId: user.companyId,
        actor: req.user,
        action: 'user.password_reset',
        entityType: 'user',
        entityId: user.id,
        details: {
          email: user.email,
          role: user.role,
          resetByPlatformOwner: req.user.role === 'system_owner' && Boolean(user.companyId),
          credentialDelivery,
          ...(credentialDelivery === 'log_only' ? { temporaryPassword } : {})
        }
      });

      res.json({
        ...(await mapUser(updated)),
        temporaryPassword,
        credentialDelivery,
        message:
          credentialDelivery === 'log_only'
            ? 'Temporary password generated. Share it with the user — it is also logged in the server console and audit log.'
            : 'Temporary password generated. Share it with the user so they can sign in and set a new password.'
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
