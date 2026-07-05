import { prisma } from './prisma.js';
import { KYC_DOC_TYPES } from './kyc.js';
import { notifyKycReviewRequired } from './notifications.js';

export async function agentKycDocTypes(agentId) {
  const docs = await prisma.kycDocument.findMany({
    where: { agentId },
    select: { docType: true }
  });
  return new Set(docs.map((d) => d.docType));
}

export async function agentHasAllKycDocs(agentId) {
  const types = await agentKycDocTypes(agentId);
  return KYC_DOC_TYPES.every((t) => types.has(t));
}

/** Recompute KYC status after document upload or removal. */
export async function syncKycStatus(agentId) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return;

  const hasAll = await agentHasAllKycDocs(agentId);

  if (!hasAll) {
    if (agent.kyc !== 'expired') {
      await prisma.agent.update({
        where: { id: agentId },
        data: { kyc: 'incomplete' }
      });
    }
    return;
  }

  if (agent.kyc !== 'pending') {
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        kyc: 'pending',
        kycReviewNote: null,
        kycReviewedAt: null,
        kycReviewedById: null
      }
    });
    await notifyKycReviewRequired(agent);
  }
}

export function buildKycStats(agents) {
  const counts = {
    verified: 0,
    pending: 0,
    incomplete: 0,
    expired: 0
  };
  for (const a of agents) {
    const key = counts[a.kyc] !== undefined ? a.kyc : 'incomplete';
    counts[key] = (counts[key] || 0) + 1;
  }
  const total = agents.length;
  const suspended = agents.filter((a) => a.status === 'suspended').length;
  return {
    total,
    suspended,
    counts,
    complianceRate:
      total > 0 ? Math.round((counts.verified / total) * 1000) / 10 : 0
  };
}
