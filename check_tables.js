const { Client } = require('pg');
const client = new Client({
  host: 'db.wrlfozuzdblljlxwvbst.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'p3tQSMZftB83YTLc',
});
async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log(res.rows.map(r => r.table_name).join('\n'));
  await client.end();
}
run().catch(console.error);
