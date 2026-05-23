require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const teacherCode = 'baotc01';

    console.log(`\n--- Checking NEW QUERY for ${teacherCode} ---`);
    const query = `
      SELECT 
        ts.teacher_code,
        COALESCE(t.full_name, ts.full_name) as full_name,
        COALESCE(t.user_name, ts.username) as username,
        COALESCE(t.work_email, ts.work_email) as work_email,
        COALESCE(t.main_centre, ts.center) as center,
        COALESCE(t.course_line, ts.teaching_block) as teaching_block,
        COALESCE(t.status, ts.status) as teacher_status,
        ts.total_score
      FROM training_teacher_stats ts
      LEFT JOIN teachers t ON ts.teacher_code = t.code
      WHERE ts.teacher_code = $1
    `;
    const newRes = await client.query(query, [teacherCode]);
    if (newRes.rows.length > 0) {
      console.log('New Query Result:', newRes.rows[0]);
    } else {
      console.log('New Query: No result');
    }

  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

main();
