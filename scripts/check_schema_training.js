require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    try {
        const resVideos = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'training_videos'
        `);
        console.log('training_videos columns:', resVideos.rows);

        const resScores = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'training_teacher_video_scores'
        `);
        console.log('training_teacher_video_scores columns:', resScores.rows);

        const resTeachers = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'teachers'
        `);
        console.log('teachers columns:', resTeachers.rows.map(r => r.column_name).join(', '));
        
        const videos = await pool.query(`SELECT id, title, video_category, lesson_number FROM training_videos ORDER BY id ASC`);
        console.log('All videos:', videos.rows);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

main();