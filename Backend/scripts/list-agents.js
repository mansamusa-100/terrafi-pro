import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

const agents = await prisma.agent.findMany({
  orderBy: { id: 'asc' },
  select: {
    id: true,
    name: true,
    phone: true,
    phoneNormalized: true,
    lastFloatDeliveryId: true,
    efloat: true
  }
});
console.log(JSON.stringify(agents, null, 2));
await prisma.$disconnect();
