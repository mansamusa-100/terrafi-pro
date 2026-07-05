import { Router } from 'express';
import { companyFilter } from '../middleware/user.js';
import { requireRoles } from '../middleware/auth.js';
import { buildAdrPerformance } from '../lib/performance.js';

const router = Router();

router.get('/adr', requireRoles('manager', 'internal'), async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user) || 'co-aps';
    const rows = await buildAdrPerformance(companyId);
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

export default router;
