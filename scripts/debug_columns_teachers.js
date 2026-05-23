const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST?.trim(),
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD?.trim(), 
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: { rejectUnauthorized: false }
});

async function checkTeachers() {
  try {
    console.log('--- Checking table columns ---');
    const tables = ['teachers', 'training_teacher_stats'];
    for (const table of tables) {
      const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1;
      `, [table]);
      console.log(`Columns in ${table}:`, res.rows.map(r => r.column_name).join(', '));
    }

    console.log('\n--- Checking data for baotc01 ---');
    const teacherCode = 'baotc01';
    
    // Check training_teacher_stats
    const listRes = await pool.query(`SELECT teacher_code, center, teaching_block, status FROM training_teacher_stats WHERE teacher_code = $1`, [teacherCode]);
    if(listRes.rows.length > 0) {
        console.log('training_teacher_stats:', listRes.rows[0]);
    } else {
        console.log('training_teacher_stats: Not found');
    }

    // Check teachers table
    // We fetch one row and print keys since column names might be quoted
    const tRes = await pool.query(`SELECT * FROM teachers LIMIT 1`);
    if(tRes.rows.length > 0) {
        console.log('teachers table keys:', Object.keys(tRes.rows[0]));
        console.log('teacher sample:', JSON.stringify(tRes.rows[0], null, 2));
    } else {
        console.log('teachers table: Not found or empty');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkTeachers();
