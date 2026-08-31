import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import { resolveSettingsCompanyId } from '../lib/company-settings.js';
import { prisma } from '../lib/prisma.js';
import {
  generateAndStoreFloatCredentials,
  getFloatIntegrationSettings,
  upsertFloatIntegrationSettings
} from '../lib/float-integration.js';

const router = Router();

router.use(requireRoles('manager', 'system_owner'));

async function resolveCompany(req, res) {
  const companyId = resolveSettingsCompanyId(req.user, req.query.companyId);
  if (!companyId) {
    res.status(400).json({ error: 'Company context required' });
    return null;
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return null;
  }

  return companyId;
}

router.get('/', async (req, res, next) => {
  try {
    const companyId = await resolveCompany(req, res);
    if (!companyId) return;

    res.json(await getFloatIntegrationSettings(companyId));
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const companyId = await resolveCompany(req, res);
    if (!companyId) return;

    const settings = await upsertFloatIntegrationSettings(companyId, req.body);
    res.json(settings);
  } catch (err) {
    if (err.message?.includes('must')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/generate', async (req, res, next) => {
  try {
    const companyId = await resolveCompany(req, res);
    if (!companyId) return;

    const payload = await generateAndStoreFloatCredentials(companyId);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;
