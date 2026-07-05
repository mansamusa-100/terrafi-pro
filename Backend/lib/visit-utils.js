import { prisma } from './prisma.js';
import { todayISO, visitOfficerFilter } from '../middleware/user.js';

export function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function isoWeekNumber(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

/** Completed visits per ISO week for the last N weeks. */
export async function buildWeeklyVolume(baseWhere, weekCount = 7) {
  const today = new Date(`${todayISO()}T12:00:00`);
  const thisMonday = getMondayOfWeek(today);

  const weeks = [];
  for (let i = weekCount - 1; i >= 0; i--) {
    const weekStart = new Date(thisMonday);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeks.push({
      label: `W${isoWeekNumber(weekStart)}`,
      start: weekStart.toISOString().slice(0, 10),
      end: weekEnd.toISOString().slice(0, 10)
    });
  }

  const visits = await prisma.visit.findMany({
    where: {
      ...baseWhere,
      status: 'done',
      visitDate: {
        gte: weeks[0].start,
        lte: weeks[weeks.length - 1].end
      }
    },
    select: { visitDate: true }
  });

  const values = weeks.map(() => 0);
  for (const visit of visits) {
    const idx = weeks.findIndex(
      (w) => visit.visitDate >= w.start && visit.visitDate <= w.end
    );
    if (idx >= 0) values[idx]++;
  }

  return {
    labels: weeks.map((w) => w.label),
    values
  };
}

/** Mark pending visits before today as missed. */
export async function markOverdueVisits(companyId, officerFilter = null) {
  const today = todayISO();
  const where = {
    status: 'pending',
    visitDate: { lt: today }
  };
  if (companyId) where.companyId = companyId;
  if (officerFilter) where.officer = officerFilter;

  const result = await prisma.visit.updateMany({
    where,
    data: { status: 'missed' }
  });
  return result.count;
}

export async function buildVisitSummary(reqUser) {
  const companyId = reqUser.companyId || 'co-aps';
  const officerFilter = visitOfficerFilter(reqUser);

  await markOverdueVisits(companyId, officerFilter);

  const today = todayISO();
  const baseWhere = { companyId };
  if (officerFilter) baseWhere.officer = officerFilter;

  const todayVisits = await prisma.visit.findMany({
    where: { ...baseWhere, visitDate: today }
  });

  const monthStart = `${today.slice(0, 7)}-01`;
  const monthCompleted = await prisma.visit.count({
    where: {
      ...baseWhere,
      status: 'done',
      visitDate: { gte: monthStart, lte: today }
    }
  });

  const counts = { done: 0, pending: 0, missed: 0 };
  for (const v of todayVisits) {
    if (counts[v.status] !== undefined) counts[v.status]++;
  }

  const weeklyVolume = await buildWeeklyVolume(baseWhere);

  return {
    today: {
      scheduled: todayVisits.filter((v) => v.status !== 'cancelled').length,
      done: counts.done,
      pending: counts.pending,
      missed: counts.missed
    },
    monthCompleted,
    weeklyVolume
  };
}
