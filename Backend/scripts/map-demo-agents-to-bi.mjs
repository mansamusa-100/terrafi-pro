/**
 * Map remaining demo Field-Pro agents to real active BI mobile numbers.
 * Run: node scripts/map-demo-agents-to-bi.mjs
 */
import 'dotenv/config';
import pg from '../../../BI-Report/analystics-bi/backend/node_modules/pg/lib/index.js';
import { prisma } from '../lib/prisma.js';
import { formatDisplayPhone, normalizePhone } from '../lib/phone.js';

const BI_DATABASE_URL =
  process.env.BI_DATABASE_URL ||
  'postgresql://postgres:admin123@localhost:5432/bireports';

const SKIP_AGENT_IDS = new Set(['APW-0113']); // Agent Edited — already on a real BI number

async function fetchActiveBiMobiles(exclude) {
  const client = new pg.Client({ connectionString: BI_DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT DISTINCT ON (au.mobile)
        au.mobile AS agent_number
      FROM agent_users au
      INNER JOIN users u ON u.id = au.user_id
      WHERE au.deleted_at IS NULL
        AND au.mobile IS NOT NULL
        AND u.deleted_at IS NULL
        AND u.status::text = 'Active'
      ORDER BY au.mobile, au.id
    `);
    return rows
      .map((r) => String(r.agent_number))
      .filter((n) => normalizePhone(n) && !exclude.has(normalizePhone(n)));
  } finally {
    await client.end();
  }
}

const agents = await prisma.agent.findMany({
  where: { id: { notIn: [...SKIP_AGENT_IDS] } },
  orderBy: { id: 'asc' },
  select: { id: true, name: true, phoneNormalized: true }
});

const usedNormalized = new Set(
  (
    await prisma.agent.findMany({
      where: { id: { in: [...SKIP_AGENT_IDS] } },
      select: { phoneNormalized: true }
    })
  )
    .map((a) => a.phoneNormalized)
    .filter(Boolean)
);

const biMobiles = await fetchActiveBiMobiles(usedNormalized);

if (biMobiles.length < agents.length) {
  console.error(
    `Need ${agents.length} BI numbers but only ${biMobiles.length} available after exclusions.`
  );
  process.exit(1);
}

const mappings = agents.map((agent, i) => {
  const normalized = normalizePhone(biMobiles[i]);
  return {
    id: agent.id,
    name: agent.name,
    oldPhone: agent.phoneNormalized,
    phone: formatDisplayPhone(normalized),
    phoneNormalized: normalized
  };
});

console.log('Updating agents:\n');
for (const m of mappings) {
  console.log(`  ${m.id} ${m.name}: ${m.oldPhone} -> ${m.phoneNormalized} (${m.phone})`);
}

for (const m of mappings) {
  await prisma.agent.update({
    where: { id: m.id },
    data: {
      phone: m.phone,
      phoneNormalized: m.phoneNormalized,
      lastFloatSnapshotAt: null,
      lastFloatDeliveryId: null,
      floatBalanceAsOf: null
    }
  });
}

console.log(`\nDone. Updated ${mappings.length} agents.`);
console.log('Next biReports delivery (~5 min) will populate real efloat balances.');
await prisma.$disconnect();
