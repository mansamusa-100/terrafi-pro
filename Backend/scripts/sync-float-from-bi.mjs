/**
 * Pull latest BI float snapshot and merge into Field-Pro agents.
 * Run: node scripts/sync-float-from-bi.mjs
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import pg from '../../../BI-Report/analystics-bi/backend/node_modules/pg/lib/index.js';
import { prisma } from '../lib/prisma.js';
import { mergeAgentFloatSnapshot } from '../lib/float-ingest.js';

const BI_DATABASE_URL =
  process.env.BI_DATABASE_URL ||
  'postgresql://postgres:admin123@localhost:5432/bireports';

const COMPANY_ID = process.env.PARTNER_AGENT_FLOAT_COMPANY_ID || 'co-aps';

const SNAPSHOT_SQL = `
WITH agent_entity AS (
  SELECT id FROM entities WHERE name = 'Agent' AND deleted_at IS NULL LIMIT 1
),
emoney_pouch AS (
  SELECT id FROM pouches WHERE name = 'EMoney' AND deleted_at IS NULL LIMIT 1
),
agents AS (
  SELECT DISTINCT ON (au.mobile)
    au.mobile AS agent_number
  FROM agent_users au
  INNER JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL
    AND au.mobile IS NOT NULL
    AND u.deleted_at IS NULL
    AND u.status::text = 'Active'
  ORDER BY au.mobile, au.id
),
latest_balances AS (
  SELECT DISTINCT ON (t.user_identifier)
    t.user_identifier,
    t.after_balance::numeric AS after_balance,
    t.created_at AS balance_as_of
  FROM transactions t
  INNER JOIN agent_entity ae ON ae.id = t.entity_id
  INNER JOIN emoney_pouch ep ON ep.id = t.pouch_id
  WHERE t.deleted_at IS NULL
    AND t.after_balance IS NOT NULL
    AND t.user_identifier IS NOT NULL
    AND t.created_at <= $1::timestamp
  ORDER BY t.user_identifier, t.created_at DESC, t.id DESC
)
SELECT
  a.agent_number,
  COALESCE(lb.after_balance, 0) AS after_balance,
  COALESCE(lb.balance_as_of, $1::timestamp) AS balance_as_of
FROM agents a
LEFT JOIN latest_balances lb ON lb.user_identifier = a.agent_number
ORDER BY a.agent_number
`;

const client = new pg.Client({ connectionString: BI_DATABASE_URL });
await client.connect();

const snapshotAt = new Date();
const { rows } = await client.query(SNAPSHOT_SQL, [snapshotAt.toISOString()]);
await client.end();

const agents = rows.map((row) => ({
  agent_number: String(row.agent_number),
  after_balance: Number(row.after_balance).toFixed(2),
  balance_as_of: new Date(row.balance_as_of).toISOString()
}));

const deliveryId = crypto.randomUUID();
const result = await mergeAgentFloatSnapshot({
  companyId: COMPANY_ID,
  deliveryId,
  snapshotAt: snapshotAt.toISOString(),
  agents
});

console.log('Float sync result:', result);

const updated = await prisma.agent.findMany({
  orderBy: { id: 'asc' },
  select: {
    id: true,
    name: true,
    phoneNormalized: true,
    efloat: true,
    lastFloatDeliveryId: true
  }
});
console.log('\nAgents after sync:');
for (const a of updated) {
  console.log(`  ${a.id} ${a.name} (${a.phoneNormalized}): efloat ${a.efloat}`);
}

await prisma.$disconnect();
