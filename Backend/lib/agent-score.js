import { prisma } from './prisma.js';
import { todayISO } from '../middleware/user.js';

function monthStartISO() {
  const today = todayISO();
  return `${today.slice(0, 7)}-01`;
}

export function computeAgentScore({ kyc, visits = 0, monthVisits = 0 }) {
  const kycScore =
    kyc === 'verified' ? 40 : kyc === 'pending' ? 20 : kyc === 'incomplete' ? 10 : 0;
  const visitScore = Math.min(40, monthVisits * 8);
  const activityScore = Math.min(20, visits);
  return Math.min(100, Math.round(kycScore + visitScore + activityScore));
}

export async function computeAgentScoreForAgent(agentId) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { kyc: true, visits: true }
  });
  if (!agent) return 0;

  const monthVisits = await prisma.visit.count({
    where: {
      agentId,
      status: 'done',
      visitDate: { gte: monthStartISO(), lte: todayISO() }
    }
  });

  return computeAgentScore({
    kyc: agent.kyc,
    visits: agent.visits,
    monthVisits
  });
}

export async function refreshAgentScore(agentId) {
  const score = await computeAgentScoreForAgent(agentId);
  await prisma.agent.update({
    where: { id: agentId },
    data: { score }
  });
  return score;
}
