import pg from 'pg';

const c = new pg.Client({
  connectionString: process.env.BI_DATABASE_URL || 'postgresql://postgres:admin123@localhost:5432/bireports'
});
await c.connect();

const r = await c.query(`
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

console.log(JSON.stringify(r.rows.map((row) => row.agent_number)));
await c.end();
