/**
 * Remove APS Wallet and other demo tenants seeded for local development.
 * Keeps platform users (system_owner, platform_staff).
 *
 * Usage: node scripts/purge-demo-data.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_COMPANY_IDS = ['co-aps', 'co-river', 'co-kombo', 'co-senegal'];

async function purgeCompany(companyId) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return false;

  await prisma.$transaction(async (tx) => {
    await tx.visit.deleteMany({ where: { companyId } });
    await tx.alert.deleteMany({ where: { companyId } });
    await tx.floatTrendPoint.deleteMany({ where: { companyId } });
    await tx.floatDelivery.deleteMany({ where: { companyId } });
    await tx.trainingModule.deleteMany({ where: { companyId } });
    await tx.officer.deleteMany({ where: { companyId } });
    await tx.leadAdrAssignment.deleteMany({ where: { companyId } });
    await tx.notification.deleteMany({ where: { companyId } });
    await tx.auditLog.deleteMany({ where: { companyId } });

    const agents = await tx.agent.findMany({
      where: { companyId },
      select: { id: true }
    });
    const agentIds = agents.map((a) => a.id);
    if (agentIds.length) {
      await tx.kycDocument.deleteMany({ where: { agentId: { in: agentIds } } });
      await tx.agent.deleteMany({ where: { companyId } });
    }

    await tx.user.deleteMany({
      where: { companyId, role: { not: 'system_owner' } }
    });
    await tx.companySettings.deleteMany({ where: { companyId } });
    await tx.company.delete({ where: { id: companyId } });
  });

  return true;
}

async function main() {
  let removed = 0;
  for (const id of DEMO_COMPANY_IDS) {
    if (await purgeCompany(id)) {
      removed += 1;
      console.log(`Removed demo company: ${id}`);
    }
  }
  console.log(
    removed
      ? `Purged ${removed} demo tenant(s). Platform owner account preserved.`
      : 'No demo companies found — nothing to purge.'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
