import { prisma } from './prisma.js';
import { getOrCreateCompanySettings } from './company-settings.js';
import { loadSupervisedAdrs } from './team-lead.js';
import {
  agentWhereForUser,
  companyFilter
} from '../middleware/user.js';
import {
  daysInclusive,
  isoRangeToDates,
  resolveDateRange,
  todayBoundsUTC
} from './date-range.js';

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function businessTypeLabel(agent) {
  if (!agent.businessType) return '';
  if (agent.businessType === 'Others' && agent.businessTypeOther) {
    return `Others — ${agent.businessTypeOther}`;
  }
  return agent.businessType;
}

function addressLabel(agent) {
  const parts = [agent.townVillage].filter(Boolean);
  return parts.join(', ') || '—';
}

export async function buildScopeWhere(user, { zone, officerId, teamLeadId, status, kyc, subTerritory }) {
  const where = { ...agentWhereForUser(user) };

  if (zone) where.zone = zone;
  if (subTerritory) where.subTerritory = subTerritory;
  if (status) where.status = status;
  if (kyc) where.kyc = kyc;

  if (officerId) {
    where.officerId = officerId;
  }

  if (teamLeadId) {
    const supervised = await loadSupervisedAdrs(teamLeadId);
    const adrIds = supervised.supervisedAdrIds;
    where.officerId = adrIds.length ? { in: adrIds } : '__none__';
  }

  return where;
}

export function applySearch(where, q) {
  const term = q?.trim();
  if (!term) return where;
  const contains = { contains: term, mode: 'insensitive' };
  return {
    ...where,
    AND: [
      ...(where.AND || []),
      {
        OR: [
          { id: contains },
          { name: contains },
          { outletName: contains },
          { phone: contains },
          { personalPhone: contains },
          { townVillage: contains },
          { zone: contains },
          { subTerritory: contains },
          { officer: contains }
        ]
      }
    ]
  };
}

function buildTableWhere(searchWhere, { preset, period, tableScope }) {
  if (tableScope === 'all' || preset === 'all') {
    return searchWhere;
  }

  const { from: createdFrom, to: createdTo } = isoRangeToDates(
    period.from,
    period.to
  );

  return {
    ...searchWhere,
    createdAt: { gte: createdFrom, lte: createdTo }
  };
}

export async function fetchLatestVisits(companyId, agentIds, { doneOnly = false } = {}) {
  if (!agentIds.length) return new Map();

  const visits = await prisma.visit.findMany({
    where: {
      companyId,
      agentId: { in: agentIds },
      ...(doneOnly ? { status: 'done' } : {})
    },
    orderBy: [{ visitDate: 'desc' }, { id: 'desc' }],
    select: { agentId: true, visitDate: true, officer: true }
  });

  const map = new Map();
  for (const v of visits) {
    if (!map.has(v.agentId)) map.set(v.agentId, v);
  }
  return map;
}

export async function teamLeadMapForAdrs(companyId, adrIds) {
  if (!adrIds.length) return new Map();
  const rows = await prisma.leadAdrAssignment.findMany({
    where: { companyId, adrId: { in: adrIds.filter(Boolean) } },
    include: { lead: { select: { id: true, name: true } } }
  });
  return new Map(rows.map((r) => [r.adrId, r.lead]));
}

export async function fetchVisitCounts(companyId, agentIds) {
  if (!agentIds.length) return new Map();
  const rows = await prisma.visit.groupBy({
    by: ['agentId'],
    where: { companyId, agentId: { in: agentIds }, status: 'done' },
    _count: { id: true }
  });
  return new Map(rows.map((r) => [r.agentId, r._count.id]));
}

export function serializeRow(agent, { latestVisit, teamLead, visitCount }) {
  return {
    id: agent.id,
    created_at: agent.createdAt.toISOString(),
    name: agent.name,
    outlet_name: agent.outletName ?? null,
    business_type: businessTypeLabel(agent) || null,
    status: agent.status,
    kyc: agent.kyc,
    gender: agent.gender ?? null,
    business_phone: agent.phone,
    agent_number: agent.personalPhone ?? null,
    address: addressLabel(agent),
    region: agent.zone,
    sub_region: agent.subTerritory ?? null,
    adr_id: agent.officerId ?? null,
    adr_name: agent.officer,
    team_lead_id: teamLead?.id ?? null,
    team_lead_name: teamLead?.name ?? null,
    onboarded_by_id: agent.onboardedById ?? null,
    onboarded_by_name: agent.onboardedBy?.name ?? null,
    kyc_approved_by_id: agent.kycReviewedById ?? null,
    kyc_approved_by_name: agent.kycReviewedBy?.name ?? null,
    visit_count: visitCount ?? agent.visits ?? 0,
    last_visit_date: latestVisit?.visitDate ?? null,
    last_visited_by: latestVisit?.officer ?? null
  };
}

function resolveSortDir(raw) {
  return raw === 'asc' ? 'asc' : 'desc';
}

function prismaOrderBy(sortBy, sortDir) {
  const dir = resolveSortDir(sortDir);
  const map = {
    created_at: { createdAt: dir },
    name: { name: dir },
    region: { zone: dir },
    sub_region: { subTerritory: dir },
    status: { status: dir },
    kyc: { kyc: dir },
    adr_name: { officer: dir }
  };
  return map[sortBy] || { createdAt: 'desc' };
}

async function fetchAgentPage({
  companyId,
  tableWhere,
  sortBy,
  sortDir,
  offset,
  limit
}) {
  const include = {
    onboardedBy: { select: { id: true, name: true } },
    kycReviewedBy: { select: { id: true, name: true } }
  };

  if (sortBy !== 'last_visit_date') {
    const [tableTotal, agents] = await Promise.all([
      prisma.agent.count({ where: tableWhere }),
      prisma.agent.findMany({
        where: tableWhere,
        include,
        orderBy: prismaOrderBy(sortBy, sortDir),
        skip: offset,
        take: limit
      })
    ]);
    return { tableTotal, agents };
  }

  const dir = resolveSortDir(sortDir);
  const matching = await prisma.agent.findMany({
    where: tableWhere,
    select: { id: true }
  });
  const ids = matching.map((a) => a.id);
  const tableTotal = ids.length;

  if (!ids.length) {
    return { tableTotal: 0, agents: [] };
  }

  const visitAgg = await prisma.visit.groupBy({
    by: ['agentId'],
    where: { companyId, agentId: { in: ids } },
    _max: { visitDate: true }
  });
  const lastVisitMap = new Map(
    visitAgg.map((v) => [v.agentId, v._max.visitDate || ''])
  );

  ids.sort((a, b) => {
    const da = lastVisitMap.get(a) || '';
    const db = lastVisitMap.get(b) || '';
    if (da === db) return a.localeCompare(b);
    return dir === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
  });

  const pageIds = ids.slice(offset, offset + limit);
  if (!pageIds.length) {
    return { tableTotal, agents: [] };
  }

  const agentsUnsorted = await prisma.agent.findMany({
    where: { id: { in: pageIds } },
    include
  });
  const byId = new Map(agentsUnsorted.map((a) => [a.id, a]));
  const agents = pageIds.map((id) => byId.get(id)).filter(Boolean);

  return { tableTotal, agents };
}

export async function buildAgentRegistryReport(user, query = {}) {
  const companyId = companyFilter(user);
  if (!companyId) {
    return emptyReport();
  }

  const preset = query.preset || 'this_month';
  const period = resolveDateRange(preset, query.from, query.to);
  const visitPeriod =
    period.preset === 'all' ? resolveDateRange('this_month') : period;
  const tableScope = query.table_scope === 'all' ? 'all' : 'onboarded';
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const sortBy = String(query.sort_by || 'created_at');
  const sortDir = String(query.sort_dir || 'desc');

  const scopeWhere = await buildScopeWhere(user, {
    zone: query.zone || null,
    subTerritory: query.sub_territory || null,
    officerId: query.officer_id || null,
    teamLeadId: query.team_lead_id || null,
    status: query.status || null,
    kyc: query.kyc || null
  });

  const searchWhere = applySearch(scopeWhere, query.q);
  const tableWhere = buildTableWhere(searchWhere, { preset, period, tableScope });

  const settings = await getOrCreateCompanySettings(companyId);
  const visitTargetPerAgent = settings.visitFrequencyTarget || 25;

  const totalAgents = await prisma.agent.count({ where: scopeWhere });

  const { from: todayFrom, to: todayTo } = todayBoundsUTC();
  const onboardedToday = await prisma.agent.count({
    where: {
      ...scopeWhere,
      createdAt: { gte: todayFrom, lte: todayTo }
    }
  });

  const kycPending = await prisma.agent.count({
    where: { ...scopeWhere, kyc: 'pending' }
  });

  const scopedIds = await prisma.agent.findMany({
    where: scopeWhere,
    select: { id: true }
  });
  const agentIds = scopedIds.map((a) => a.id);

  const visitsInPeriod = await prisma.visit.findMany({
    where: {
      companyId,
      agentId: agentIds.length ? { in: agentIds } : { in: ['__none__'] },
      visitDate: { gte: visitPeriod.from, lte: visitPeriod.to },
      status: 'done'
    },
    select: { agentId: true }
  });

  const visitedSet = new Set(visitsInPeriod.map((v) => v.agentId));
  const visitsDone = visitsInPeriod.length;
  const agentsVisited = visitedSet.size;
  const neverVisited = agentIds.filter((id) => !visitedSet.has(id)).length;

  const days = daysInclusive(visitPeriod.from, visitPeriod.to);
  const visitTargetTotal = Math.round(
    visitTargetPerAgent * totalAgents * (days / 30)
  );
  const visitCoveragePct = pct(visitsDone, visitTargetTotal);

  const { tableTotal, agents } = await fetchAgentPage({
    companyId,
    tableWhere,
    sortBy,
    sortDir,
    offset,
    limit
  });

  const pageIds = agents.map((a) => a.id);
  const adrIds = [...new Set(agents.map((a) => a.officerId).filter(Boolean))];

  const [latestVisits, teamLeads] = await Promise.all([
    fetchLatestVisits(companyId, pageIds),
    teamLeadMapForAdrs(companyId, adrIds)
  ]);

  const rows = agents.map((agent) =>
    serializeRow(agent, {
      latestVisit: latestVisits.get(agent.id),
      teamLead: agent.officerId ? teamLeads.get(agent.officerId) : null
    })
  );

  return {
    period: {
      preset: period.preset,
      from: period.from,
      to: period.to,
      visit_from: visitPeriod.from,
      visit_to: visitPeriod.to
    },
    table_scope: tableScope,
    sort: { by: sortBy, dir: sortDir },
    summary: {
      total_agents: totalAgents,
      onboarded_today: onboardedToday,
      agents_visited: agentsVisited,
      never_visited: neverVisited,
      kyc_pending: kycPending,
      visits_done: visitsDone,
      visit_target_total: visitTargetTotal,
      visit_coverage_pct: visitCoveragePct,
      visit_frequency_target: visitTargetPerAgent
    },
    rows,
    total: tableTotal,
    limit,
    offset
  };
}

function emptyReport() {
  return {
    period: { preset: 'this_month', from: '', to: '' },
    table_scope: 'onboarded',
    sort: { by: 'created_at', dir: 'desc' },
    summary: {
      total_agents: 0,
      onboarded_today: 0,
      agents_visited: 0,
      never_visited: 0,
      kyc_pending: 0,
      visits_done: 0,
      visit_target_total: 0,
      visit_coverage_pct: 0,
      visit_frequency_target: 25
    },
    rows: [],
    total: 0,
    limit: 25,
    offset: 0
  };
}

export function agentRegistryCsvRows(report) {
  return report.rows.map((r) => [
    r.id,
    r.created_at,
    r.name,
    r.outlet_name ?? '',
    r.business_type ?? '',
    r.status,
    r.kyc,
    r.gender ?? '',
    r.business_phone,
    r.agent_number ?? '',
    r.address,
    r.region,
    r.sub_region ?? '',
    r.adr_name,
    r.team_lead_name ?? '',
    r.onboarded_by_name ?? '',
    r.kyc_approved_by_name ?? '',
    r.last_visit_date ?? '',
    r.last_visited_by ?? ''
  ]);
}

export const AGENT_REGISTRY_CSV_HEADERS = [
  'id',
  'onboarded_date',
  'name',
  'business_name',
  'business_type',
  'status',
  'kyc',
  'gender',
  'business_phone',
  'agent_number',
  'address',
  'region',
  'sub_region',
  'adr',
  'team_lead',
  'onboarded_by',
  'kyc_approved_by',
  'last_visit_date',
  'last_visited_by'
];
