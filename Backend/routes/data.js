import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { companyFilter, todayISO, agentWhereForUser } from '../middleware/user.js';

const router = Router();

router.get('/zones', async (_req, res, next) => {
  try {
    const zones = await prisma.zone.findMany({ orderBy: { name: 'asc' } });
    res.json(zones.map((z) => z.name));
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
    const where = companyId ? { companyId } : {};
    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { id: 'asc' }
    });
    res.json(
      alerts.map((a) => ({
        type: a.type,
        title: a.title,
        body: a.body,
        time: a.time,
        agent: a.agentId
      }))
    );
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
    if (req.user.role === 'adr') visitWhere.officer = req.user.name;

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
