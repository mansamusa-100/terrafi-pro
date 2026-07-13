import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

const OWNER_EMAIL = 'owner@anms.platform';

/**
 * Ensures the platform owner exists and matches PLATFORM_OWNER_PASSWORD.
 * Runs on every production container start so Coolify env vars apply without manual seed.
 */
export async function ensurePlatformOwner() {
  const password =
    process.env.PLATFORM_OWNER_PASSWORD?.trim() ||
    (process.env.NODE_ENV === 'production' ? '' : 'demo');
  if (!password) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        'PLATFORM_OWNER_PASSWORD is not set — platform owner login may fail until seed runs.'
      );
    }
    return;
  }

  if (password.length < 6) {
    throw new Error('PLATFORM_OWNER_PASSWORD must be at least 6 characters');
  }

  const hash = bcrypt.hashSync(password, 10);
  const existing = await prisma.user.findFirst({
    where: { email: OWNER_EMAIL, role: 'system_owner' }
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: hash, status: 'active' }
    });
    console.log(`Platform owner password synced for ${OWNER_EMAIL}`);
    return;
  }

  await prisma.user.create({
    data: {
      id: 'usr-owner',
      name: 'Platform Owner',
      email: OWNER_EMAIL,
      passwordHash: hash,
      role: 'system_owner',
      scope: 'Platform administration',
      status: 'active'
    }
  });
  console.log(`Platform owner created: ${OWNER_EMAIL}`);
}
