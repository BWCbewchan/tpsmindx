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

  const registrations = await client.query(`
    SELECT id, teacher_code, exam_type, registration_type, block_code, subject_code, scheduled_at, created_at
    FROM exam_registrations
    ORDER BY id DESC
    LIMIT 20
  `);

  const assignments = await client.query(`
    SELECT id, registration_id, teacher_code, exam_type, registration_type, block_code, subject_code,
           selected_set_id, assignment_status, open_at, close_at, created_at
    FROM teacher_exam_assignments
    ORDER BY id DESC
    LIMIT 20
  `);

  const catalog = await client.query(`
    SELECT id, exam_type, block_code, subject_code, subject_name, is_active
    FROM exam_subject_catalog
    ORDER BY block_code, subject_code
    LIMIT 50
  `);

  const sets = await client.query(`
    SELECT es.id, es.set_code, es.set_name, es.status, esc.block_code, esc.subject_code
    FROM exam_sets es
    JOIN exam_subject_catalog esc ON esc.id = es.subject_id
    ORDER BY es.id DESC
    LIMIT 50
  `);

  const missingAssignments = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM exam_registrations er
    LEFT JOIN teacher_exam_assignments tea ON tea.registration_id = er.id
    WHERE tea.id IS NULL
  `);

  console.log('--- latest exam_registrations ---');
  console.table(registrations.rows);
  console.log('--- latest teacher_exam_assignments ---');
  console.table(assignments.rows);
  console.log('--- exam_subject_catalog ---');
  console.table(catalog.rows);
  console.log('--- exam_sets ---');
  console.table(sets.rows);
  console.log('--- registrations without assignments ---');
  console.table(missingAssignments.rows);

  await client.end();
}

main().catch((error) => {
  console.error('debug_exam_data failed:', error);
  process.exit(1);
});
