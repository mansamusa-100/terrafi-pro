import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import {
  buildSettingsUpdate,
  getOrCreateCompanySettings,
  resolveSettingsCompanyId,
  serializeCompanySettings
} from '../lib/company-settings.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.use(requireRoles('manager', 'system_owner'));

router.get('/', async (req, res, next) => {
  try {
    const companyId = resolveSettingsCompanyId(req.user, req.query.companyId);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const row = await getOrCreateCompanySettings(companyId);
    res.json(serializeCompanySettings(row));
  } catch (err) {
    next(err);
  }
});

router.patch('/', async (req, res, next) => {
  try {
    const companyId = resolveSettingsCompanyId(req.user, req.query.companyId);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const data = buildSettingsUpdate(req.body);
    const row = await prisma.companySettings.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data
    });

    res.json(serializeCompanySettings(row));
  } catch (err) {
    if (err.message?.startsWith('Invalid') || err.message?.includes('not editable') || err.message?.includes('No editable')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
