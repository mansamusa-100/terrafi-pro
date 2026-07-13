import { Router } from 'express';
import { companyFilter } from '../middleware/user.js';
import { requireRoles } from '../middleware/auth.js';
import { buildAdrPerformance } from '../lib/performance.js';
import { buildAgentVisitSparklines } from '../lib/analytics.js';

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

export default router;
