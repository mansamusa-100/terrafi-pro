import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { getDirectPayConfig } from '../lib/directpay.js';
import {
  cachedCompanySubscription,
  issueCompanyPayLink,
  provisionCompany,
  startCompanySubscription,
  syncCompanySubscription,
  upgradeCompanyPlan
} from '../lib/company-billing.js';
import { nextUpgradeTiers, getPlanTier } from '../lib/plans.js';


const router = Router();

router.use(requireRoles('manager', 'system_owner'));

/** Soft re-sync if cache is older than this (avoids slow every click). */
const STALE_MS = Number(process.env.BILLING_STATUS_STALE_MS || 20000);

function resolveCompanyId(user, queryCompanyId) {
  if (user.role === 'system_owner') return queryCompanyId || null;
  return user.companyId;
}

async function loadCompany(companyId) {
  return prisma.company.findUnique({ where: { id: companyId } });
}

function wantsLiveSync(req) {
  const q = req.query.sync ?? req.query.live;
  return q === '1' || q === 'true' || req.query.refresh === '1';
}

function isStale(company) {
  if (!company?.directPayBusinessId) return false;
  if (!company.subscriptionSyncedAt) return true;
  return Date.now() - new Date(company.subscriptionSyncedAt).getTime() > STALE_MS;
}

router.get('/status', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req.user, req.query.companyId);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }
    let company = await loadCompany(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const { configured } = getDirectPayConfig();
    const shouldSync =
      configured &&
      company.directPayBusinessId &&
      (wantsLiveSync(req) || isStale(company));

    if (shouldSync) {
      try {
        await syncCompanySubscription(companyId);
        company = await loadCompany(companyId);
      } catch (err) {
        console.warn('[billing/status] live sync skipped:', err.message);
      }
    }

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
    if (err.code === 'DIRECTPAY_TIMEOUT') {
      return res.status(504).json({ error: err.message });
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
    if (err.code === 'DIRECTPAY_TIMEOUT') {
      return res.status(504).json({ error: err.message });
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
    if (err.code === 'DIRECTPAY_TIMEOUT') {
      return res.status(504).json({ error: err.message });
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
    if (err.code === 'DIRECTPAY_TIMEOUT') {
      return res.status(504).json({ error: err.message });
    }
    next(err);
  }
});

/** Upgrade to a higher Terrafi Pro tier (Basic → Standard → Unlimited). */
router.post('/upgrade', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req.user, req.body.companyId);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }
    if (!req.body.planTier) {
      return res.status(400).json({ error: 'planTier is required' });
    }
    const subscription = await upgradeCompanyPlan(
      companyId,
      req.body.planTier,
      req.body.billingInterval
    );
    res.json({ ok: true, subscription });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message?.includes('not provisioned')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'DIRECTPAY_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DirectPay is not configured' });
    }
    if (err.code === 'DIRECTPAY_TIMEOUT') {
      return res.status(504).json({ error: err.message });
    }
    next(err);
  }
});

router.get('/plans', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req.user, req.query.companyId);
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }
    const company = await loadCompany(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const current = getPlanTier(company.planTier);
    res.json({
      currentTier: company.planTier || null,
      currentPlan: current
        ? {
            id: current.id,
            name: current.name,
            seats: current.seats,
            monthlyPriceGmd: current.monthlyPriceGmd
          }
        : null,
      upgrades: nextUpgradeTiers(company.planTier || 'basic').map((p) => ({
        id: p.id,
        name: p.name,
        seats: p.seats,
        seatsLabel: p.seats == null ? 'Unlimited users' : `Up to ${p.seats} users`,
        monthlyPriceGmd: p.monthlyPriceGmd,
        quarterlyPriceGmd: p.monthlyPriceGmd * 3,
        features: p.features
      })),
      subscription: cachedCompanySubscription(company)
    });
  } catch (err) {
    next(err);
  }
});

/** Platform owner: pull latest subscription + MRR for every provisioned company. */
router.post('/sync-all', requireRoles('system_owner'), async (_req, res, next) => {
  try {
    const { configured } = getDirectPayConfig();
    if (!configured) {
      return res.status(503).json({ error: 'DirectPay is not configured' });
    }
    const companies = await prisma.company.findMany({
      where: { directPayBusinessId: { not: null } },
      select: { id: true, name: true }
    });

    const results = [];
    for (const c of companies) {
      try {
        const subscription = await syncCompanySubscription(c.id);
        results.push({
          companyId: c.id,
          name: c.name,
          ok: true,
          status: subscription.status,
          mrr: subscription.mrr ?? 0
        });
      } catch (err) {
        results.push({
          companyId: c.id,
          name: c.name,
          ok: false,
          error: err.message
        });
      }
    }

    const mrr = results.reduce((s, r) => s + (r.ok ? r.mrr || 0 : 0), 0);
    res.json({ ok: true, synced: results.filter((r) => r.ok).length, total: results.length, mrr, results });
  } catch (err) {
    next(err);
  }
});

export default router;
