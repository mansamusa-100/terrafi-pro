import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { requireRoles } from '../middleware/auth.js';
import {
  buildSettingsUpdate,
  getOrCreateCompanySettings,
  resolveSettingsCompanyId,
  serializeCompanySettings
} from '../lib/company-settings.js';
import { companyLogoUpload, brandingUploadDir } from '../middleware/upload.js';
import { companyLogoUrl } from '../lib/branding.js';
import { prisma } from '../lib/prisma.js';
import { logAudit } from '../lib/audit.js';

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
    res.json(await serializeCompanySettings(row, company));
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

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    res.json(await serializeCompanySettings(row, company));
  } catch (err) {
    if (err.message?.startsWith('Invalid') || err.message?.includes('not editable') || err.message?.includes('No editable')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.post(
  '/logo',
  requireRoles('manager'),
  companyLogoUpload.single('file'),
  async (req, res, next) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) {
        return res.status(400).json({ error: 'Company context required' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Logo image is required' });
      }

      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      if (company.logoPath) {
        const oldPath = path.join(brandingUploadDir, path.basename(company.logoPath));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const logoPath = path.posix.join('branding', req.file.filename);
      const updated = await prisma.company.update({
        where: { id: companyId },
        data: { logoPath }
      });

      await logAudit({
        scope: 'company',
        companyId,
        actor: req.user,
        action: 'company.logo_updated',
        entityType: 'company',
        entityId: companyId
      });

      res.json({
        logo_url: companyLogoUrl(updated.logoPath),
        company_name: updated.name
      });
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/logo', requireRoles('manager'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (company.logoPath) {
      const oldPath = path.join(brandingUploadDir, path.basename(company.logoPath));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { logoPath: null }
    });

    res.json({ logo_url: null });
  } catch (err) {
    next(err);
  }
});

export default router;
