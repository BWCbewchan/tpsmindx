const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name = 'teachers' OR table_name LIKE 'training_%');
    `);
    console.log(res.rows);
    
    if (res.rows.find(r => r.table_name === 'training_videos')) {
        const videos = await pool.query('SELECT id, lesson_number, title FROM training_videos ORDER BY lesson_number');
        console.log('Videos:', videos.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
