import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { companyFilter } from '../middleware/user.js';
import { syncFloatAlerts } from '../lib/float-alerts.js';
import { relativeTime } from '../lib/visit-utils.js';
import { getOnboardingConfig } from '../lib/onboarding-config.js';
import { requireRoles } from '../middleware/auth.js';
import { buildAdrPerformance } from '../lib/performance.js';
import {
  buildExtendedStats,
  buildFloatTrend,
  buildTrainingProgress
} from '../lib/analytics.js';

const router = Router();

router.get('/zones', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }
    const config = await getOnboardingConfig(companyId);
    res.json(config.zone_names);
  } catch (err) {
    next(err);
  }
});

router.get('/onboarding-config', requireRoles('manager', 'team_lead', 'adr'), async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }
    const config = await getOnboardingConfig(companyId);
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.get('/officers', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    if (!companyId) {
      return res.json([]);
    }
    const rows = await buildAdrPerformance(companyId);
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        agents: r.agents,
        visits: r.visits_done,
        target: r.visit_target,
        score: r.visit_rate,
        zone: r.zone
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    if (companyId) {
      await syncFloatAlerts(companyId);
    }

    const where = { dismissedAt: null };
    if (companyId) where.companyId = companyId;

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }]
    });

    res.json(
      alerts.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        body: a.body,
        time: relativeTime(a.createdAt),
        agent: a.agentId
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.patch('/alerts/:id/dismiss', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    if (!companyId) {
      return res.status(403).json({ error: 'Company context required' });
    }

    const alert = await prisma.alert.findFirst({
      where: { id: Number(req.params.id), companyId, dismissedAt: null }
    });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    const updated = await prisma.alert.update({
      where: { id: alert.id },
      data: { dismissedAt: new Date(), time: 'Dismissed' }
    });

    res.json({ id: updated.id, dismissed: true });
  } catch (err) {
    next(err);
  }
});

router.get('/training', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    if (!companyId) {
      return res.json([]);
    }
    const training = await buildTrainingProgress(companyId);
    res.json(training);
  } catch (err) {
    next(err);
  }
});

router.get('/float-trend', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    if (!companyId) {
      return res.json({ labels: [], efloat: [], cash: [] });
    }
    const trend = await buildFloatTrend(companyId);
    res.json(trend);
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }
    const stats = await buildExtendedStats(req.user);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

export default router;
