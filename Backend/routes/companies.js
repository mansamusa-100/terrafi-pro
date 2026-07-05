import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireRoles } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';
import { cachedCompanySubscription } from '../lib/company-billing.js';

const router = Router();

function serializeCompanyList(c) {
  return {
    id: c.id,
    name: c.name,
    plan: c.plan,
    agents: c.agents,
    officers: c.officers,
    status: c.status,
    mrr: c.mrr,
    since: c.since,
    contactEmail: c.contactEmail,
    registeredAt: c.registeredAt,
    subscriptionStatus: c.subscriptionStatus,
    subscriptionPlanCode: c.subscriptionPlanCode,
    userCount: c._count?.users ?? 0
  };
}

router.get('/', requireRoles('system_owner', 'platform_staff'), async (_req, res, next) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { registeredAt: 'desc' },
      include: { _count: { select: { users: true } } }
    });

    res.json(companies.map(serializeCompanyList));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireRoles('system_owner', 'platform_staff'), async (req, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, agentsRel: true, visits: true } },
        users: {
          where: { role: { in: ['manager', 'internal', 'adr'] } },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            zone: true
          }
        }
      }
    });

    if (!company) return res.status(404).json({ error: 'Company not found' });

    const recentAudit = await prisma.auditLog.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json({
      ...serializeCompanyList(company),
      visitCount: company._count.visits,
      agentCount: company._count.agentsRel,
      subscription: cachedCompanySubscription(company),
      directPaySlug: company.directPaySlug,
      users: company.users,
      recentAudit: recentAudit.map((log) => ({
        id: log.id,
        action: log.action,
        actorName: log.actorName,
        createdAt: log.createdAt,
        details: log.details ? JSON.parse(log.details) : null
      }))
    });
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

      const existing = await prisma.company.findUnique({
        where: { id: req.params.id }
      });
      if (!existing) return res.status(404).json({ error: 'Company not found' });
      if (existing.status === status) {
        return res.json({
          id: existing.id,
          name: existing.name,
          status: existing.status
        });
      }

      const updated = await prisma.company.update({
        where: { id: req.params.id },
        data: { status }
      });

      await logAudit({
        scope: 'platform',
        companyId: updated.id,
        actor: req.user,
        action: 'company.status_changed',
        entityType: 'company',
        entityId: updated.id,
        details: {
          companyName: updated.name,
          from: existing.status,
          to: status
        }
      });

      await logAudit({
        scope: 'company',
        companyId: updated.id,
        actor: req.user,
        action: 'company.status_changed',
        entityType: 'company',
        entityId: updated.id,
        details: {
          companyName: updated.name,
          from: existing.status,
          to: status,
          byPlatform: true
        }
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
