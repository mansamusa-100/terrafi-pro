import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { companyFilter } from '../middleware/user.js';
import { requireRoles } from '../middleware/auth.js';
import { logAudit, isPlatformRole, PLATFORM_ROLES, COMPANY_ROLES } from '../lib/audit.js';
import { notifyUserInvited } from '../lib/notifications.js';
import { loadSupervisedAdrs, setSupervisedAdrs } from '../lib/team-lead.js';
import {
  generateTemporaryPassword,
  logInviteCredentials
} from '../lib/invite-credentials.js';
import { findInviteEmailConflict } from '../lib/user-email.js';

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
    const tempPassword = generateTemporaryPassword();

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

    const hash = bcrypt.hashSync(tempPassword, 10);
    const user = await prisma.user.create({
      data: {
        id: `usr-${Date.now().toString(36)}`,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: hash,
        role,
        companyId,
        scope: isPlatform ? 'Platform operations' : zone?.trim() || 'Invited',
        zone: zone?.trim() || null,
        status: 'invited'
      }
    });

    if (role === 'team_lead' && companyId && Array.isArray(supervised_adr_ids)) {
      await setSupervisedAdrs(user.id, companyId, supervised_adr_ids);
    }

    await notifyUserInvited(user, req.user);

    const company = companyId
      ? await prisma.company.findUnique({
          where: { id: companyId },
          select: { id: true, name: true }
        })
      : null;

    const { credentialDelivery } = logInviteCredentials({
      user,
      actor: req.user,
      company,
      temporaryPassword: tempPassword
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
        ...(credentialDelivery === 'log_only'
          ? { temporaryPassword: tempPassword }
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
      temporaryPassword: tempPassword,
      credentialDelivery
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

export default router;
