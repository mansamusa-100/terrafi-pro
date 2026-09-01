import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { serializeNotification } from '../lib/notifications.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const unreadOnly = req.query.unread_only === 'true';
    const where = { userId: req.user.id };
    if (unreadOnly) where.readAt = null;

    const rows = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    res.json(rows.map(serializeNotification));
  } catch (err) {
    next(err);
  }
});

router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, readAt: null }
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const row = await prisma.notification.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id }
    });
    if (!row) return res.status(404).json({ error: 'Notification not found' });

    const updated =
      row.readAt != null
        ? row
        : await prisma.notification.update({
            where: { id: row.id },
            data: { readAt: new Date() }
          });

    res.json(serializeNotification(updated));
  } catch (err) {
    next(err);
  }
});

router.post('/read-all', async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() }
    });
    res.json({ updated: result.count });
  } catch (err) {
    next(err);
  }
});

export default router;
