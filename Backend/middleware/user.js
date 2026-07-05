import { prisma } from '../lib/prisma.js';

export async function loadUser(req, res, next) {
  try {
    const row = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      include: { company: true }
    });

    if (!row) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      companyId: row.companyId,
      company: row.company?.name || 'ANMS Platform',
      scope: row.scope,
      zone: row.zone,
      status: row.status
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function companyFilter(user) {
  if (user.role === 'system_owner') return null;
  return user.companyId || 'co-aps';
}

/** Prisma where-clause: agents visible to the current user. */
export function agentWhereForUser(user) {
  const where = {};
  const companyId = companyFilter(user);
  if (companyId) where.companyId = companyId;
  if (user.role === 'agent') where.id = user.scope;
  if (user.role === 'adr') {
    where.OR = [
      { officerId: user.id },
      { officerId: null, officer: user.name }
    ];
  }
  return where;
}

export function isAgentAssignedToUser(agent, user) {
  if (!agent || user.role !== 'adr') return true;
  if (agent.officerId) return agent.officerId === user.id;
  return agent.officer === user.name;
}

export async function resolveOfficerAssignment(companyId, { officerId, officerName, fallback }) {
  if (officerId) {
    const adr = await prisma.user.findFirst({
      where: { id: officerId, companyId, role: 'adr' }
    });
    if (!adr) return null;
    return { officerId: adr.id, officer: adr.name };
  }
  if (officerName?.trim()) {
    const adr = await prisma.user.findFirst({
      where: {
        companyId,
        role: 'adr',
        name: { equals: officerName.trim(), mode: 'insensitive' }
      }
    });
    if (adr) return { officerId: adr.id, officer: adr.name };
    return { officerId: null, officer: officerName.trim() };
  }
  return fallback;
}

export async function nextAgentId(companyId) {
  const prefix = 'APW-';
  const latest = await prisma.agent.findFirst({
    where: { companyId, id: { startsWith: prefix } },
    orderBy: { id: 'desc' }
  });

  if (!latest) return `${prefix}0001`;
  const num = parseInt(latest.id.replace(prefix, ''), 10) + 1;
  return `${prefix}${String(num).padStart(4, '0')}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function serializeAgent(agent, extra = {}) {
  return {
    id: agent.id,
    company_id: agent.companyId,
    name: agent.name,
    zone: agent.zone,
    phone: agent.phone,
    status: agent.status,
    efloat: agent.efloat,
    cash: agent.cash,
    score: agent.score,
    visits: agent.visits,
    officer: agent.officer,
    officer_id: agent.officerId ?? null,
    joined: agent.joined,
    lat: agent.lat,
    lng: agent.lng,
    kyc: agent.kyc,
    kyc_review_note: agent.kycReviewNote ?? null,
    kyc_reviewed_at: agent.kycReviewedAt ?? null,
    last_visit: agent.lastVisit,
    national_id: agent.nationalId ?? null,
    business_type: agent.businessType ?? null,
    ...extra
  };
}
