import pool from '@/lib/db';
import {
  deleteQuestionImagesSilently,
  deleteRemovedQuestionImagesSilently,
  persistEmbeddedQuestionImages,
  persistQuestionImageUrl,
} from '@/lib/question-image-storage';
import { NextRequest, NextResponse } from 'next/server';

type UiDifficulty = 'easy' | 'medium' | 'hard';

type ExamQuestionStorageRow = {
  image_url?: string | null;
  noi_dung_cau_hoi?: string | null;
  dap_an_dung?: string | null;
  giai_thich?: string | null;
  lua_chon_a?: string | null;
  lua_chon_b?: string | null;
  lua_chon_c?: string | null;
  lua_chon_d?: string | null;
};

const normalizeDifficulty = (value: unknown): UiDifficulty => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'easy' || normalized === 'de') return 'easy';
  if (normalized === 'hard' || normalized === 'kho') return 'hard';
  return 'medium';
};

const normalizeQuestionRow = <T extends { difficulty?: unknown }>(
  row: T,
): Omit<T, 'difficulty'> & { difficulty: UiDifficulty } => ({
  ...row,
  difficulty: normalizeDifficulty(row.difficulty),
});

const questionImageValues = (row: ExamQuestionStorageRow | null | undefined): unknown[] => [
  row?.image_url,
  row?.noi_dung_cau_hoi,
  row?.dap_an_dung,
  row?.giai_thich,
  row?.lua_chon_a,
  row?.lua_chon_b,
  row?.lua_chon_c,
  row?.lua_chon_d,
];

async function persistHtmlValue(value: unknown): Promise<string | null> {
  const persisted = await persistEmbeddedQuestionImages(value);
  return persisted == null ? null : String(persisted);
}

async function persistOptions(options: unknown): Promise<string[]> {
  if (!Array.isArray(options)) return [];
  const persisted = await Promise.all(options.map((item) => persistHtmlValue(item)));
  return persisted.map((item) => item || '').filter(Boolean);
}

async function selectStoredQuestion(client: any, id: unknown) {
  return client.query(
    `SELECT image_url, noi_dung_cau_hoi, dap_an_dung, giai_thich,
            lua_chon_a, lua_chon_b, lua_chon_c, lua_chon_d
       FROM chuyen_sau_cauhoi
      WHERE id = $1`,
    [id],
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const setId = searchParams.get('set_id');

    if (!setId) {
      return NextResponse.json({ error: 'set_id is required' }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT
         cq.id,
         bc.id_de                                           AS assignment_id,
         cq.noi_dung_cau_hoi                               AS question_text,
         cq.loai_cau_hoi                                   AS question_type,
         COALESCE(cq.dap_an_dung, '')                      AS correct_answer,
         CASE
           WHEN cq.lua_chon_a IS NULL AND cq.lua_chon_b IS NULL
            AND cq.lua_chon_c IS NULL AND cq.lua_chon_d IS NULL THEN NULL
           ELSE jsonb_build_array(cq.lua_chon_a, cq.lua_chon_b, cq.lua_chon_c, cq.lua_chon_d)
         END                                               AS options,
         COALESCE(cq.giai_thich, '')                       AS explanation,
         cq.diem                                           AS points,
         bc.thu_tu_hien_thi                                AS order_number,
         cq.do_kho                                         AS difficulty,
         cq.image_url                                      AS image_url,
         bd.ma_de                                          AS set_code,
         bd.ten_de                                         AS set_name,
         mh.ten_mon                                        AS subject_name
       FROM chuyen_sau_bode_cauhoi bc
       JOIN chuyen_sau_cauhoi cq ON cq.id = bc.id_cau
       JOIN chuyen_sau_bode bd   ON bd.id = bc.id_de
       JOIN chuyen_sau_monhoc mh ON mh.id = bd.id_mon
       WHERE bc.id_de = $1
       ORDER BY bc.thu_tu_hien_thi ASC`,
      [setId],
    );

    const rows = result.rows.map(normalizeQuestionRow);
    return NextResponse.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    console.error('Error fetching exam set questions:', error);
    return NextResponse.json({ error: 'Failed to fetch exam set questions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let client: any = null;
  try {
    const body = await request.json();
    const {
      set_id,
      question_text,
      question_type = 'trac_nghiem',
      correct_answer,
      options,
      explanation,
      points = 1,
      order_number,
      difficulty = 'medium',
      image_url,
    } = body;

    if (!set_id) {
      return NextResponse.json({ error: 'set_id is required' }, { status: 400 });
    }

    const persistedText = await persistHtmlValue(question_text);
    const normalizedText = persistedText?.trim() || '[Chua co noi dung]';
    const persistedCorrectAnswer = await persistHtmlValue(correct_answer);
    const persistedExplanation = await persistHtmlValue(explanation);
    const persistedOptions = await persistOptions(options);
    const persistedImageUrl = await persistQuestionImageUrl(image_url);

    client = await pool.connect();
    await client.query('BEGIN');

    const questionResult = await client.query(
      `INSERT INTO chuyen_sau_cauhoi (
         loai_cau_hoi, noi_dung_cau_hoi,
         lua_chon_a, lua_chon_b, lua_chon_c, lua_chon_d,
         dap_an_dung, giai_thich, diem, do_kho, image_url
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        question_type === 'essay' ? 'tu_luan' : question_type,
        normalizedText,
        persistedOptions[0] || null,
        persistedOptions[1] || null,
        persistedOptions[2] || null,
        persistedOptions[3] || null,
        persistedCorrectAnswer,
        persistedExplanation,
        Number(points || 1),
        normalizeDifficulty(difficulty),
        persistedImageUrl,
      ],
    );
    const questionId = questionResult.rows[0].id;

    await client.query(
      `INSERT INTO chuyen_sau_bode_cauhoi (id_de, id_cau, thu_tu_hien_thi)
       VALUES ($1, $2, $3)`,
      [set_id, questionId, Number(order_number || 1)],
    );

    const resultRow = await client.query(
      `SELECT
         cq.id,
         bc.id_de AS assignment_id,
         cq.noi_dung_cau_hoi AS question_text,
         cq.loai_cau_hoi AS question_type,
         cq.dap_an_dung AS correct_answer,
         CASE
           WHEN cq.lua_chon_a IS NULL AND cq.lua_chon_b IS NULL
            AND cq.lua_chon_c IS NULL AND cq.lua_chon_d IS NULL THEN NULL
           ELSE jsonb_build_array(cq.lua_chon_a, cq.lua_chon_b, cq.lua_chon_c, cq.lua_chon_d)
         END AS options,
         cq.giai_thich AS explanation,
         cq.diem AS points,
         bc.thu_tu_hien_thi AS order_number,
         cq.do_kho AS difficulty,
         cq.image_url AS image_url
       FROM chuyen_sau_cauhoi cq
       JOIN chuyen_sau_bode_cauhoi bc ON bc.id_cau = cq.id
       WHERE cq.id = $1
       LIMIT 1`,
      [questionId],
    );

    await client.query('COMMIT');

    return NextResponse.json(
      { success: true, data: normalizeQuestionRow(resultRow.rows[0]), message: 'Exam set question created successfully' },
      { status: 201 },
    );
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Error creating exam set question:', error);
    return NextResponse.json({ error: 'Failed to create exam set question' }, { status: 500 });
  } finally {
    client?.release();
  }
}

export async function PUT(request: NextRequest) {
  let client: any = null;
  let previousRow: ExamQuestionStorageRow | null = null;
  let updatedRow: ExamQuestionStorageRow | null = null;

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Question id is required' }, { status: 400 });
    }

    const allowedFields = [
      'question_text', 'question_type', 'correct_answer',
      'options', 'explanation', 'points', 'order_number', 'difficulty', 'image_url',
    ];

    const questionClauses: string[] = [];
    const questionValues: unknown[] = [];
    const mappingClauses: string[] = [];
    const mappingValues: unknown[] = [];

    for (const key of Object.keys(updates)) {
      if (!allowedFields.includes(key)) continue;

      if (key === 'order_number') {
        mappingClauses.push(`thu_tu_hien_thi = $${mappingValues.length + 1}`);
        mappingValues.push(Number(updates[key] || 1));
        continue;
      }
      if (key === 'points') {
        questionClauses.push(`diem = $${questionValues.length + 1}`);
        questionValues.push(Number(updates[key] || 1));
        continue;
      }
      if (key === 'options') {
        const persisted = await persistOptions(updates[key]);
        const fields = ['lua_chon_a', 'lua_chon_b', 'lua_chon_c', 'lua_chon_d'] as const;
        fields.forEach((field, idx) => {
          questionClauses.push(`${field} = $${questionValues.length + 1}`);
          questionValues.push(persisted[idx] || null);
        });
        continue;
      }
      if (key === 'question_text') {
        questionClauses.push(`noi_dung_cau_hoi = $${questionValues.length + 1}`);
        questionValues.push(await persistHtmlValue(updates[key]));
        continue;
      }
      if (key === 'correct_answer') {
        questionClauses.push(`dap_an_dung = $${questionValues.length + 1}`);
        questionValues.push(await persistHtmlValue(updates[key]));
        continue;
      }
      if (key === 'explanation') {
        questionClauses.push(`giai_thich = $${questionValues.length + 1}`);
        questionValues.push(await persistHtmlValue(updates[key]));
        continue;
      }
      if (key === 'question_type') {
        questionClauses.push(`loai_cau_hoi = $${questionValues.length + 1}`);
        questionValues.push(updates[key] === 'essay' ? 'tu_luan' : updates[key]);
        continue;
      }
      if (key === 'difficulty') {
        questionClauses.push(`do_kho = $${questionValues.length + 1}`);
        questionValues.push(normalizeDifficulty(updates[key]));
        continue;
      }
      if (key === 'image_url') {
        questionClauses.push(`image_url = $${questionValues.length + 1}`);
        questionValues.push(await persistQuestionImageUrl(updates[key]));
      }
    }

    if (questionClauses.length === 0 && mappingClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const existing = await selectStoredQuestion(client, id);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Exam set question not found' }, { status: 404 });
    }
    previousRow = existing.rows[0];

    if (questionClauses.length > 0) {
      questionValues.push(id);
      await client.query(
        `UPDATE chuyen_sau_cauhoi SET ${questionClauses.join(', ')} WHERE id = $${questionValues.length}`,
        questionValues,
      );
    }

    if (mappingClauses.length > 0) {
      mappingValues.push(id);
      await client.query(
        `UPDATE chuyen_sau_bode_cauhoi SET ${mappingClauses.join(', ')} WHERE id_cau = $${mappingValues.length}`,
        mappingValues,
      );
    }

    const updated = await selectStoredQuestion(client, id);
    updatedRow = updated.rows[0];

    await client.query('COMMIT');

    if (previousRow && updatedRow) {
      deleteRemovedQuestionImagesSilently(questionImageValues(previousRow), questionImageValues(updatedRow));
    }

    return NextResponse.json({ success: true, data: { id }, message: 'Exam set question updated successfully' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Error updating exam set question:', error);
    return NextResponse.json({ error: 'Failed to update exam set question' }, { status: 500 });
  } finally {
    client?.release();
  }
}

export async function DELETE(request: NextRequest) {
  let client: any = null;
  let existingRow: ExamQuestionStorageRow | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Question id is required' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const existing = await selectStoredQuestion(client, id);
    existingRow = existing.rows[0] || null;

    await client.query('DELETE FROM chuyen_sau_bode_cauhoi WHERE id_cau = $1', [id]);

    const result = await client.query(
      `DELETE FROM chuyen_sau_cauhoi cq
       WHERE cq.id = $1
         AND NOT EXISTS (
           SELECT 1 FROM chuyen_sau_bode_cauhoi bc WHERE bc.id_cau = cq.id
         )
       RETURNING *`,
      [id],
    );

    await client.query('COMMIT');

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Exam set question not found' }, { status: 404 });
    }

    deleteQuestionImagesSilently(questionImageValues(existingRow));

    return NextResponse.json({ success: true, message: 'Exam set question deleted successfully' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Error deleting exam set question:', error);
    return NextResponse.json({ error: 'Failed to delete exam set question' }, { status: 500 });
  } finally {
    client?.release();
  }
}
