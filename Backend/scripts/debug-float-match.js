import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { normalizePhone } from '../lib/phone.js';

const agents = await prisma.agent.findMany({
  where: { name: { contains: 'Edited', mode: 'insensitive' } },
  select: {
    id: true,
    name: true,
    phone: true,
    phoneNormalized: true,
    efloat: true,
    lastFloatSnapshotAt: true,
    lastFloatDeliveryId: true,
    floatBalanceAsOf: true
  }
});

console.log('Agents matching "Edited":');
console.log(JSON.stringify(agents, null, 2));

const deliveries = await prisma.floatDelivery.findMany({
  orderBy: { receivedAt: 'desc' },
  take: 5,
  select: {
    deliveryId: true,
    updatedCount: true,
    unknownCount: true,
    skippedCount: true,
    recordCount: true,
    receivedAt: true
  }
});

console.log('\nRecent deliveries:');
console.log(JSON.stringify(deliveries, null, 2));

const dupes = await prisma.$queryRaw`
  SELECT phone_normalized, COUNT(*)::int as cnt
  FROM "Agent"
  WHERE phone_normalized IS NOT NULL
  GROUP BY phone_normalized
  HAVING COUNT(*) > 1
`;

console.log('\nDuplicate phone_normalized:', dupes);

if (agents[0]?.phoneNormalized) {
  const norm = agents[0].phoneNormalized;
  const others = await prisma.agent.findMany({
    where: { phoneNormalized: norm },
    select: { id: true, name: true, efloat: true, lastFloatDeliveryId: true }
  });
  console.log(`\nAll agents with phone ${norm}:`, others);
  console.log('normalizePhone test:', normalizePhone(agents[0].phone), norm);
}

const total = await prisma.agent.count();
const withPhone = await prisma.agent.count({
  where: { phoneNormalized: { not: null } }
});
const sample = await prisma.agent.findMany({
  where: { phoneNormalized: { not: null } },
  take: 8,
  select: { phoneNormalized: true, name: true }
});
console.log('\nAgent phone coverage:', { total, withPhone, sample });

await prisma.$disconnect();
