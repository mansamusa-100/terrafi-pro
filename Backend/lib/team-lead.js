import { prisma } from './prisma.js';

export async function loadSupervisedAdrs(leadId) {
  const rows = await prisma.leadAdrAssignment.findMany({
    where: { leadId },
    include: { adr: { select: { id: true, name: true } } }
  });
  return {
    supervisedAdrIds: rows.map((r) => r.adrId),
    supervisedAdrNames: rows.map((r) => r.adr.name)
  };
}

export async function getSupervisedAdrIds(leadId) {
  const rows = await prisma.leadAdrAssignment.findMany({
    where: { leadId },
    select: { adrId: true }
  });
  return rows.map((r) => r.adrId);
}

export async function setSupervisedAdrs(leadId, companyId, adrIds) {
  const uniqueIds = [...new Set(adrIds.map(String).filter(Boolean))];
  if (uniqueIds.length > 0) {
    const adrs = await prisma.user.findMany({
      where: { id: { in: uniqueIds }, companyId, role: 'adr' }
    });
    if (adrs.length !== uniqueIds.length) {
      throw new Error('One or more ADR assignments are invalid');
    }
  }

  await prisma.$transaction([
    prisma.leadAdrAssignment.deleteMany({ where: { leadId } }),
    ...(uniqueIds.length > 0
      ? [
          prisma.leadAdrAssignment.createMany({
            data: uniqueIds.map((adrId) => ({
              id: `la-${leadId}-${adrId}`,
              leadId,
              adrId,
              companyId
            }))
          })
        ]
      : [])
  ]);

  return loadSupervisedAdrs(leadId);
}

export function isTeamLeadRole(role) {
  return role === 'team_lead';
}
