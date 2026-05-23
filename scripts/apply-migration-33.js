require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('Applying migration V33...');
    await pool.query('ALTER TABLE training_video_assignments ALTER COLUMN video_id DROP NOT NULL;');
    console.log('✅ Success!');
    
    // Insert into _migrations table to track it
    await pool.query("INSERT INTO _migrations (name, version) VALUES ('V33_make_video_id_nullable', 33) ON CONFLICT (name) DO NOTHING");
    console.log('✅ Recorded in _migrations');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    pool.end();
  }
}

run();
