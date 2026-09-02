import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { todayISO } from '../middleware/user.js';
import { isPlatformRole } from '../lib/audit.js';
import { hasInternalCapability } from '../lib/internal-capabilities.js';

const router = Router();

const PLATFORM_LIFECYCLE_ACTIONS = [
  'company.registered',
  'company.status_changed'
];

function parseAuditDateRange(query) {
  const from =
    query.from && /^\d{4}-\d{2}-\d{2}$/.test(String(query.from))
      ? String(query.from)
      : todayISO();
  const to =
    query.to && /^\d{4}-\d{2}-\d{2}$/.test(String(query.to))
      ? String(query.to)
      : from;
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  return {
    from: start,
    to: end,
    createdAt: {
      gte: new Date(`${start}T00:00:00.000`),
      lte: new Date(`${end}T23:59:59.999`)
    }
  };
}

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
    const action = req.query.action ? String(req.query.action) : null;
    const { createdAt } = parseAuditDateRange(req.query);

    if (isPlatformRole(req.user.role)) {
      const isOwner = req.user.role === 'system_owner';
      let where = { createdAt };

      if (action) {
        where.action = action;
        if (!isOwner) where.scope = 'platform';
      } else if (isOwner) {
        where = {
          createdAt,
          OR: [
            { scope: 'platform' },
            { action: { in: PLATFORM_LIFECYCLE_ACTIONS } }
          ]
        };
      } else {
        where.scope = 'platform';
      }

      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit
      });
      return res.json(logs.map(formatLog));
    }

    if (req.user.role === 'manager') {
      const where = {
        scope: 'company',
        companyId: req.user.companyId,
        createdAt
      };
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
      const where = {
        scope: 'company',
        companyId: req.user.companyId,
        createdAt
      };
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
