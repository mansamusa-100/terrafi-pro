import { prisma } from '../lib/prisma.js';
import { loadSupervisedAdrs, isTeamLeadRole } from '../lib/team-lead.js';

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
      scope: row.scope,
      zone: row.zone,
      status: row.status,
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
    const names = user.supervisedAdrNames || [];
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
    return (user.supervisedAdrNames || []).includes(visit.officer);
  }
  return true;
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
    location_photo_url: agent.locationPhotoPath
      ? `/uploads/${agent.locationPhotoPath}`
      : null,
    ...extra
  };
}

export function serializeAppUser(row, supervised = null) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    company: row.company?.name || 'ANMS Platform',
    scope: row.scope,
    zone: row.zone ?? null,
    supervised_adr_ids: supervised?.supervisedAdrIds ?? []
  };
}
