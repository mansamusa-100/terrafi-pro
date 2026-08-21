import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireRoles } from '../middleware/auth.js';
import {
  sortAttention,
  toAttentionItem
} from '../lib/company-health.js';

const router = Router();

router.get('/stats', requireRoles('system_owner', 'platform_staff'), async (_req, res, next) => {
  try {
    const now = new Date();
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      companies,
      signups7d,
      signups30d,
      agentTotal,
      platformUsers,
      companyUsers
    ] = await Promise.all([
      prisma.company.findMany({
        orderBy: { registeredAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          agents: true,
          mrr: true,
          registeredAt: true,
          subscriptionStatus: true,
          contactEmail: true,
          lockState: true,
          planTier: true,
          userSeats: true
        }
      }),
      prisma.company.count({ where: { registeredAt: { gte: day7 } } }),
      prisma.company.count({ where: { registeredAt: { gte: day30 } } }),
      prisma.agent.count(),
      prisma.user.count({
        where: { companyId: null, role: { in: ['system_owner', 'platform_staff'] } }
      }),
      prisma.user.count({ where: { companyId: { not: null } } })
    ]);

    const active = companies.filter((c) => c.status === 'active').length;
    const suspended = companies.filter((c) => c.status === 'suspended').length;
    const mrr = companies.reduce((s, c) => {
      if (c.subscriptionStatus !== 'ACTIVE') return s;
      return s + (c.mrr || 0);
    }, 0);

    const subscriptionCounts = {};
    for (const c of companies) {
      const key = c.subscriptionStatus || 'NONE';
      subscriptionCounts[key] = (subscriptionCounts[key] || 0) + 1;
    }

    const attention = sortAttention(
      companies
        .map((c) => toAttentionItem(c, { agentCount: c.agents }))
        .filter(Boolean)
    );

    const attentionBySeverity = {
      critical: attention.filter((a) => a.severity === 'critical').length,
      high: attention.filter((a) => a.severity === 'high').length,
      medium: attention.filter((a) => a.severity === 'medium').length
    };

    res.json({
      companies: {
        total: companies.length,
        active,
        suspended,
        signups7d,
        signups30d,
        needsAttention: attention.length
      },
      agents: { total: agentTotal },
      users: { platform: platformUsers, company: companyUsers },
      revenue: { mrr },
      subscriptions: subscriptionCounts,
      attention: {
        count: attention.length,
        bySeverity: attentionBySeverity,
        items: attention.slice(0, 12)
      },
      recentSignups: companies.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        contactEmail: c.contactEmail,
        registeredAt: c.registeredAt,
        subscriptionStatus: c.subscriptionStatus,
        lockState: c.lockState
      }))
    });
  } catch (err) {
    next(err);
  }
});

export default router;
