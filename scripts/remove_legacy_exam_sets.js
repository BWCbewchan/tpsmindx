require('dotenv').config();
const { Client } = require('pg');

async function makeUniqueSetCode(client, subjectId, initialCode) {
  let candidate = initialCode;
  let suffix = 1;

  while (true) {
    const exists = await client.query(
      `SELECT 1 FROM exam_sets WHERE subject_id = $1 AND set_code = $2 LIMIT 1`,
      [subjectId, candidate]
    );

    if (exists.rowCount === 0) {
      return candidate;
    }

    suffix += 1;
    candidate = `${initialCode}-${String(suffix).padStart(2, '0')}`;
  }
}

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
    const legacyResult = await client.query(`
      SELECT
        es.id,
        es.subject_id,
        es.set_code,
        es.set_name,
        es.duration_minutes,
        es.total_points,
        es.passing_score,
        es.status,
        es.valid_from,
        es.valid_to,
        esc.block_code,
        esc.subject_code
      FROM exam_sets es
      JOIN exam_subject_catalog esc ON esc.id = es.subject_id
      WHERE es.set_code LIKE 'LEGACY-%' OR es.set_name ILIKE 'Legacy Set - %'
      ORDER BY es.id ASC
    `);

    if (legacyResult.rowCount === 0) {
      console.log('No legacy sets found. Nothing to remove.');
      await client.query('COMMIT');
      await client.end();
      return;
    }

    let totalAssignmentsRepointed = 0;
    let totalSetsCreated = 0;
    let totalQuestionsCopied = 0;
    let totalSetsDeleted = 0;

    for (const legacy of legacyResult.rows) {
      const baseCodeRaw = String(legacy.set_code || `SET-${legacy.id}`).replace(/^LEGACY-/, 'SET-');
      const baseCode = baseCodeRaw.length > 3 ? baseCodeRaw : `SET-${legacy.id}`;
      const replacementCode = await makeUniqueSetCode(client, legacy.subject_id, baseCode);

      const replacementName = String(legacy.set_name || `Bộ đề ${legacy.subject_code}`)
        .replace(/^Legacy Set\s*-\s*/i, '')
        .trim();

      const createdSet = await client.query(
        `
        INSERT INTO exam_sets (
          subject_id,
          set_code,
          set_name,
          duration_minutes,
          total_points,
          passing_score,
          status,
          valid_from,
          valid_to
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id
        `,
        [
          legacy.subject_id,
          replacementCode,
          replacementName,
          legacy.duration_minutes,
          legacy.total_points,
          legacy.passing_score,
          legacy.status,
          legacy.valid_from,
          legacy.valid_to,
        ]
      );

      const replacementSetId = createdSet.rows[0].id;
      totalSetsCreated += 1;

      const copiedQuestions = await client.query(
        `
        INSERT INTO exam_set_questions (
          set_id,
          question_text,
          question_type,
          options,
          correct_answer,
          explanation,
          points,
          order_number,
          created_at,
          updated_at
        )
        SELECT
          $1,
          question_text,
          question_type,
          options,
          correct_answer,
          explanation,
          points,
          order_number,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM exam_set_questions
        WHERE set_id = $2
        ORDER BY order_number ASC
        `,
        [replacementSetId, legacy.id]
      );
      totalQuestionsCopied += copiedQuestions.rowCount;

      const repointedAssignments = await client.query(
        `
        UPDATE teacher_exam_assignments
        SET selected_set_id = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE selected_set_id = $2
        `,
        [replacementSetId, legacy.id]
      );
      totalAssignmentsRepointed += repointedAssignments.rowCount;

      await client.query(
        `
        UPDATE exam_assignment_events
        SET payload = jsonb_set(payload, '{selected_set_id}', to_jsonb($1::bigint), true)
        WHERE payload ? 'selected_set_id'
          AND (payload->>'selected_set_id') ~ '^\\d+$'
          AND (payload->>'selected_set_id')::bigint = $2
        `,
        [replacementSetId, legacy.id]
      );

      await client.query(`DELETE FROM exam_sets WHERE id = $1`, [legacy.id]);
      totalSetsDeleted += 1;

      console.log(
        `Migrated ${legacy.set_code} -> ${replacementCode}; copied questions=${copiedQuestions.rowCount}; repointed assignments=${repointedAssignments.rowCount}`
      );
    }

    await client.query('COMMIT');

    console.log('Done removing legacy sets.');
    console.log(
      JSON.stringify(
        {
          legacySetsProcessed: legacyResult.rowCount,
          replacementSetsCreated: totalSetsCreated,
          legacySetsDeleted: totalSetsDeleted,
          questionsCopied: totalQuestionsCopied,
          assignmentsRepointed: totalAssignmentsRepointed,
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('remove_legacy_exam_sets failed:', error);
  process.exit(1);
});
