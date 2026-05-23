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
  await client.query('BEGIN');

  try {
    const result = await client.query(`
      WITH missing AS (
        SELECT
          er.id AS registration_id,
          er.teacher_code,
          er.exam_type,
          er.registration_type,
          er.block_code,
          er.subject_code,
          er.scheduled_at
        FROM exam_registrations er
        LEFT JOIN teacher_exam_assignments tea ON tea.registration_id = er.id
        WHERE tea.id IS NULL
      ),
      resolved AS (
        SELECT
          m.*,
          set_pick.id AS set_id
        FROM missing m
        LEFT JOIN LATERAL (
          SELECT es.id
          FROM exam_sets es
          JOIN exam_subject_catalog esc ON esc.id = es.subject_id
          WHERE esc.exam_type = m.exam_type
            AND esc.block_code = m.block_code
            AND esc.subject_code = m.subject_code
            AND es.status = 'active'
            AND (es.valid_from IS NULL OR m.scheduled_at >= es.valid_from)
            AND (es.valid_to IS NULL OR m.scheduled_at <= es.valid_to)
          ORDER BY RANDOM()
          LIMIT 1
        ) set_pick ON TRUE
      ),
      inserted AS (
        INSERT INTO teacher_exam_assignments (
          registration_id,
          teacher_code,
          exam_type,
          registration_type,
          block_code,
          subject_code,
          selected_set_id,
          random_seed,
          random_assigned_at,
          open_at,
          close_at,
          assignment_status,
          score,
          score_status,
          expired_at
        )
        SELECT
          r.registration_id,
          r.teacher_code,
          r.exam_type,
          r.registration_type,
          r.block_code,
          r.subject_code,
          r.set_id,
          NULL,
          CURRENT_TIMESTAMP,
          r.scheduled_at,
          r.scheduled_at + INTERVAL '45 minutes',
          'assigned',
          NULL,
          'null',
          NULL
        FROM resolved r
        WHERE r.set_id IS NOT NULL
        RETURNING id, registration_id
      )
      SELECT COUNT(*)::int AS inserted_count FROM inserted
    `);

    const insertedCount = result.rows[0]?.inserted_count || 0;
    console.log(`Inserted missing assignments: ${insertedCount}`);

    const eventsInserted = await client.query(`
      INSERT INTO exam_assignment_events (
        assignment_id,
        event_type,
        actor_type,
        actor_code,
        payload
      )
      SELECT
        tea.id,
        'assigned',
        'system',
        NULL,
        jsonb_build_object(
          'registration_id', tea.registration_id,
          'source', 'manual-backfill-script'
        )
      FROM teacher_exam_assignments tea
      WHERE NOT EXISTS (
        SELECT 1
        FROM exam_assignment_events e
        WHERE e.assignment_id = tea.id
          AND e.event_type = 'assigned'
      )
    `);

    console.log(`Inserted missing assigned events: ${eventsInserted.rowCount}`);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('backfill_missing_exam_assignments failed:', error);
  process.exit(1);
});
