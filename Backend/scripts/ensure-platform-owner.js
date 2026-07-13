import { prisma } from '../lib/prisma.js';
import { ensurePlatformOwner } from '../lib/ensure-platform-owner.js';

try {
  await ensurePlatformOwner();
} catch (err) {
  console.error('ensure-platform-owner failed:', err.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
