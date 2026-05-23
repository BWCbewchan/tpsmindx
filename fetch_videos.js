const { Client } = require('pg');

async function fetchVideos() {
  const client = new Client({
    host: 'db.wrlfozuzdblljlxwvbst.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'p3tQSMZftB83YTLc',
  });

  try {
    await client.connect();
    const res = await client.query('SELECT id, title, lesson_number FROM training_videos ORDER BY lesson_number ASC');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

fetchVideos();
