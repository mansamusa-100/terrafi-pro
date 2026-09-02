import { prisma } from './prisma.js';
import { getOrCreateCompanySettings } from './company-settings.js';
import { loadSupervisedAdrs } from './team-lead.js';
import { companyFilter } from '../middleware/user.js';
import {
  daysInclusive,
  resolveDateRange
} from './date-range.js';
import {
  parseVisitTargetClasses,
  resolveTargetClass,
  TARGET_CLASS_LABELS
} from './visit-target-classes.js';
import { buildOfficerJourney } from './journey-tracking.js';

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function parseTimeOnDate(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDurationMinutes(start, end) {
  if (!start || !end || end <= start) return null;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

async function officersInScope(user, { zone, teamLeadId, officerId, accountStatus }) {
  const companyId = companyFilter(user);
  if (!companyId) return [];

  const where = { companyId, role: 'adr' };

  if (accountStatus) where.status = accountStatus;
  if (zone) where.zone = zone;
  if (officerId) where.id = officerId;

  if (user.role === 'adr') {
    where.id = user.id;
  } else if (user.role === 'team_lead') {
    const ids = user.supervisedAdrIds || [];
    where.id = ids.length ? { in: ids } : '__none__';
    if (officerId && !ids.includes(officerId)) return [];
  }

  if (teamLeadId && user.role !== 'adr') {
    const supervised = await loadSupervisedAdrs(teamLeadId);
    const adrIds = supervised.supervisedAdrIds;
    if (officerId) {
      if (!adrIds.includes(officerId)) return [];
    } else {
      where.id = adrIds.length ? { in: adrIds } : '__none__';
    }
  }

  let officers = await prisma.user.findMany({
    where,
    orderBy: { name: 'asc' }
  });

  return officers;
}

function applyOfficerSearch(officers, q) {
  const term = q?.trim().toLowerCase();
  if (!term) return officers;
  return officers.filter(
    (o) =>
      o.id.toLowerCase().includes(term) ||
      o.name.toLowerCase().includes(term) ||
      (o.zone || '').toLowerCase().includes(term) ||
      o.email.toLowerCase().includes(term)
  );
}

async function teamLeadMap(companyId, adrIds) {
  if (!adrIds.length) return new Map();
  const rows = await prisma.leadAdrAssignment.findMany({
    where: { companyId, adrId: { in: adrIds } },
    include: { lead: { select: { id: true, name: true, zone: true } } }
  });
  return new Map(rows.map((r) => [r.adrId, r.lead]));
}

function visitMatchWhere(companyId, officer, period) {
  return {
    companyId,
    status: 'done',
    visitDate: { gte: period.from, lte: period.to },
    OR: [{ officerId: officer.id }, { officer: officer.name }]
  };
}

async function countVisitsForOfficer(companyId, officer, period) {
  return prisma.visit.count({
    where: visitMatchWhere(companyId, officer, period)
  });
}

async function visitsForOfficer(companyId, officer, period) {
  return prisma.visit.findMany({
    where: visitMatchWhere(companyId, officer, period),
    orderBy: [{ visitDate: 'asc' }, { time: 'asc' }]
  });
}

/** Monthly presets use the full configured target; shorter ranges scale by days/30. */
function visitTargetForPeriod(baseTarget, period) {
  if (period.preset === 'this_month' || period.preset === 'last_month') {
    return baseTarget;
  }
  const days = daysInclusive(period.from, period.to);
  return Math.max(1, Math.round(baseTarget * (days / 30)));
}

export async function buildOfficerReport(user, query = {}) {
  const companyId = companyFilter(user);
  if (!companyId) return emptyReport();

  const preset = query.preset || 'this_month';
  const period = resolveDateRange(preset, query.from, query.to);
  const settings = await getOrCreateCompanySettings(companyId);
  const baseTarget = settings.visitFrequencyTarget || 25;
  const targetClasses = parseVisitTargetClasses(settings.visitTargetClasses);
  const targetClassFilter = query.target_class || null;

  let officers = await officersInScope(user, {
    zone: query.zone || null,
    teamLeadId: query.team_lead_id || null,
    officerId: query.officer_id || null,
    accountStatus: query.account_status || null
  });
  officers = applyOfficerSearch(officers, query.q);

  const adrIds = officers.map((o) => o.id);
  const teamLeads = await teamLeadMap(companyId, adrIds);

  const visitTargetPerOfficer = visitTargetForPeriod(baseTarget, period);
  const totalVisitTarget = visitTargetPerOfficer * officers.length;

  let totalVisitsDone = 0;
  const activeOfficerIds = new Set();

  const visitAchievedRows = [];
  for (const officer of officers) {
    const visitsDone = await countVisitsForOfficer(companyId, officer, period);
    totalVisitsDone += visitsDone;
    if (visitsDone > 0) activeOfficerIds.add(officer.id);

    const rate = pct(visitsDone, visitTargetPerOfficer);
    const targetClass = resolveTargetClass(rate, targetClasses);
    if (targetClassFilter && targetClass !== targetClassFilter) continue;

    const lead = teamLeads.get(officer.id);
    visitAchievedRows.push({
      officer_id: officer.id,
      name: officer.name,
      team_lead_id: lead?.id ?? null,
      team_lead_name: lead?.name ?? null,
      zone: officer.zone || '—',
      target: visitTargetPerOfficer,
      visits_done: visitsDone,
      visit_rate_pct: rate,
      target_class: targetClass,
      target_class_label: TARGET_CLASS_LABELS[targetClass],
      account_status: officer.status
    });
  }

  const workDurationRows = [];
  if (query.include_work_duration !== '0') {
    for (const officer of officers) {
      const visits = await visitsForOfficer(companyId, officer, period);
      const byDate = new Map();
      for (const v of visits) {
        if (!byDate.has(v.visitDate)) byDate.set(v.visitDate, []);
        byDate.get(v.visitDate).push(v);
      }
      const lead = teamLeads.get(officer.id);
      for (const [date, dayVisits] of byDate) {
        const times = dayVisits
          .map((v) => parseTimeOnDate(v.visitDate, v.time))
          .filter(Boolean)
          .sort((a, b) => a.getTime() - b.getTime());
        const agents = new Set(dayVisits.map((v) => v.agentId));
        const earliest = times[0] || null;
        const latest = times[times.length - 1] || null;
        workDurationRows.push({
          date,
          officer_id: officer.id,
          name: officer.name,
          role: officer.role,
          team_lead_name: lead?.name ?? null,
          zone: officer.zone || '—',
          visits_done: dayVisits.length,
          unique_agents_visited: agents.size,
          earliest_visit: earliest ? earliest.toISOString() : null,
          latest_visit: latest ? latest.toISOString() : null,
          field_time_minutes: formatDurationMinutes(earliest, latest)
        });
      }
    }
    workDurationRows.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  }

  const teamActivityRows = [];
  if (user.role !== 'adr') {
    const leads =
      query.team_lead_id && user.role !== 'team_lead'
        ? await prisma.user.findMany({
            where: { id: query.team_lead_id, companyId, role: 'team_lead' }
          })
        : user.role === 'team_lead'
          ? [await prisma.user.findUnique({ where: { id: user.id } })].filter(Boolean)
          : await prisma.user.findMany({
              where: { companyId, role: 'team_lead', status: 'active' },
              orderBy: { name: 'asc' }
            });

    for (const lead of leads) {
      if (!lead) continue;
      const supervised = await loadSupervisedAdrs(lead.id);
      const teamOfficers = officers.filter((o) =>
        supervised.supervisedAdrIds.includes(o.id)
      );
      if (!teamOfficers.length && query.team_lead_id) continue;

      let teamVisits = 0;
      let teamActive = 0;
      for (const o of teamOfficers) {
        const c = await countVisitsForOfficer(companyId, o, period);
        teamVisits += c;
        if (c > 0) teamActive += 1;
      }

      teamActivityRows.push({
        team_lead_id: lead.id,
        team_lead_name: lead.name,
        zone: lead.zone || '—',
        officer_count: teamOfficers.length,
        active_officer_count: teamActive,
        total_visit_target: visitTargetPerOfficer * teamOfficers.length,
        visits_done: teamVisits,
        visit_coverage_pct: pct(teamVisits, visitTargetPerOfficer * teamOfficers.length)
      });
    }
  }

  let journey = null;
  if (query.officer_id && query.journey_date) {
    journey = await buildOfficerJourney(user, {
      officerId: query.officer_id,
      date: query.journey_date
    });
  }

  return {
    period: { preset: period.preset, from: period.from, to: period.to },
    target_classes: targetClasses,
    summary: {
      total_officers: officers.length,
      active_officers: activeOfficerIds.size,
      total_visit_target: totalVisitTarget,
      visits_done: totalVisitsDone,
      visit_coverage_pct: pct(totalVisitsDone, totalVisitTarget),
      visit_frequency_target: baseTarget
    },
    visit_achieved: visitAchievedRows,
    work_duration: workDurationRows,
    team_activity: teamActivityRows,
    journey
  };
}

function emptyReport() {
  return {
    period: { preset: 'this_month', from: '', to: '' },
    target_classes: parseVisitTargetClasses(null),
    summary: {
      total_officers: 0,
      active_officers: 0,
      total_visit_target: 0,
      visits_done: 0,
      visit_coverage_pct: 0,
      visit_frequency_target: 25
    },
    visit_achieved: [],
    work_duration: [],
    team_activity: [],
    journey: null
  };
}

export function officerReportCsvSections(report) {
  return {
    visit_achieved: report.visit_achieved.map((r) => [
      r.officer_id,
      r.name,
      r.team_lead_name ?? '',
      r.zone,
      r.target,
      r.visits_done,
      r.target_class_label,
      r.account_status
    ]),
    work_duration: report.work_duration.map((r) => [
      r.date,
      r.name,
      r.role,
      r.team_lead_name ?? '',
      r.zone,
      r.visits_done,
      r.unique_agents_visited,
      r.earliest_visit ?? '',
      r.latest_visit ?? '',
      r.field_time_minutes ?? ''
    ]),
    team_activity: report.team_activity.map((r) => [
      r.team_lead_name,
      r.zone,
      r.officer_count,
      r.active_officer_count,
      r.total_visit_target,
      r.visits_done,
      r.visit_coverage_pct
    ])
  };
}

export const OFFICER_CSV_HEADERS = {
  visit_achieved: [
    'officer_id',
    'name',
    'team_lead',
    'zone',
    'target',
    'visits_done',
    'target_class',
    'account_status'
  ],
  work_duration: [
    'date',
    'name',
    'role',
    'team_lead',
    'zone',
    'visits_done',
    'unique_agents_visited',
    'earliest_visit',
    'latest_visit',
    'field_time_minutes'
  ],
  team_activity: [
    'team_lead',
    'zone',
    'officer_count',
    'active_officers',
    'total_visit_target',
    'visits_done',
    'coverage_pct'
  ]
};
