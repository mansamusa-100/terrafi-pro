import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

const agents = await prisma.agent.findMany({
  select: { id: true, companyId: true, phoneNormalized: true, name: true }
});
console.log('agents:', agents);
console.log('env PARTNER_AGENT_FLOAT_COMPANY_ID:', process.env.PARTNER_AGENT_FLOAT_COMPANY_ID);

const companyId = process.env.PARTNER_AGENT_FLOAT_COMPANY_ID || 'co-aps';
const matched = await prisma.agent.findMany({
  where: { companyId, phoneNormalized: { not: null } },
  select: { id: true, phoneNormalized: true }
});
console.log('agents for ingest companyId:', matched.length, matched);

await prisma.$disconnect();
