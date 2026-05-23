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

async function check() {
  const client = await pool.connect();
  try {
    // 1. Check how many scores exist with each completion_status
    console.log('=== 1. Completion status distribution in training_teacher_video_scores ===');
    const statusDist = await client.query(`
      SELECT completion_status, COUNT(*) as cnt
      FROM training_teacher_video_scores
      WHERE video_id IN (78,79,80,81,82,83,84,85,86,87,88,89)
      GROUP BY completion_status
      ORDER BY completion_status
    `);
    console.table(statusDist.rows);

    // 2. Check scores with score > 0 but NOT completed
    console.log('\n=== 2. Rows with score > 0 but NOT completed ===');
    const notCompleted = await client.query(`
      SELECT teacher_code, video_id, score, completion_status, completed_at,
             time_spent_seconds, server_time_seconds, last_heartbeat_at
      FROM training_teacher_video_scores
      WHERE video_id IN (78,79,80,81,82,83,84,85,86,87,88,89)
        AND score > 0
        AND (completion_status IS NULL OR completion_status != 'completed')
      ORDER BY teacher_code, video_id
      LIMIT 20
    `);
    console.log(`Found ${notCompleted.rowCount} rows`);
    console.table(notCompleted.rows);

    // 3. Check video grouping for advanced videos
    console.log('\n=== 3. Video grouping for advanced videos ===');
    const grouping = await client.query(`
      SELECT id, title, video_group_id, chunk_index, status
      FROM training_videos
      WHERE id IN (78,79,80,81,82,83,84,85,86,87,88,89)
         OR video_group_id IN (
           SELECT video_group_id FROM training_videos 
           WHERE id IN (78,79,80,81,82,83,84,85,86,87,88,89) AND video_group_id IS NOT NULL
         )
      ORDER BY COALESCE(video_group_id, id::text), chunk_index NULLS FIRST
    `);
    console.table(grouping.rows);

    // 4. Check a specific teacher to see what API would return
    console.log('\n=== 4. Sample teacher data ===');
    const sampleTeacher = await client.query(`
      SELECT teacher_code, video_id, score, completion_status, completed_at,
             time_spent_seconds, COALESCE(server_time_seconds,0) as server_time_seconds,
             last_heartbeat_at
      FROM training_teacher_video_scores
      WHERE video_id IN (78,79,80,81,82,83,84,85,86,87,88,89)
        AND score > 0
      ORDER BY teacher_code
      LIMIT 24
    `);
    console.table(sampleTeacher.rows);

    // 5. Check total count of teachers with scores
    console.log('\n=== 5. Total teachers with advanced scores ===');
    const totalTeachers = await client.query(`
      SELECT COUNT(DISTINCT teacher_code) as teacher_count,
             COUNT(*) as total_score_rows
      FROM training_teacher_video_scores
      WHERE video_id IN (78,79,80,81,82,83,84,85,86,87,88,89)
        AND score > 0
    `);
    console.table(totalTeachers.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);