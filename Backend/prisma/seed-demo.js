import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

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

  const password = process.env.PLATFORM_OWNER_PASSWORD || 'demo';
  const hash = bcrypt.hashSync(password, 10);

  await prisma.user.create({
    data: {
      id: 'usr-owner',
      name: 'Platform Owner',
      email: 'owner@anms.platform',
      passwordHash: hash,
      role: 'system_owner',
      scope: 'Platform administration',
      status: 'active'
    }
  });

  console.log('Terrafi Pro production bootstrap complete.');
  console.log('System owner: owner@anms.platform');
  if (!process.env.PLATFORM_OWNER_PASSWORD) {
    console.log('Default password: demo — set PLATFORM_OWNER_PASSWORD in production.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
