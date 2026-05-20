const { Pool } = require('pg');
require('dotenv').config();

function buildPoolConfig() {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const dbHost = process.env.DB_HOST?.trim() || '';
    const dbUser = process.env.DB_USER?.trim() || '';
    const dbName = process.env.DB_NAME?.trim() || '';

    const urlRequiresSsl = Boolean(
        databaseUrl &&
        (/sslmode=require|sslmode=no-verify/i.test(databaseUrl) || /[?&]ssl=true\b/i.test(databaseUrl))
    );
    const urlLooksHosted = Boolean(
        databaseUrl &&
        /supabase\.co|neon\.tech|aiven\.io|aivencloud\.com|amazonaws\.com|render\.com|railway\.app/i.test(databaseUrl)
    );
    const hostLooksHosted = Boolean(
        dbHost &&
        /supabase\.co|neon\.tech|aiven\.io|aivencloud\.com|amazonaws\.com|render\.com|railway\.app/i.test(dbHost)
    );
    const looksLikeAivenDefaults = dbUser === 'avnadmin' || dbName === 'defaultdb';
    const sslExplicitOn = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';

    const useSsl = !(/sslmode=disable/i.test(databaseUrl || '')) && (sslExplicitOn || urlRequiresSsl || urlLooksHosted || hostLooksHosted || looksLikeAivenDefaults);

    const ssl = useSsl
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
        : undefined;

    if (databaseUrl) {
        return { connectionString: databaseUrl, ssl };
    }

    return {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl,
    };
}

async function reviewTrainingScores() {
    const pool = new Pool(buildPoolConfig());

    try {
        console.log('--- Training Scores Review Report ---');

        // 1. Total Teachers
        const teacherCountRes = await pool.query('SELECT count(*) as total FROM teachers');
        const totalTeachers = parseInt(teacherCountRes.rows[0].total);
        console.log(`Total teachers in 'teachers' table: ${totalTeachers}`);
        console.log('------------------------------------');

        // 2. Video Scores Review
        console.log('\nReviewing Video Scores (training_teacher_video_scores):');
        const videosRes = await pool.query('SELECT id, title FROM training_videos ORDER BY id ASC');
        const videos = videosRes.rows;

        if (videos.length === 0) {
            console.log('No training videos found.');
        } else {
            for (const video of videos) {
                const scoreCountRes = await pool.query(
                    'SELECT count(DISTINCT teacher_code) as count FROM training_teacher_video_scores WHERE video_id = $1',
                    [video.id]
                );
                const count = parseInt(scoreCountRes.rows[0].count);
                const diff = totalTeachers - count;
                const status = diff === 0 ? '✅ MATCH' : `❌ MISSING ${diff}`;
                console.log(`Video [${video.id}] ${video.title.padEnd(40)} | Count: ${count}/${totalTeachers} | ${status}`);
            }
        }

        // 3. Assignment Submissions Review
        console.log('\nReviewing Assignment Submissions (training_assignment_submissions):');
        const assignmentsRes = await pool.query('SELECT id, assignment_title FROM training_video_assignments ORDER BY id ASC');
        const assignments = assignmentsRes.rows;

        if (assignments.length === 0) {
            console.log('No training assignments found.');
        } else {
            for (const assignment of assignments) {
                const subCountRes = await pool.query(
                    'SELECT count(DISTINCT teacher_code) as count FROM training_assignment_submissions WHERE assignment_id = $1',
                    [assignment.id]
                );
                const count = parseInt(subCountRes.rows[0].count);
                const diff = totalTeachers - count;
                const status = diff === 0 ? '✅ MATCH' : `❌ MISSING ${diff}`;
                console.log(`Assignment [${assignment.id}] ${assignment.assignment_title.padEnd(40)} | Count: ${count}/${totalTeachers} | ${status}`);
            }
        }

        console.log('\n------------------------------------');
        console.log('Review Complete.');

    } catch (error) {
        console.error('Error during review:', error);
    } finally {
        await pool.end();
    }
}

reviewTrainingScores();