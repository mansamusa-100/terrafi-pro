import { prisma } from './prisma.js';
import {
  GRACE_DAYS,
  LOCK_STATES,
  RENEWAL_NOTICE_DAYS,
  getPlanTier
} from './plans.js';
import { notifyCompanyRoles } from './notifications.js';
import { isPlatformRole } from './audit.js';
import { logBillingLifecycleReport } from './notification-report.js';

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfUtcDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Compute lock/grace state from period end + DirectPay status.
 * Returns { lockState, graceUntil, accessAllowed, reason }.
 */
export function evaluateSubscriptionAccess(company, now = new Date()) {
  if (!company) {
    return {
      lockState: LOCK_STATES.OPEN,
      graceUntil: null,
      accessAllowed: true,
      reason: null
    };
  }

  // Explicit locked (already past grace)
  if (company.lockState === LOCK_STATES.LOCKED) {
    return {
      lockState: LOCK_STATES.LOCKED,
      graceUntil: company.subscriptionGraceUntil,
      accessAllowed: false,
      reason: 'subscription_locked'
    };
  }

  const status = company.subscriptionStatus;
  const periodEnd = company.subscriptionPeriodEnd
    ? new Date(company.subscriptionPeriodEnd)
    : null;

  // Never provisioned / no period — allow (registration settling)
  if (!company.directPayBusinessId && !periodEnd && !status) {
    return {
      lockState: LOCK_STATES.OPEN,
      graceUntil: null,
      accessAllowed: true,
      reason: null
    };
  }

  const hardFailStatuses = new Set(['EXPIRED', 'CANCELLED']);
  const softOk = new Set(['ACTIVE', 'TRIALING', 'PAST_DUE']);

  let graceUntil = company.subscriptionGraceUntil
    ? new Date(company.subscriptionGraceUntil)
    : null;

  // Enter grace when period ended or DirectPay says expired/cancelled
  const periodEnded = periodEnd && now.getTime() > periodEnd.getTime();
  const statusFailed = status && hardFailStatuses.has(status);

  if (periodEnded || statusFailed) {
    if (!graceUntil && periodEnd) {
      graceUntil = addDays(periodEnd, GRACE_DAYS);
    } else if (!graceUntil) {
      graceUntil = addDays(now, GRACE_DAYS);
    }

    if (now.getTime() > graceUntil.getTime()) {
      return {
        lockState: LOCK_STATES.LOCKED,
        graceUntil,
        accessAllowed: false,
        reason: 'subscription_locked'
      };
    }

    return {
      lockState: LOCK_STATES.GRACE,
      graceUntil,
      accessAllowed: true,
      reason: 'subscription_grace'
    };
  }

  // Active / trial / past_due with period still open
  if (!status || softOk.has(status)) {
    return {
      lockState: LOCK_STATES.OPEN,
      graceUntil: null,
      accessAllowed: true,
      reason: null
    };
  }

  // Unknown status with no period — be permissive
  return {
    lockState: LOCK_STATES.OPEN,
    graceUntil: null,
    accessAllowed: true,
    reason: null
  };
}

export function subscriptionViewExtras(company) {
  const access = evaluateSubscriptionAccess(company);
  const plan = getPlanTier(company.planTier);
  return {
    planTier: company.planTier ?? null,
    planName: plan?.name ?? company.plan ?? null,
    userSeats: company.userSeats ?? plan?.seats ?? null,
    monthlyPriceGmd: plan?.monthlyPriceGmd ?? null,
    lockState: access.lockState,
    graceUntil: access.graceUntil?.toISOString?.() ?? access.graceUntil ?? null,
    accessAllowed: access.accessAllowed,
    accessReason: access.reason
  };
}

/** Persist evaluated lockState / graceUntil when they change. */
export async function applySubscriptionLifecycle(companyId, { notify = true } = {}) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return null;

  const access = evaluateSubscriptionAccess(company);
  const patch = {};
  if (company.lockState !== access.lockState) {
    patch.lockState = access.lockState;
  }
  if (access.graceUntil) {
    const prev = company.subscriptionGraceUntil
      ? new Date(company.subscriptionGraceUntil).getTime()
      : null;
    if (prev !== access.graceUntil.getTime()) {
      patch.subscriptionGraceUntil = access.graceUntil;
    }
  } else if (access.lockState === LOCK_STATES.OPEN && company.subscriptionGraceUntil) {
    patch.subscriptionGraceUntil = null;
  }

  // Renewal notice: within RENEWAL_NOTICE_DAYS before period end
  const periodEnd = company.subscriptionPeriodEnd
    ? new Date(company.subscriptionPeriodEnd)
    : null;
  let shouldNotifyRenewal = false;
  if (periodEnd && access.lockState === LOCK_STATES.OPEN) {
    const msLeft = periodEnd.getTime() - Date.now();
    const daysLeft = msLeft / (24 * 60 * 60 * 1000);
    if (daysLeft > 0 && daysLeft <= RENEWAL_NOTICE_DAYS) {
      const already =
        company.renewalNotifiedAt &&
        company.subscriptionPeriodEnd &&
        new Date(company.renewalNotifiedAt).getTime() >=
          startOfUtcDay(
            addDays(periodEnd, -RENEWAL_NOTICE_DAYS)
          ).getTime();
      if (!already) {
        shouldNotifyRenewal = true;
        patch.renewalNotifiedAt = new Date();
      }
    }
  }

  // Reset renewal notice flag when a new period starts (synced later)
  if (
    periodEnd &&
    company.renewalNotifiedAt &&
    new Date(company.renewalNotifiedAt).getTime() > periodEnd.getTime()
  ) {
    // keep
  }

  let updated = company;
  if (Object.keys(patch).length) {
    updated = await prisma.company.update({
      where: { id: companyId },
      data: patch
    });
  }

  if (notify && shouldNotifyRenewal) {
    const endLabel = periodEnd.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    await notifyCompanyRoles({
      companyId,
      roles: ['manager'],
      type: 'billing.renewal_soon',
      title: 'Subscription renews soon',
      body: `Your Terrafi Pro subscription period ends on ${endLabel}. Please settle payment to avoid interruption. After the end date you have ${GRACE_DAYS} days to pay before access is locked.`,
      entityType: 'company',
      entityId: companyId
    });
    await logBillingLifecycleReport({
      company: updated,
      type: 'billing.renewal_soon',
      title: 'Subscription ending soon',
      detail: `${updated.name} period ends ${endLabel} · ${GRACE_DAYS}-day grace after end`
    });
  }

  if (notify && patch.lockState === LOCK_STATES.GRACE) {
    const until = access.graceUntil?.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    await notifyCompanyRoles({
      companyId,
      roles: ['manager', 'internal', 'team_lead', 'adr', 'agent', 'teller'],
      type: 'billing.grace',
      title: 'Subscription payment overdue',
      body: `Your subscription period has ended. You have until ${until} to settle payment. After that, only the network manager can access Terrafi Pro to pay.`,
      entityType: 'company',
      entityId: companyId
    });
    await logBillingLifecycleReport({
      company: updated,
      type: 'billing.period_ended',
      title: 'Subscription period ended',
      detail: `${updated.name} entered grace · pay by ${until || 'grace deadline'} · status ${updated.subscriptionStatus || '—'}`
    });
  }

  if (notify && patch.lockState === LOCK_STATES.LOCKED) {
    await notifyCompanyRoles({
      companyId,
      roles: ['manager'],
      type: 'billing.locked',
      title: 'Access locked — payment required',
      body: 'Your grace period has ended. Only the network manager can sign in, and must pay the subscription to restore the team.',
      entityType: 'company',
      entityId: companyId
    });
    await notifyCompanyRoles({
      companyId,
      roles: ['internal', 'team_lead', 'adr', 'agent', 'teller'],
      type: 'billing.locked',
      title: 'Access temporarily locked',
      body: 'Your organisation subscription is overdue. Contact your network manager to restore access after payment.',
      entityType: 'company',
      entityId: companyId
    });
    await logBillingLifecycleReport({
      company: updated,
      type: 'billing.locked',
      title: 'Subscription locked',
      detail: `${updated.name} access locked after grace · status ${updated.subscriptionStatus || '—'}`
    });
  }

  // Clear renewal marker when ACTIVE with a fresh period after payment
  if (
    updated.subscriptionStatus === 'ACTIVE' &&
    updated.lockState === LOCK_STATES.OPEN &&
    updated.subscriptionPeriodEnd &&
    updated.renewalNotifiedAt &&
    new Date(updated.renewalNotifiedAt) <
      addDays(new Date(updated.subscriptionPeriodEnd), -RENEWAL_NOTICE_DAYS)
  ) {
    // nothing
  }

  return { company: updated, access };
}

/** Clear lock after successful payment / active sync. */
export async function clearSubscriptionLock(companyId) {
  return prisma.company.update({
    where: { id: companyId },
    data: {
      lockState: LOCK_STATES.OPEN,
      subscriptionGraceUntil: null,
      renewalNotifiedAt: null
    }
  });
}

export async function runSubscriptionLifecycleSweep() {
  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { directPayBusinessId: { not: null } },
        { subscriptionPeriodEnd: { not: null } }
      ]
    },
    select: { id: true }
  });

  let updated = 0;
  for (const c of companies) {
    try {
      const before = await prisma.company.findUnique({ where: { id: c.id } });
      const result = await applySubscriptionLifecycle(c.id, { notify: true });
      if (result && before && before.lockState !== result.access.lockState) {
        updated += 1;
      }
    } catch (err) {
      console.warn('[subscription-lifecycle]', c.id, err.message);
    }
  }
  return { scanned: companies.length, lockTransitions: updated };
}

export function isBillingAllowlistedPath(path = '') {
  const p = path.split('?')[0];
  return (
    p === '/billing/status' ||
    p === '/billing/pay-link' ||
    p === '/billing/sync' ||
    p === '/billing/subscription' ||
    p === '/billing/provision' ||
    p === '/billing/upgrade' ||
    p === '/billing/plans' ||
    p === '/auth/me' ||
    p === '/auth/change-password' ||
    p.startsWith('/notifications')
  );
}

export function assertUserMayAccess(user, company, reqPath) {
  if (!user?.companyId || isPlatformRole(user.role)) {
    return { ok: true };
  }
  const access = evaluateSubscriptionAccess(company);
  if (access.accessAllowed) return { ok: true, access };

  // Locked: only managers may hit billing allowlist
  if (user.role === 'manager' && isBillingAllowlistedPath(reqPath)) {
    return { ok: true, access, managerPaywall: true };
  }

  return {
    ok: false,
    access,
    error:
      user.role === 'manager'
        ? 'Your subscription is locked. Pay now to restore access.'
        : 'Your organisation subscription is locked. Ask your network manager to settle payment.',
    code: 'SUBSCRIPTION_LOCKED'
  };
}
