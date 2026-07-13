import { prisma } from './prisma.js';
import { todayISO } from '../middleware/user.js';
import { getOrCreateCompanySettings } from './company-settings.js';

function monthRange() {
  const today = todayISO();
  const start = `${today.slice(0, 7)}-01`;
  return { start, end: today };
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

/** Live ADR / field-officer performance from assignments and visits. */
export async function buildAdrPerformance(
  companyId,
  { officerName = null, officerIds = null } = {}
) {
  const settings = await getOrCreateCompanySettings(companyId);
  const visitTarget = settings.visitFrequencyTarget || 25;
  const { start: monthStart, end: monthEnd } = monthRange();

  const adrUsers = await prisma.user.findMany({
    where: {
      companyId,
      role: 'adr',
      status: 'active'
    },
    orderBy: { name: 'asc' }
  });

  let officers = adrUsers;
  if (officerName) {
    officers = adrUsers.filter((u) => u.name === officerName);
  } else if (officerIds?.length) {
    const idSet = new Set(officerIds);
    officers = adrUsers.filter((u) => idSet.has(u.id));
  }

  const agents = await prisma.agent.findMany({
    where: { companyId },
    select: {
      id: true,
      officerId: true,
      officer: true,
      kyc: true,
      joined: true
    }
  });

  const monthVisits = await prisma.visit.findMany({
    where: {
      companyId,
      visitDate: { gte: monthStart, lte: monthEnd },
      ...(officerName ? { officer: officerName } : {})
    },
    select: { officer: true, status: true, agentId: true }
  });

  const officerRows = await prisma.officer.findMany({
    where: { companyId }
  });
  const officerByName = Object.fromEntries(officerRows.map((o) => [o.name, o]));

  return officers.map((user) => {
    const name = user.name;
    const assigned = agents.filter(
      (a) => a.officerId === user.id || a.officer === name
    );
    const assignedIds = new Set(assigned.map((a) => a.id));

    const visits = monthVisits.filter((v) => v.officer === name);
    const done = visits.filter((v) => v.status === 'done').length;
    const missed = visits.filter((v) => v.status === 'missed').length;
    const pending = visits.filter((v) => v.status === 'pending').length;

    const kycVerified = assigned.filter((a) => a.kyc === 'verified').length;
    const onboarded = assigned.filter((a) => {
      const joined = a.joined || '';
      return joined.includes(monthStart.slice(0, 7)) || joined.includes(monthEnd.slice(0, 7));
    }).length;

    const target = visitTarget;
    const visitRate = pct(done, target);
    const kycRate = pct(kycVerified, assigned.length);
    const score = Math.round(visitRate * 0.6 + kycRate * 0.4);

    return {
      id: user.id,
      name,
      zone: user.zone || officerByName[name]?.zone || '—',
      agents: assigned.length,
      visits_done: done,
      visits_pending: pending,
      visits_missed: missed,
      visit_target: target,
      visit_rate: visitRate,
      kyc_verified: kycVerified,
      kyc_rate: kycRate,
      onboarded_month: onboarded,
      score,
      agent_ids: [...assignedIds]
    };
  });
}
