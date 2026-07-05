import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { getDirectPayConfig } from '../lib/directpay.js';
import {
  cachedCompanySubscription,
  issueCompanyPayLink,
  provisionCompany,
  startCompanySubscription,
  syncCompanySubscription
} from '../lib/company-billing.js';

const router = Router();

router.use(requireRoles('manager', 'system_owner'));

function resolveCompanyId(user, queryCompanyId) {
  if (user.role === 'system_owner') return queryCompanyId || null;
  return user.companyId;
}

async function loadCompany(companyId) {
  return prisma.company.findUnique({ where: { id: companyId } });
}

router.get('/status', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req.user, req.query.companyId);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }
    const company = await loadCompany(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const { configured } = getDirectPayConfig();
    res.json({
      company_id: company.id,
      company_name: company.name,
      configured,
      subscription: cachedCompanySubscription(company)
    });
  } catch (err) {
    next(err);
  }
});

router.post('/provision', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req.user, req.body.companyId);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }
    const { configured } = getDirectPayConfig();
    if (!configured) {
      return res.status(503).json({ error: 'DirectPay is not configured' });
    }
    const company = await loadCompany(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const ownerEmail = company.contactEmail || req.user.email;
    const data = await provisionCompany(company, {
      ownerEmail,
      ownerName: req.user.name
    });
    const subscription = await syncCompanySubscription(companyId);
    res.json({ ok: true, provision: data, subscription });
  } catch (err) {
    if (err.code === 'DIRECTPAY_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DirectPay is not configured' });
    }
    next(err);
  }
});

router.post('/subscription', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req.user, req.body.companyId);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }
    const subscription = await startCompanySubscription(companyId, {
      planCode: req.body.planCode,
      billingInterval: req.body.billingInterval
    });
    res.json({ ok: true, subscription });
  } catch (err) {
    if (err.message?.includes('not provisioned')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'DIRECTPAY_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DirectPay is not configured' });
    }
    next(err);
  }
});

router.post('/pay-link', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req.user, req.body.companyId);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }
    const result = await issueCompanyPayLink(companyId);
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({
        error:
          err.body?.error ||
          'No payable subscription invoice is available yet.'
      });
    }
    if (err.message?.includes('not provisioned')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'DIRECTPAY_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DirectPay is not configured' });
    }
    next(err);
  }
});

router.post('/sync', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req.user, req.body.companyId);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }
    const subscription = await syncCompanySubscription(companyId);
    res.json({ ok: true, subscription });
  } catch (err) {
    if (err.code === 'DIRECTPAY_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DirectPay is not configured' });
    }
    next(err);
  }
});

export default router;
