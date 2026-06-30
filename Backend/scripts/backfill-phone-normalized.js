/**
 * Backfill Agent.phone_normalized for rows created before float integration.
 * Run: node scripts/backfill-phone-normalized.js
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { normalizePhone } from '../lib/phone.js';

async function main() {
  const agents = await prisma.agent.findMany({
    where: { phoneNormalized: null },
    select: { id: true, phone: true, companyId: true }
  });

  let updated = 0;
  let skipped = 0;

  for (const agent of agents) {
    const phoneNormalized = normalizePhone(agent.phone);
    if (!phoneNormalized) {
      console.warn(`Skip ${agent.id}: cannot normalize "${agent.phone}"`);
      skipped += 1;
      continue;
    }

    try {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { phoneNormalized }
      });
      updated += 1;
    } catch (err) {
      if (err.code === 'P2002') {
        console.warn(
          `Skip ${agent.id}: phone ${phoneNormalized} already used in company ${agent.companyId}`
        );
        skipped += 1;
      } else {
        throw err;
      }
    }
  }

  console.log(`Backfill complete: ${updated} updated, ${skipped} skipped`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
