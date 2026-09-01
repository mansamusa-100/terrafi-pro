import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { isPlatformRole } from '../lib/audit.js';
import { hasInternalCapability } from '../lib/internal-capabilities.js';

const router = Router();

const PLATFORM_LIFECYCLE_ACTIONS = [
  'company.registered',
  'company.status_changed'
];

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const action = req.query.action ? String(req.query.action) : null;

    if (isPlatformRole(req.user.role)) {
      const isOwner = req.user.role === 'system_owner';
      let where;

      if (action) {
        where = { action };
        if (!isOwner) where.scope = 'platform';
      } else if (isOwner) {
        where = {
          OR: [
            { scope: 'platform' },
            { action: { in: PLATFORM_LIFECYCLE_ACTIONS } }
          ]
        };
      } else {
        where = { scope: 'platform' };
      }

      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit
      });
      return res.json(logs.map(formatLog));
    }

    if (req.user.role === 'manager') {
      const where = { scope: 'company', companyId: req.user.companyId };
      if (action) where.action = action;

      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit
      });
      return res.json(logs.map(formatLog));
    }

    if (
      req.user.role === 'internal' &&
      hasInternalCapability(req.user, 'view_audit')
    ) {
      const where = { scope: 'company', companyId: req.user.companyId };
      if (action) where.action = action;

      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit
      });
      return res.json(logs.map(formatLog));
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  } catch (err) {
    next(err);
  }
});

function formatLog(log) {
  return {
    id: log.id,
    scope: log.scope,
    action: log.action,
    actorName: log.actorName,
    actorEmail: log.actorEmail,
    entityType: log.entityType,
    entityId: log.entityId,
    companyId: log.companyId,
    details: log.details ? JSON.parse(log.details) : null,
    createdAt: log.createdAt
  };
}

export default router;
