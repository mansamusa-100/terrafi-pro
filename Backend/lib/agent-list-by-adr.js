import { prisma } from './prisma.js';
import { loadSupervisedAdrs } from './team-lead.js';
import { agentWhereForUser, companyFilter } from '../middleware/user.js';
import { isoRangeToDates, resolveDateRange } from './date-range.js';
import {
  applySearch,
  fetchLatestVisits,
  fetchVisitCounts,
  serializeRow,
  teamLeadMapForAdrs
} from './agent-registry.js';

function inPeriod(agent, from, to) {
  const created = agent.createdAt instanceof Date
    ? agent.createdAt
    : new Date(agent.createdAt);
  return created >= from && created <= to;
}

async function adrsInScope(user, { officerId, teamLeadId }) {
  const companyId = companyFilter(user);
  if (!companyId) return [];

  const where = { companyId, role: 'adr' };

  if (user.role === 'adr') {
    where.id = user.id;
  } else if (user.role === 'team_lead') {
    const ids = user.supervisedAdrIds || [];
    where.id = ids.length ? { in: ids } : '__none__';
    if (officerId && !ids.includes(officerId)) return [];
  }

  if (officerId) where.id = officerId;

  if (teamLeadId && user.role !== 'team_lead') {
    const supervised = await loadSupervisedAdrs(teamLeadId);
    const adrIds = supervised.supervisedAdrIds;
    if (officerId) {
      if (!adrIds.includes(officerId)) return [];
    } else {
      where.id = adrIds.length ? { in: adrIds } : '__none__';
    }
  }

  return prisma.user.findMany({
    where,
    select: { id: true, name: true, zone: true, status: true },
    orderBy: { name: 'asc' }
  });
}

function emptyReport() {
  return {
    period: { preset: 'this_month', from: '', to: '' },
    table_scope: 'onboarded',
    summary: {
      total_adrs: 0,
      total_agents: 0,
      onboarded_in_period: 0,
      adrs_with_zero_agents: 0,
      kyc_pending: 0
    },
    sections: []
  };
}

export async function buildAgentListByAdr(user, query = {}) {
  const companyId = companyFilter(user);
  if (!companyId) return emptyReport();

  const preset = query.preset || 'this_month';
  const period = resolveDateRange(preset, query.from, query.to);
  const tableScope = query.table_scope === 'all' ? 'all' : 'onboarded';
  const { from: createdFrom, to: createdTo } = isoRangeToDates(
    period.from,
    period.to
  );

  const adrs = await adrsInScope(user, {
    officerId: query.officer_id || null,
    teamLeadId: query.team_lead_id || null
  });

  const agentWhere = { ...agentWhereForUser(user) };
  if (query.zone) agentWhere.zone = query.zone;
  if (query.sub_territory) agentWhere.subTerritory = query.sub_territory;
  if (query.status) agentWhere.status = query.status;
  if (query.kyc) agentWhere.kyc = query.kyc;
  if (query.officer_id) {
    agentWhere.officerId = query.officer_id;
  } else if (query.team_lead_id) {
    const supervised = await loadSupervisedAdrs(query.team_lead_id);
    const adrIds = supervised.supervisedAdrIds;
    agentWhere.officerId = adrIds.length ? { in: adrIds } : '__none__';
  }

  const searchWhere = applySearch(agentWhere, query.q);

  const agents = await prisma.agent.findMany({
    where: searchWhere,
    include: {
      onboardedBy: { select: { id: true, name: true } },
      kycReviewedBy: { select: { id: true, name: true } }
    },
    orderBy: [{ name: 'asc' }]
  });

  const adrIds = adrs.map((a) => a.id);
  const agentIds = agents.map((a) => a.id);
  const [latestVisits, visitCounts, teamLeads] = await Promise.all([
    fetchLatestVisits(companyId, agentIds, { doneOnly: true }),
    fetchVisitCounts(companyId, agentIds),
    teamLeadMapForAdrs(companyId, adrIds)
  ]);

  const byAdr = new Map();
  const unassigned = [];
  for (const agent of agents) {
    if (!agent.officerId) {
      unassigned.push(agent);
      continue;
    }
    if (!byAdr.has(agent.officerId)) byAdr.set(agent.officerId, []);
    byAdr.get(agent.officerId).push(agent);
  }

  const searching = Boolean(query.q?.trim());

  function sectionFor(adr, assigned) {
    const onboarded = assigned.filter((a) =>
      inPeriod(a, createdFrom, createdTo)
    );
    const lead = teamLeads.get(adr.id);
    const subRegions = [
      ...new Set(assigned.map((a) => a.subTerritory).filter(Boolean))
    ].sort();
    return {
      adr_id: adr.id,
      adr_name: adr.name,
      zone: adr.zone || '—',
      sub_regions: subRegions,
      status: adr.status,
      team_lead_id: lead?.id ?? null,
      team_lead_name: lead?.name ?? null,
      agent_count: assigned.length,
      onboarded_in_period: onboarded.length,
      kyc_verified: assigned.filter((a) => a.kyc === 'verified').length,
      kyc_pending: assigned.filter((a) => a.kyc === 'pending').length,
      rows: assigned.map((agent) =>
        serializeRow(agent, {
          latestVisit: latestVisits.get(agent.id),
          teamLead: lead,
          visitCount: visitCounts.get(agent.id) ?? 0
        })
      )
    };
  }

  let sections = adrs.map((adr) => sectionFor(adr, byAdr.get(adr.id) || []));

  if (unassigned.length && user.role !== 'adr') {
    sections.push(
      sectionFor(
        { id: null, name: 'Unassigned', zone: null, status: 'active' },
        unassigned
      )
    );
  }

  if (searching) {
    sections = sections.filter((s) => s.agent_count > 0);
  }

  const totalAgents = agents.length;
  const onboardedInPeriod = agents.filter((a) =>
    inPeriod(a, createdFrom, createdTo)
  ).length;

  return {
    period: {
      preset: period.preset,
      from: period.from,
      to: period.to
    },
    table_scope: tableScope,
    summary: {
      total_adrs: sections.filter((s) => s.adr_id).length,
      total_agents: totalAgents,
      onboarded_in_period: onboardedInPeriod,
      adrs_with_zero_agents: sections.filter(
        (s) => s.adr_id && s.agent_count === 0
      ).length,
      kyc_pending: agents.filter((a) => a.kyc === 'pending').length
    },
    sections
  };
}

export function agentListByAdrCsvRows(report) {
  return report.sections.flatMap((section) => {
    if (!section.rows.length) {
      return [
        [
          section.adr_name,
          section.zone,
          (section.sub_regions || []).join(', '),
          section.team_lead_name ?? '',
          section.agent_count,
          section.onboarded_in_period,
          section.kyc_verified,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          ''
        ]
      ];
    }
    return section.rows.map((r) => [
      section.adr_name,
      section.zone,
      (section.sub_regions || []).join(', '),
      section.team_lead_name ?? '',
      section.agent_count,
      section.onboarded_in_period,
      section.kyc_verified,
      r.id,
      r.name,
      r.region,
      r.sub_region ?? '',
      r.status,
      r.kyc,
      r.created_at,
      r.visit_count ?? 0,
      r.last_visited_by ?? ''
    ]);
  });
}

export const AGENT_LIST_BY_ADR_CSV_HEADERS = [
  'adr',
  'adr_zone',
  'sub_region',
  'team_lead',
  'agent_count',
  'onboarded_in_period',
  'kyc_verified',
  'agent_id',
  'agent_name',
  'region',
  'sub_region',
  'status',
  'kyc',
  'onboarded_date',
  'visits',
  'last_visited_by'
];
