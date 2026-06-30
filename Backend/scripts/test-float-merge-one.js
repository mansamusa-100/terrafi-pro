import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { normalizePhone } from '../lib/phone.js';
import { mergeAgentFloatSnapshot } from '../lib/float-ingest.js';
import { randomUUID } from 'crypto';

const agent = await prisma.agent.findFirst({
  where: { name: { contains: 'Edited', mode: 'insensitive' } }
});

console.log('Agent:', agent?.id, agent?.phone, agent?.phoneNormalized, agent?.companyId);

const testNumbers = [
  '2767677',
  '2202767677',
  '+2202767677',
  '+220 276 7677',
  '02767677',
  2767677
];

console.log('\nNormalize tests:');
for (const n of testNumbers) {
  console.log(JSON.stringify(n), '->', normalizePhone(n));
}

if (agent) {
  const deliveryId = randomUUID();
  const result = await mergeAgentFloatSnapshot({
    companyId: agent.companyId,
    deliveryId,
    snapshotAt: new Date().toISOString(),
    agents: [
      {
        agent_number: '2767677',
        after_balance: '99999.50',
        balance_as_of: new Date().toISOString()
      }
    ]
  });
  console.log('\nTest merge result:', result);

  const updated = await prisma.agent.findUnique({ where: { id: agent.id } });
  console.log('After merge:', {
    efloat: updated?.efloat,
    lastFloatDeliveryId: updated?.lastFloatDeliveryId
  });

  await prisma.floatDelivery.delete({ where: { deliveryId } }).catch(() => {});
  await prisma.agent.update({
    where: { id: agent.id },
    data: {
      efloat: agent.efloat,
      lastFloatSnapshotAt: agent.lastFloatSnapshotAt,
      lastFloatDeliveryId: agent.lastFloatDeliveryId,
      floatBalanceAsOf: agent.floatBalanceAsOf
    }
  });
}

await prisma.$disconnect();
