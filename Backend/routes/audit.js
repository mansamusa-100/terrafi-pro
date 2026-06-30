import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireRoles } from '../middleware/auth.js';
import { isPlatformRole } from '../lib/audit.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);

    if (isPlatformRole(req.user.role)) {
      const logs = await prisma.auditLog.findMany({
        where: { scope: 'platform' },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
      return res.json(logs.map(formatLog));
    }

    if (req.user.role === 'manager') {
      const logs = await prisma.auditLog.findMany({
        where: { scope: 'company', companyId: req.user.companyId },
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
    details: log.details ? JSON.parse(log.details) : null,
    createdAt: log.createdAt
  };
}

export default router;
