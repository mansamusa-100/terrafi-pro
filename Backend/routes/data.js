import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { companyFilter, todayISO, agentWhereForUser, applyVisitOfficerFilter } from '../middleware/user.js';
import { syncFloatAlerts } from '../lib/float-alerts.js';
import { relativeTime } from '../lib/visit-utils.js';
import { getOnboardingConfig } from '../lib/onboarding-config.js';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/zones', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user) || 'co-aps';
    const config = await getOnboardingConfig(companyId);
    res.json(config.zone_names);
  } catch (err) {
    next(err);
  }
});

router.get('/onboarding-config', requireRoles('manager', 'team_lead', 'adr'), async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user) || 'co-aps';
    const config = await getOnboardingConfig(companyId);
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.get('/officers', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user) || 'co-aps';
    const officers = await prisma.officer.findMany({
      where: { companyId },
      orderBy: { score: 'desc' }
    });
    res.json(officers);
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
    const companyId = companyFilter(req.user) || 'co-aps';
    const training = await prisma.trainingModule.findMany({
      where: { companyId },
      orderBy: { id: 'asc' }
    });
    res.json(training);
  } catch (err) {
    next(err);
  }
});

router.get('/float-trend', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user) || 'co-aps';
    const rows = await prisma.floatTrendPoint.findMany({
      where: { companyId },
      orderBy: { dayIndex: 'asc' }
    });
    res.json({
      labels: rows.map((r) => r.label),
      efloat: rows.map((r) => r.efloat),
      cash: rows.map((r) => r.cash)
    });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user) || 'co-aps';
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    const agentWhere = agentWhereForUser(req.user);
    const agents = await prisma.agent.findMany({ where: agentWhere });
    const today = todayISO();
    const visitWhere = { visitDate: today };
    if (companyId) visitWhere.companyId = companyId;
    applyVisitOfficerFilter(visitWhere, req.user);

    const visits = await prisma.visit.findMany({ where: visitWhere });

    const statusCounts = agents.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});

    const visitsToday = visits.reduce((acc, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalAgents: company?.agents ?? agents.length,
      statusCounts,
      visitsToday
    });
  } catch (err) {
    next(err);
  }
});

export default router;
