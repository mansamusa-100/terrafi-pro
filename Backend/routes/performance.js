import { Router } from 'express';
import { companyFilter } from '../middleware/user.js';
import { requireRoles } from '../middleware/auth.js';
import { buildAdrPerformance } from '../lib/performance.js';
import { buildAgentVisitSparklines } from '../lib/analytics.js';
import { buildAgentRegistryReport } from '../lib/agent-registry.js';
import { buildOfficerReport } from '../lib/officer-report.js';
import { buildOfficerJourney } from '../lib/journey-tracking.js';
import { buildAgentListByAdr } from '../lib/agent-list-by-adr.js';

const router = Router();

router.get('/adr', requireRoles('manager', 'internal', 'team_lead'), async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user) || 'co-aps';
    const options = {};
    if (req.user.role === 'team_lead') {
      options.officerIds = req.user.supervisedAdrIds || [];
    }
    const rows = await buildAdrPerformance(companyId, options);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/adr/me', requireRoles('adr'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 'co-aps';
    const rows = await buildAdrPerformance(companyId, {
      officerName: req.user.name
    });
    res.json(rows[0] || null);
  } catch (err) {
    next(err);
  }
});

router.get('/agent-sparklines', requireRoles('manager', 'internal', 'team_lead'), async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    if (!companyId) {
      return res.json({ labels: [], trends: {} });
    }

    let agentIds;
    if (req.user.role === 'team_lead') {
      const rows = await buildAdrPerformance(companyId, {
        officerIds: req.user.supervisedAdrIds || []
      });
      const ids = new Set();
      for (const row of rows) {
        for (const id of row.agent_ids || []) ids.add(id);
      }
      agentIds = [...ids];
    }

    const sparklines = await buildAgentVisitSparklines(companyId, agentIds);
    res.json(sparklines);
  } catch (err) {
    next(err);
  }
});

router.get(
  '/agent-report',
  requireRoles('manager', 'internal', 'team_lead', 'adr'),
  async (req, res, next) => {
    try {
      const report = await buildAgentRegistryReport(req.user, req.query);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/agent-list-by-adr',
  requireRoles('manager', 'internal', 'team_lead', 'adr'),
  async (req, res, next) => {
    try {
      const report = await buildAgentListByAdr(req.user, req.query);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/officer-report',
  requireRoles('manager', 'internal', 'team_lead', 'adr'),
  async (req, res, next) => {
    try {
      const report = await buildOfficerReport(req.user, req.query);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/officer-journey',
  requireRoles('manager', 'internal', 'team_lead', 'adr'),
  async (req, res, next) => {
    try {
      const journey = await buildOfficerJourney(req.user, {
        officerId: req.query.officer_id,
        date: req.query.date
      });
      if (!journey) {
        return res.status(404).json({ error: 'Journey not found or access denied' });
      }
      res.json(journey);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
