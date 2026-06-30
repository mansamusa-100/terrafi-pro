import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', requireRoles('system_owner', 'platform_staff'), async (_req, res, next) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { registeredAt: 'desc' }
    });

    res.json(
      companies.map((c) => ({
        id: c.id,
        name: c.name,
        plan: c.plan,
        agents: c.agents,
        officers: c.officers,
        status: c.status,
        mrr: c.mrr,
        since: c.since,
        contactEmail: c.contactEmail,
        registeredAt: c.registeredAt
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/status',
  requireRoles('system_owner'),
  async (req, res, next) => {
    try {
      const { status } = req.body;
      const allowed = ['active', 'suspended'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const updated = await prisma.company.update({
        where: { id: req.params.id },
        data: { status }
      });

      res.json({
        id: updated.id,
        name: updated.name,
        status: updated.status
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
