import { PrismaClient } from '@prisma/client';
import { ensurePlatformOwner } from '../lib/ensure-platform-owner.js';

const prisma = new PrismaClient();

/**
 * Production bootstrap — platform owner only, no demo tenants or agents.
 * For local demo data, run: npm run db:seed:demo
 */
async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log('Database already has users — skipping production bootstrap');
    return;
  }

  await ensurePlatformOwner();
  console.log('Terrafi Pro production bootstrap complete.');
  console.log('System owner: owner@anms.platform');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
