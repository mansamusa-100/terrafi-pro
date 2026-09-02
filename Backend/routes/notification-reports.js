import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { todayISO } from '../middleware/user.js';
import {
  notificationReportWhereForUser,
  serializeNotificationReport
} from '../lib/notification-report.js';

const router = Router();

function parseReportDateRange(query) {
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
    const base = notificationReportWhereForUser(req.user);
    if (!base) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 300);
    const type = req.query.type ? String(req.query.type) : null;
    const { createdAt } = parseReportDateRange(req.query);
    const where = { ...base, createdAt, ...(type ? { type } : {}) };

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
