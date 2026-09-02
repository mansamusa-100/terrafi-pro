import { prisma } from '../lib/prisma.js';
import { loadSupervisedAdrs, isTeamLeadRole } from '../lib/team-lead.js';
import { resolveBranding } from '../lib/branding.js';
import { parseAssignedCapabilities, ASSIGNABLE_ROLES } from '../lib/internal-capabilities.js';

export async function loadUser(req, res, next) {
  try {
    const row = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      include: { company: true }
    });

    if (!row) {
      return res.status(401).json({ error: 'User not found' });
    }

    const supervised =
      row.role === 'team_lead'
        ? await loadSupervisedAdrs(row.id)
        : { supervisedAdrIds: [], supervisedAdrNames: [] };

    req.user = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      companyId: row.companyId,
      company: row.company?.name || 'ANMS Platform',
      companyRecord: row.company || null,
      scope: row.scope,
      zone: row.zone,
      status: row.status,
      internalCapabilities: parseAssignedCapabilities(row.internalCapabilities),
      ...supervised
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
  if (isTeamLeadRole(user.role)) {
    const adrIds = user.supervisedAdrIds || [];
    const adrNames = user.supervisedAdrNames || [];
    if (adrIds.length === 0) {
      where.officerId = '__none__';
    } else {
      where.OR = [
        { officerId: { in: adrIds } },
        { officerId: null, officer: { in: adrNames } }
      ];
    }
  }
  return where;
}

export function isAgentAssignedToUser(agent, user) {
  if (!agent) return false;
  if (user.role === 'adr') {
    if (agent.officerId) return agent.officerId === user.id;
    return agent.officer === user.name;
  }
  if (isTeamLeadRole(user.role)) {
    const adrIds = user.supervisedAdrIds || [];
    const adrNames = user.supervisedAdrNames || [];
    if (agent.officerId) return adrIds.includes(agent.officerId);
    return adrNames.includes(agent.officer);
  }
  return true;
}

/** Visit officer filter: string name, { in: names }, or null for all. */
export function visitOfficerFilter(user) {
  if (user.role === 'adr') return user.name;
  if (isTeamLeadRole(user.role)) {
    const names = [...new Set([...(user.supervisedAdrNames || []), user.name])];
    return names.length ? { in: names } : { in: ['__none__'] };
  }
  return null;
}

export function applyVisitOfficerFilter(where, user) {
  const filter = visitOfficerFilter(user);
  if (filter) where.officer = filter;
  return where;
}

export function canAccessVisit(visit, user) {
  if (!visit) return false;
  if (user.role === 'adr') return visit.officer === user.name;
  if (isTeamLeadRole(user.role)) {
    const names = [...new Set([...(user.supervisedAdrNames || []), user.name])];
    return names.includes(visit.officer);
  }
  return true;
}

/** Officer name + id recorded on a visit for the current user. */
export function visitOfficerForUser(user, agent) {
  if (user.role === 'adr' || user.role === 'manager' || user.role === 'team_lead') {
    return { officerId: user.id, officer: user.name };
  }
  return {
    officerId: agent.officerId || null,
    officer: agent.officer
  };
}

export async function resolveOfficerAssignment(
  companyId,
  { officerId, officerName, fallback },
  { allowedAdrIds = null } = {}
) {
  if (officerId) {
    if (allowedAdrIds && !allowedAdrIds.includes(officerId)) {
      return null;
    }
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
    if (adr) {
      if (allowedAdrIds && !allowedAdrIds.includes(adr.id)) return null;
      return { officerId: adr.id, officer: adr.name };
    }
    return { officerId: null, officer: officerName.trim() };
  }
  return fallback;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Agent.id is a global primary key. Never allocate per-company only with a
 * shared prefix (e.g. APW-0001) — that collides across tenants.
 */
async function resolveAgentIdPrefix(companyId) {
  const own = await prisma.agent.findFirst({
    where: { companyId },
    select: { id: true },
    orderBy: { id: 'asc' }
  });
  if (own?.id) {
    const m = own.id.match(/^([A-Za-z][A-Za-z0-9]*-)/);
    if (m) return m[1].toUpperCase();
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const fromName = (company?.name || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 3);
  if (fromName.length >= 2) return `${fromName}-`;

  const fromId = companyId
    .replace(/^co-/i, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 3);
  return `${fromId || 'AGT'}-`;
}

export async function nextAgentId(companyId) {
  const prefix = await resolveAgentIdPrefix(companyId);
  const rows = await prisma.agent.findMany({
    where: { id: { startsWith: prefix } },
    select: { id: true }
  });

  let max = 0;
  const re = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`, 'i');
  for (const { id } of rows) {
    const m = id.match(re);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }

  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function serializeAgent(agent, extra = {}, options = {}) {
  const { includeLocationPhoto = true } = options;
  const base = {
    id: agent.id,
    company_id: agent.companyId,
    name: agent.name,
    outlet_name: agent.outletName ?? null,
    zone: agent.zone,
    town_village: agent.townVillage ?? null,
    phone: agent.phone,
    personal_phone: agent.personalPhone ?? null,
    status: agent.status,
    efloat: agent.efloat,
    cash: agent.cash,
    score: agent.score,
    visits: agent.visits,
    officer: agent.officer,
    officer_id: agent.officerId ?? null,
    joined: agent.joined,
    created_at: agent.createdAt?.toISOString?.() ?? agent.createdAt ?? null,
    gender: agent.gender ?? null,
    onboarded_by_id: agent.onboardedById ?? null,
    onboarded_by_name: agent.onboardedBy?.name ?? null,
    kyc_reviewed_by_id: agent.kycReviewedById ?? null,
    kyc_reviewed_by_name: agent.kycReviewedBy?.name ?? null,
    lat: agent.lat,
    lng: agent.lng,
    kyc: agent.kyc,
    kyc_review_note: agent.kycReviewNote ?? null,
    kyc_reviewed_at: agent.kycReviewedAt ?? null,
    last_visit: agent.lastVisit,
    national_id: agent.nationalId ?? null,
    business_type: agent.businessType ?? null,
    business_type_other: agent.businessTypeOther ?? null,
    competitors_present: Array.isArray(agent.competitorsPresent)
      ? agent.competitorsPresent
      : [],
    branding_present: Array.isArray(agent.brandingPresent)
      ? agent.brandingPresent
      : [],
    ...extra
  };
  if (includeLocationPhoto) {
    base.location_photo_url = agent.locationPhotoPath
      ? `/uploads/${agent.locationPhotoPath}`
      : null;
  }
  return base;
}

export function serializeAppUser(row, supervised = null) {
  const branding = resolveBranding(row.role, row.company ?? null);
  const internal_capabilities = ASSIGNABLE_ROLES.includes(row.role)
    ? parseAssignedCapabilities(row.internalCapabilities)
    : [];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    company: row.company?.name || branding.title,
    company_id: row.companyId ?? null,
    scope: row.scope,
    zone: row.zone ?? null,
    status: row.status,
    must_change_password: row.status === 'invited',
    supervised_adr_ids: supervised?.supervisedAdrIds ?? [],
    internal_capabilities,
    branding
  };
}
