const { Client } = require('pg');

async function checkSchema() {
  const client = new Client({
    host: 'db.wrlfozuzdblljlxwvbst.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'p3tQSMZftB83YTLc',
  });

  try {
    await client.connect();
    
    const tables = ['teachers', 'training_teacher_stats', 'training_teacher_video_scores', 'training_videos'];
    for (const table of tables) {
      console.log(`\n--- Table: ${table} ---`);
      const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position`, [table]);
      console.table(res.rows);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkSchema();
