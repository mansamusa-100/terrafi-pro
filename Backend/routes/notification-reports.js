import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  notificationReportWhereForUser,
  serializeNotificationReport
} from '../lib/notification-report.js';
import { hasInternalCapability } from '../lib/internal-capabilities.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const base = notificationReportWhereForUser(req.user);
    if (!base) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 300);
    const type = req.query.type ? String(req.query.type) : null;
    const where = type ? { ...base, type } : base;

    const rows = await prisma.notificationReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    res.json(rows.map(serializeNotificationReport));
  } catch (err) {
    next(err);
  }
});

export default router;
