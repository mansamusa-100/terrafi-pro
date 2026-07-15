import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { logAudit } from '../lib/audit.js';
import { notifyCompanyRegistered } from '../lib/notifications.js';
import { setupCompanyBilling } from '../lib/company-billing.js';
import { findRegistrationEmailConflict } from '../lib/user-email.js';
import { ensureDefaultTrainingModules } from '../lib/analytics.js';
import { getOrCreateCompanySettings } from '../lib/company-settings.js';
import {
  assertBillingInterval,
  assertPlanTier,
  directPayPlanCodeForTier,
  priceFor
} from '../lib/plans.js';

const router = Router();

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}

router.post('/register-company', async (req, res, next) => {
  try {
    const {
      companyName,
      adminName,
      adminEmail,
      password,
      zone,
      planTier: planTierRaw,
      billingInterval: billingIntervalRaw
    } = req.body;

    if (!companyName?.trim() || !adminName?.trim() || !adminEmail?.trim() || !password) {
      return res.status(400).json({
        error: 'Company name, admin name, email, and password are required'
      });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    let plan;
    let interval;
    try {
      plan = assertPlanTier(planTierRaw || 'standard');
      interval = assertBillingInterval(billingIntervalRaw || 'monthly');
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    const email = adminEmail.trim().toLowerCase();
    const emailConflict = await findRegistrationEmailConflict(email);
    if (emailConflict) {
      return res.status(409).json({ error: emailConflict });
    }

    const now = new Date();
    const since = now.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    const companyId = `co-${slugify(companyName)}-${Date.now().toString(36)}`;
    const userId = `usr-${Date.now().toString(36)}`;
    const hash = bcrypt.hashSync(password, 10);
    const periodAmount = priceFor(plan.id, interval.id);

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          id: companyId,
          name: companyName.trim(),
          plan: plan.name,
          planTier: plan.id,
          userSeats: plan.seats,
          agents: 0,
          officers: 0,
          status: 'active',
          mrr: 0,
          since,
          contactEmail: email,
          registeredAt: now,
          subscriptionBillingInterval: interval.id,
          subscriptionPlanCode: directPayPlanCodeForTier(plan.id),
          lockState: 'open'
        }
      });

      const user = await tx.user.create({
        data: {
          id: userId,
          name: adminName.trim(),
          email,
          passwordHash: hash,
          role: 'manager',
          companyId: company.id,
          scope: 'Full network',
          zone: zone?.trim() || 'Full network',
          status: 'active'
        }
      });

      return { company, user };
    });

    await logAudit({
      scope: 'company',
      companyId: result.company.id,
      actor: result.user,
      action: 'company.registered',
      entityType: 'company',
      entityId: result.company.id,
      details: { companyName: result.company.name }
    });

    await notifyCompanyRegistered(result.company);
    await getOrCreateCompanySettings(result.company.id);
    await ensureDefaultTrainingModules(result.company.id);

    // Self-service DirectPay setup: provision + start CORPORATE + pay link.
    // Cap wait time so slow DirectPay never blocks registration for long.
    const billingPromise = setupCompanyBilling({
      companyId: result.company.id,
      ownerEmail: result.user.email,
      ownerName: result.user.name,
      planTier: plan.id,
      billingInterval: interval.id
    });

    const billing = await Promise.race([
      billingPromise,
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ ok: false, skipped: true, reason: 'timeout' }),
          Number(process.env.DIRECTPAY_REGISTER_TIMEOUT_MS || 12000)
        )
      )
    ]);
    // If we timed out, keep setup running in background
    if (billing?.reason === 'timeout') {
      billingPromise.catch((err) =>
        console.warn('[register] background billing setup failed:', err?.message)
      );
    }

    res.status(201).json({
      message: 'Registration successful. You can sign in and set up your network.',
      company: {
        id: result.company.id,
        name: result.company.name,
        status: result.company.status,
        planTier: plan.id,
        planName: plan.name,
        userSeats: plan.seats,
        billingInterval: interval.id
      },
      user: {
        email: result.user.email,
        name: result.user.name,
        role: result.user.role
      },
      billing: {
        payUrl: billing?.ok ? billing.payUrl ?? null : null,
        configured: Boolean(billing && !billing.skipped),
        planTier: plan.id,
        billingInterval: interval.id,
        periodAmountGmd: periodAmount,
        monthlyPriceGmd: plan.monthlyPriceGmd
      }
    });

  } catch (err) {
    next(err);
  }
});

export default router;
