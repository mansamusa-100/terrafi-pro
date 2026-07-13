import { prisma } from './prisma.js';
import { todayISO, agentWhereForUser } from '../middleware/user.js';
import { computeAgentScore } from './agent-score.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEFAULT_TRAINING_MODULES = [
  'Agent Compliance Fundamentals',
  'Float Management Best Practices',
  'KYC & Customer Due Diligence',
  'Fraud Prevention & Reporting',
  'Digital Security Awareness'
];

export function last7CalendarDays() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({
      iso: d.toISOString().slice(0, 10),
      label: DAY_LABELS[d.getDay()]
    });
  }
  return days;
}

function currentJoinedLabel() {
  return new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

/** Persist today's network float totals for trend charts. */
export async function recordFloatTrendSnapshot(companyId) {
  const agents = await prisma.agent.findMany({
    where: { companyId, status: { not: 'suspended' } },
    select: { efloat: true, cash: true }
  });

  const efloat = agents.reduce((s, a) => s + a.efloat, 0);
  const cash = agents.reduce((s, a) => s + a.cash, 0);
  const days = last7CalendarDays();
  const today = days[days.length - 1];

  const existing = await prisma.floatTrendPoint.findFirst({
    where: { companyId, label: today.iso }
  });

  if (existing) {
    await prisma.floatTrendPoint.update({
      where: { id: existing.id },
      data: { efloat, cash, dayIndex: 6 }
    });
  } else {
    await prisma.floatTrendPoint.create({
      data: {
        companyId,
        dayIndex: 6,
        label: today.iso,
        efloat,
        cash
      }
    });
  }

  const cutoff = days[0].iso;
  await prisma.floatTrendPoint.deleteMany({
    where: {
      companyId,
      label: { lt: cutoff }
    }
  });
}

export async function buildFloatTrend(companyId) {
  await recordFloatTrendSnapshot(companyId);

  const days = last7CalendarDays();
  const rows = await prisma.floatTrendPoint.findMany({
    where: {
      companyId,
      label: { in: days.map((d) => d.iso) }
    }
  });
  const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));

  let lastEfloat = 0;
  let lastCash = 0;
  const efloat = [];
  const cash = [];

  for (const day of days) {
    const row = byLabel[day.iso];
    if (row) {
      lastEfloat = row.efloat;
      lastCash = row.cash;
    }
    efloat.push(lastEfloat);
    cash.push(lastCash);
  }

  return {
    labels: days.map((d) => d.label),
    efloat,
    cash
  };
}

export async function buildExtendedStats(user) {
  const companyId = user.companyId;
  const agentWhere = agentWhereForUser(user);
  const agents = await prisma.agent.findMany({ where: agentWhere });
  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId } })
    : null;

  const today = todayISO();
  const visitWhere = { visitDate: today };
  if (companyId) visitWhere.companyId = companyId;

  const visits = await prisma.visit.findMany({ where: visitWhere });

  const statusCounts = agents.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  const visitsToday = visits.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {});

  const activeCount = statusCounts.active ?? 0;
  const totalAgents = company?.agents ?? agents.length;
  const activityRate =
    totalAgents > 0 ? Math.round((activeCount / totalAgents) * 100) : 0;

  const joinedLabel = currentJoinedLabel();
  const agentsAddedThisMonth = agents.filter((a) => a.joined === joinedLabel).length;

  const networkFloat = agents.reduce((s, a) => s + a.efloat + a.cash, 0);

  const days = last7CalendarDays();
  const yesterday = days[days.length - 2]?.iso;
  const yesterdayRow = yesterday
    ? await prisma.floatTrendPoint.findFirst({
        where: { companyId: companyId || undefined, label: yesterday }
      })
    : null;

  let floatChangePct = null;
  if (yesterdayRow) {
    const yesterdayTotal = yesterdayRow.efloat + yesterdayRow.cash;
    if (yesterdayTotal > 0) {
      floatChangePct =
        Math.round(((networkFloat - yesterdayTotal) / yesterdayTotal) * 1000) / 10;
    }
  }

  const alertWhere = { dismissedAt: null };
  if (companyId) alertWhere.companyId = companyId;
  const alerts = await prisma.alert.findMany({
    where: alertWhere,
    select: { type: true }
  });
  const alertsCritical = alerts.filter((a) => a.type === 'critical').length;
  const alertsWarning = alerts.filter((a) => a.type === 'warning').length;

  return {
    totalAgents,
    statusCounts,
    visitsToday,
    activeCount,
    activityRate,
    agentsAddedThisMonth,
    networkFloat,
    floatChangePct,
    alertsCritical,
    alertsWarning,
    alertCount: alerts.length
  };
}

export async function buildTrainingProgress(companyId) {
  const agents = await prisma.agent.findMany({
    where: { companyId, status: { not: 'suspended' } },
    select: { kyc: true, visits: true, score: true }
  });

  const assigned = agents.length;
  const completed = agents.filter(
    (a) => a.kyc === 'verified' && a.visits >= 1
  ).length;
  const passing = agents.filter((a) => a.score >= 70).length;

  const stored = await prisma.trainingModule.findMany({
    where: { companyId },
    orderBy: { id: 'asc' }
  });

  const titles =
    stored.length > 0 ? stored.map((m) => m.title) : DEFAULT_TRAINING_MODULES;

  return titles.map((title, index) => {
    const weight = titles.length > 1 ? (index + 1) / titles.length : 1;
    return {
      title,
      assigned,
      completed: Math.min(assigned, Math.round(completed * weight)),
      passing: Math.min(completed, Math.round(passing * weight))
    };
  });
}

export async function buildAgentVisitSparklines(companyId, agentIds = null) {
  const days = last7CalendarDays();
  const start = days[0].iso;
  const end = days[days.length - 1].iso;

  const agentWhere = { companyId };
  if (agentIds?.length) {
    agentWhere.id = { in: agentIds };
  }

  const agents = await prisma.agent.findMany({
    where: agentWhere,
    select: { id: true }
  });

  const visits = await prisma.visit.findMany({
    where: {
      companyId,
      visitDate: { gte: start, lte: end },
      status: 'done',
      ...(agentIds?.length ? { agentId: { in: agentIds } } : {})
    },
    select: { agentId: true, visitDate: true }
  });

  const trends = {};
  for (const agent of agents) {
    trends[agent.id] = days.map(() => 0);
  }

  for (const visit of visits) {
    const idx = days.findIndex((d) => d.iso === visit.visitDate);
    if (idx >= 0 && trends[visit.agentId]) {
      trends[visit.agentId][idx] += 1;
    }
  }

  return {
    labels: days.map((d) => d.label),
    trends
  };
}

export async function ensureDefaultTrainingModules(companyId) {
  const count = await prisma.trainingModule.count({ where: { companyId } });
  if (count > 0) return;

  await prisma.trainingModule.createMany({
    data: DEFAULT_TRAINING_MODULES.map((title) => ({
      companyId,
      title,
      assigned: 0,
      completed: 0,
      passing: 0
    }))
  });
}

/** Recompute scores for all agents in a company (e.g. after bulk import). */
export async function refreshCompanyAgentScores(companyId) {
  const agents = await prisma.agent.findMany({
    where: { companyId },
    select: { id: true, kyc: true, visits: true }
  });
  const monthStart = `${todayISO().slice(0, 7)}-01`;
  const monthVisits = await prisma.visit.groupBy({
    by: ['agentId'],
    where: {
      companyId,
      status: 'done',
      visitDate: { gte: monthStart, lte: todayISO() }
    },
    _count: { _all: true }
  });
  const monthByAgent = Object.fromEntries(
    monthVisits.map((r) => [r.agentId, r._count._all])
  );

  await Promise.all(
    agents.map((agent) => {
      const score = computeAgentScore({
        kyc: agent.kyc,
        visits: agent.visits,
        monthVisits: monthByAgent[agent.id] || 0
      });
      return prisma.agent.update({
        where: { id: agent.id },
        data: { score }
      });
    })
  );
}
