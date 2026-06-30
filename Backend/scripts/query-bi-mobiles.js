import pg from 'pg';

const client = new pg.Client({
  connectionString:
    process.env.BI_DATABASE_URL ||
    'postgresql://postgres:admin123@localhost:5432/bireports?schema=public'
});

await client.connect();

const sample = await client.query(`
  SELECT au.mobile, COUNT(*) OVER() as total
  FROM agent_users au
  INNER JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL
    AND au.mobile IS NOT NULL
    AND u.deleted_at IS NULL
    AND u.status::text = 'Active'
  ORDER BY au.mobile
  LIMIT 15
`);

console.log('Sample BI mobiles (first 15):');
for (const row of sample.rows) {
  console.log(JSON.stringify(row.mobile), typeof row.mobile, 'len', String(row.mobile).length);
}

const match = await client.query(`
  SELECT au.mobile
  FROM agent_users au
  INNER JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL
    AND u.deleted_at IS NULL
    AND u.status::text = 'Active'
    AND REPLACE(REPLACE(REPLACE(au.mobile::text, ' ', ''), '+', ''), '-', '') LIKE '%2767677%'
  LIMIT 5
`);

console.log('\nBI rows matching 2767677:', match.rows);

const total = await client.query(`
  SELECT COUNT(DISTINCT au.mobile) as cnt
  FROM agent_users au
  INNER JOIN users u ON u.id = au.user_id
  WHERE au.deleted_at IS NULL
    AND au.mobile IS NOT NULL
    AND u.deleted_at IS NULL
    AND u.status::text = 'Active'
`);

console.log('\nTotal active BI agent mobiles:', total.rows[0]?.cnt);

await client.end();
