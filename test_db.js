const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT tva.video_id, tv.title, tv.duration_minutes, tv.duration_seconds FROM training_video_assignments tva LEFT JOIN training_videos tv ON tva.video_id = tv.id WHERE tva.id = 14').then(r => { console.log(r.rows); pool.end(); }).catch(e => { console.error(e); pool.end(); });
