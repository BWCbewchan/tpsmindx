const fs = require('fs');
const { parse } = require('csv-parse');
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

const CSV_FILE_PATH = '[K12 _ Teaching] Đào tạo nâng cao (Private for HO) - Dashboard.csv';

// Mapping from column index to video ID
// Columns start from 0:
// 11: Lesson 1 -> 84
// 12: Lesson 2 -> 85
// 13: Lesson 3 -> 87
// 14: Lesson 4 -> 86
// 15: Lesson 5 -> 82
// 16: Lesson 6 -> 83
// 17: Lesson 7 -> 89
// 18: Lesson 8 -> 79
// 19: Lesson 9 -> 81
// 20: Lesson 10 -> 80
// 21: Lesson 11 -> 88
// 22: Lesson 12 -> 78
const COLUMN_TO_VIDEO_ID = {
  11: 84, // Lesson 1
  12: 85, // Lesson 2
  13: 87, // Lesson 3
  14: 86, // Lesson 4
  15: 82, // Lesson 5
  16: 83, // Lesson 6
  17: 89, // Lesson 7
  18: 79, // Lesson 8
  19: 81, // Lesson 9
  20: 80, // Lesson 10
  21: 88, // Lesson 11
  22: 78  // Lesson 12
};

const ADVANCED_VIDEO_IDS = Object.values(COLUMN_TO_VIDEO_ID);

async function importScores() {
  const client = await pool.connect();
  let rowCount = 0;
  let skippedCount = 0;
  let insertedCount = 0;

  try {
    const parser = fs.createReadStream(CSV_FILE_PATH).pipe(parse({
      from_line: 25, // Data starts at line 25
      skip_empty_lines: true
    }));

    await client.query('BEGIN');

    for await (const row of parser) {
      rowCount++;
      const teacherCode = row[2]; // Code is in 3rd column
      
      if (!teacherCode) continue;

      // Check if teacher exists in DB (to avoid foreign key constraint violations)
      const checkTeacherRes = await client.query('SELECT 1 FROM teachers WHERE code = $1', [teacherCode]);
      if (checkTeacherRes.rows.length === 0) {
        console.log(`Warning: Teacher code ${teacherCode} not found in DB. Skipping scores for this teacher.`);
        continue;
      }

      // Ensure teacher exists in training_teacher_stats
      await client.query(`
        INSERT INTO training_teacher_stats (teacher_code, full_name, work_email, center)
        SELECT code, full_name, work_email, main_centre FROM teachers WHERE code = $1
        ON CONFLICT (teacher_code) DO NOTHING
      `, [teacherCode]);

      // Insert scores
      for (const [colIndex, videoId] of Object.entries(COLUMN_TO_VIDEO_ID)) {
        let scoreStr = row[colIndex];
        if (scoreStr === undefined || scoreStr === null) continue;
        
        // Remove quotes, replace comma with dot
        scoreStr = scoreStr.replace(/"/g, '').replace(',', '.');
        const score = parseFloat(scoreStr);
        
        if (isNaN(score) || score <= 0) continue; // Only process valid scores > 0 from CSV

        let completionStatus = 'completed';

        await client.query(`
          INSERT INTO training_teacher_video_scores 
          (teacher_code, video_id, score, completion_status)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (teacher_code, video_id) DO UPDATE 
          SET score = EXCLUDED.score, 
              completion_status = CASE WHEN training_teacher_video_scores.completion_status = 'watched' THEN 'watched' ELSE EXCLUDED.completion_status END,
              updated_at = NOW()
          WHERE training_teacher_video_scores.score < EXCLUDED.score OR training_teacher_video_scores.score IS NULL
        `, [teacherCode, videoId, score, completionStatus]);

        insertedCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`\nImport Summary:`);
    console.log(`Total rows processed: ${rowCount}`);
    console.log(`Teachers skipped (already have scores): ${skippedCount}`);
    console.log(`Total score records inserted/updated: ${insertedCount}`);
    console.log('Import completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during import, transaction rolled back:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

importScores();