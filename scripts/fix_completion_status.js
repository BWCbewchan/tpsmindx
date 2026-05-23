const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  const client = await pool.connect();
  try {
    console.log('Starting to fix completion_status for teachers with scores...');
    
    // 1. Count how many rows will be affected
    const countRes = await client.query(`
      SELECT COUNT(*) as cnt
      FROM training_teacher_video_scores
      WHERE score > 0
        AND (completion_status IS NULL OR completion_status != 'completed')
    `);
    const count = parseInt(countRes.rows[0].cnt);
    console.log(`Found ${count} rows to update.`);

    if (count === 0) {
      console.log('No rows need updating.');
      return;
    }

    // 2. Perform the update
    const updateRes = await client.query(`
      UPDATE training_teacher_video_scores
      SET completion_status = 'completed',
          completed_at = COALESCE(completed_at, NOW())
      WHERE score > 0
        AND (completion_status IS NULL OR completion_status != 'completed')
    `);
    
    console.log(`Successfully updated ${updateRes.rowCount} rows.`);

  } catch (error) {
    console.error('Error updating completion_status:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fix().catch(console.error);