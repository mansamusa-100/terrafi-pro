import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { companyFilter } from '../middleware/user.js';
import { requireRoles } from '../middleware/auth.js';
import { logAudit, isPlatformRole, PLATFORM_ROLES, COMPANY_ROLES } from '../lib/audit.js';

const router = Router();

function mapUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    zone: u.zone,
    status: u.status,
    scope: u.companyId ? 'company' : 'platform'
  };
}

router.get('/', async (req, res, next) => {
  try {
    if (isPlatformRole(req.user.role)) {
      const users = await prisma.user.findMany({
        where: { companyId: null, role: { in: PLATFORM_ROLES } },
        orderBy: { name: 'asc' }
      });
      return res.json(users.map((u) => ({ ...mapUser(u), scope: 'platform' })));
    }

    const companyId = companyFilter(req.user);
    if (!companyId) return res.json([]);

    const users = await prisma.user.findMany({
      where: { companyId, role: { in: COMPANY_ROLES } },
      orderBy: { name: 'asc' }
    });

    res.json(users.map(mapUser));
  } catch (err) {
    next(err);
  }
});

router.post('/invite', requireRoles('system_owner', 'platform_staff', 'manager'), async (req, res, next) => {
  try {
    const { name, email, role, zone } = req.body;
    if (!name?.trim() || !email?.trim() || !role) {
      return res.status(400).json({ error: 'Name, email, and role are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const exists = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
    });
    if (exists) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const isPlatform = isPlatformRole(req.user.role);
    let companyId = null;
    let allowedRoles;
    let auditScope;
    let tempPassword = 'changeme';

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

    await logAudit({
      scope: auditScope,
      companyId,
      actor: req.user,
      action: 'user.invited',
      entityType: 'user',
      entityId: user.id,
      details: { email: user.email, role: user.role, invitedName: user.name }
    });

    res.status(201).json({
      name: user.name,
      email: user.email,
      role: user.role,
      zone: user.zone,
      status: user.status,
      temporaryPassword: tempPassword
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
      const user = await prisma.user.findFirst({
        where: { email: { equals: req.params.email, mode: 'insensitive' } }
      });

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

      await logAudit({
        scope: user.companyId ? 'company' : 'platform',
        companyId: user.companyId,
        actor: req.user,
        action: 'user.role_updated',
        entityType: 'user',
        entityId: user.id,
        details: { email: user.email, from: user.role, to: role }
      });

      res.json(mapUser(updated));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:email',
  requireRoles('manager'),
  async (req, res, next) => {
    try {
      const user = await prisma.user.findFirst({
        where: { email: { equals: req.params.email, mode: 'insensitive' } }
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const data = {};
      if (req.body.name?.trim()) data.name = req.body.name.trim();
      if (req.body.zone !== undefined) data.zone = req.body.zone?.trim() || null;
      if (req.body.status && ['active', 'invited', 'suspended'].includes(req.body.status)) {
        data.status = req.body.status;
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data
      });

      if (updated.role === 'adr' && data.name && data.name !== user.name) {
        await prisma.agent.updateMany({
          where: { officerId: updated.id },
          data: { officer: updated.name }
        });
      }

      await logAudit({
        scope: 'company',
        companyId: user.companyId,
        actor: req.user,
        action: 'user.updated',
        entityType: 'user',
        entityId: user.id,
        details: { email: user.email, fields: Object.keys(data) }
      });

      res.json(mapUser(updated));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
