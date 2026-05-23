require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const suspiciousCenters = await client.query(`
    SELECT teacher_code, full_name, center, status
    FROM training_teacher_stats
    WHERE LOWER(TRIM(COALESCE(center, ''))) IN ('active', 'inactive')
    ORDER BY teacher_code
    LIMIT 50
  `);

  const latestRegistrations = await client.query(`
    SELECT id, teacher_code, center_code, source_form, created_at
    FROM exam_registrations
    ORDER BY id DESC
    LIMIT 30
  `);

  console.log('--- training_teacher_stats with suspicious center values ---');
  console.table(suspiciousCenters.rows);

  console.log('--- latest exam_registrations center_code ---');
  console.table(latestRegistrations.rows);

  await client.end();
}

main().catch((error) => {
  console.error('debug_center_code failed:', error);
  process.exit(1);
});
