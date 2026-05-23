const { Client } = require('pg');

const client = new Client({
  host: 'db.wrlfozuzdblljlxwvbst.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'p3tQSMZftB83YTLc',
});

async function run() {
  try {
    await client.connect();
    const res = await client.query('SELECT id, title FROM training_videos ORDER BY id ASC');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
