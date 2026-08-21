/**
 * Low-noise platform monitoring for subscriber companies.
 * Exceptions only — healthy tenants stay quiet.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEAD_SIGNUP_DAYS = 7;

const REASON_META = {
  locked: { label: 'Access locked', severity: 'critical' },
  expired: { label: 'Subscription expired', severity: 'critical' },
  past_due: { label: 'Payment past due', severity: 'high' },
  grace: { label: 'In grace period', severity: 'high' },
  suspended: { label: 'Company suspended', severity: 'high' },
  no_agents: { label: 'No agents onboarded', severity: 'medium' }
};

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

function daysSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS);
}

function maxDate(...dates) {
  const valid = dates
    .filter(Boolean)
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t));
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid));
}

/**
 * Collect exception reasons for a company. Empty = healthy / no admin action.
 */
export function companyAttentionReasons(company, opts = {}) {
  const agentCount = opts.agentCount ?? company.agents ?? 0;
  const reasons = [];

  if (company.status === 'suspended') reasons.push('suspended');

  const lock = company.lockState || 'open';
  if (lock === 'locked') reasons.push('locked');
  else if (lock === 'grace') reasons.push('grace');

  const sub = company.subscriptionStatus || '';
  if (sub === 'EXPIRED') reasons.push('expired');
  else if (sub === 'PAST_DUE') reasons.push('past_due');

  const registeredAt = company.registeredAt;
  const ageDays = daysSince(registeredAt);
  if (
    agentCount === 0 &&
    ageDays != null &&
    ageDays >= DEAD_SIGNUP_DAYS
  ) {
    reasons.push('no_agents');
  }

  return reasons;
}

export function formatAttentionReasons(reasons) {
  return reasons.map((code) => ({
    code,
    label: REASON_META[code]?.label || code,
    severity: REASON_META[code]?.severity || 'low'
  }));
}

export function primarySeverity(reasons) {
  if (!reasons.length) return null;
  return reasons
    .map((r) => REASON_META[r]?.severity || 'low')
    .sort((a, b) => SEVERITY_RANK[a] - SEVERITY_RANK[b])[0];
}

export function seatFill(userCount, userSeats) {
  if (userSeats == null) {
    return { used: userCount, seats: null, label: `${userCount} / ∞` };
  }
  return {
    used: userCount,
    seats: userSeats,
    label: `${userCount} / ${userSeats}`
  };
}

export function resolveLastActivity({ lastVisitAt, lastAuditAt, registeredAt }) {
  const at = maxDate(lastVisitAt, lastAuditAt);
  return {
    at: at ? at.toISOString() : null,
    daysAgo: daysSince(at) ?? daysSince(registeredAt),
    source: lastVisitAt && (!lastAuditAt || new Date(lastVisitAt) >= new Date(lastAuditAt))
      ? 'visit'
      : lastAuditAt
        ? 'audit'
        : registeredAt
          ? 'registered'
          : null
  };
}

/**
 * Build attention row for platform overview.
 */
export function toAttentionItem(company, opts = {}) {
  const reasons = companyAttentionReasons(company, opts);
  if (reasons.length === 0) return null;

  const formatted = formatAttentionReasons(reasons);
  return {
    id: company.id,
    name: company.name,
    status: company.status,
    subscriptionStatus: company.subscriptionStatus || null,
    lockState: company.lockState || 'open',
    agents: opts.agentCount ?? company.agents ?? 0,
    registeredAt: company.registeredAt,
    reasons: formatted,
    severity: primarySeverity(reasons)
  };
}

export function sortAttention(items) {
  return [...items].sort((a, b) => {
    const sa = SEVERITY_RANK[a.severity] ?? 9;
    const sb = SEVERITY_RANK[b.severity] ?? 9;
    if (sa !== sb) return sa - sb;
    return String(a.name).localeCompare(String(b.name));
  });
}

/**
 * Load last visit + last audit timestamps for many companies (batched).
 */
export async function loadCompanyActivityMap(prisma, companyIds) {
  const map = new Map();
  for (const id of companyIds) {
    map.set(id, { lastVisitAt: null, lastAuditAt: null });
  }
  if (companyIds.length === 0) return map;

  const [visits, audits] = await Promise.all([
    prisma.visit.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds } },
      _max: { createdAt: true }
    }),
    prisma.auditLog.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds } },
      _max: { createdAt: true }
    })
  ]);

  for (const row of visits) {
    const entry = map.get(row.companyId);
    if (entry) entry.lastVisitAt = row._max.createdAt;
  }
  for (const row of audits) {
    if (!row.companyId) continue;
    const entry = map.get(row.companyId);
    if (entry) entry.lastAuditAt = row._max.createdAt;
  }
  return map;
}

/**
 * Pulse metrics for company drawer (loaded on open).
 */
export async function loadCompanyPulse(prisma, companyId) {
  const day7 = new Date(Date.now() - 7 * DAY_MS);

  const [
    visits7d,
    kycPending,
    lastVisit,
    lastOnboardAudit,
    lastAnyAudit,
    lastManagerAudit
  ] = await Promise.all([
    prisma.visit.count({
      where: { companyId, createdAt: { gte: day7 } }
    }),
    prisma.agent.count({
      where: { companyId, kyc: 'pending' }
    }),
    prisma.visit.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }),
    prisma.auditLog.findFirst({
      where: { companyId, action: 'agent.onboarded' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }),
    prisma.auditLog.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, action: true }
    }),
    prisma.auditLog.findFirst({
      where: {
        companyId,
        action: { in: ['auth.password_set', 'user.invited', 'user.password_reset'] }
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, action: true, actorName: true }
    })
  ]);

  return {
    visits7d,
    kycPending,
    lastVisitAt: lastVisit?.createdAt?.toISOString() || null,
    lastAgentOnboardedAt: lastOnboardAudit?.createdAt?.toISOString() || null,
    lastAuditAt: lastAnyAudit?.createdAt?.toISOString() || null,
    lastAuditAction: lastAnyAudit?.action || null,
    lastManagerEventAt: lastManagerAudit?.createdAt?.toISOString() || null,
    lastManagerEvent: lastManagerAudit
      ? `${lastManagerAudit.action} · ${lastManagerAudit.actorName}`
      : null
  };
}
