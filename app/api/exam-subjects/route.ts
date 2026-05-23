import pool from '@/lib/db';
import { NextResponse } from 'next/server';

type BlockCode = 'CODING' | 'ROBOTICS' | 'ART' | 'PROCESS' | `PROCESS-${string}`;

const STATIC_BLOCK_CODES: Array<'CODING' | 'ROBOTICS' | 'ART' | 'PROCESS'> = ['CODING', 'ROBOTICS', 'ART', 'PROCESS'];

const normalizeSubjectKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeProcessSuffix = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'CUSTOM';

const resolveInputBlockCode = (rawValue: string): BlockCode => {
  const value = String(rawValue || 'CODING').toUpperCase();
  if ((STATIC_BLOCK_CODES as string[]).includes(value)) {
    return value as BlockCode;
  }
  if (value.startsWith('PROCESS-')) {
    const suffix = normalizeProcessSuffix(value.slice('PROCESS-'.length));
    return `PROCESS-${suffix}` as BlockCode;
  }
  return 'CODING';
};

const isAllowedBlockCode = (value: string) => {
  if ((STATIC_BLOCK_CODES as string[]).includes(value)) return true;
  return value.startsWith('PROCESS-') && value.length > 'PROCESS-'.length;
};

const getSubjectPrefix = (blockCode: BlockCode) => {
  if (blockCode === 'CODING') return 'cod';
  if (blockCode === 'ROBOTICS') return 'rob';
  if (blockCode === 'ART') return 'art';
  if (blockCode.startsWith('PROCESS-')) {
    return `process_${normalizeSubjectKey(blockCode.slice('PROCESS-'.length))}`;
  }
  return 'process';
};

const inferExamType = (blockCode: BlockCode) => (blockCode.startsWith('PROCESS') ? 'experience' : 'expertise');

let subjectConfigColumnsEnsured = false;

async function ensureSubjectConfigColumns() {
  if (subjectConfigColumnsEnsured) return;

  await pool.query(`
    ALTER TABLE IF EXISTS chuyen_sau_monhoc
      ADD COLUMN IF NOT EXISTS metadata JSONB,
      ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
  `);

  await pool.query(`
    UPDATE chuyen_sau_monhoc
    SET thoi_gian_thi_phut = COALESCE(
      thoi_gian_thi_phut,
      CASE
        WHEN COALESCE(metadata->>'duration_minutes', '') ~ '^[0-9]+$' THEN (metadata->>'duration_minutes')::int
        ELSE NULL
      END,
      CASE WHEN loai_ky_thi = 'experience' THEN 60 ELSE 120 END
    )
    WHERE thoi_gian_thi_phut IS NULL;
  `);

  // Auto-fix dữ liệu cũ: nếu vẫn đang lưu PROCESS theo 3 môn chuẩn thì tách về PROCESS-ART/COD/ROB.
  await pool.query(`
    UPDATE chuyen_sau_monhoc
    SET ma_khoi = CASE
      WHEN lower(COALESCE(ma_mon, '')) LIKE '%[art]%' OR lower(COALESCE(ten_mon, '')) LIKE '%[art]%' THEN 'PROCESS-ART'
      WHEN lower(COALESCE(ma_mon, '')) LIKE '%[coding]%' OR lower(COALESCE(ten_mon, '')) LIKE '%[coding]%' THEN 'PROCESS-COD'
      WHEN lower(COALESCE(ma_mon, '')) LIKE '%[robotics]%' OR lower(COALESCE(ten_mon, '')) LIKE '%[robotics]%' THEN 'PROCESS-ROB'
      ELSE ma_khoi
    END,
    loai_ky_thi = 'experience'
    WHERE ma_khoi = 'PROCESS';
  `);

  subjectConfigColumnsEnsured = true;
}

export async function GET() {
  try {
    await ensureSubjectConfigColumns();

    const result = await pool.query(
      `SELECT
         csm.id,
         csm.loai_ky_thi AS exam_type,
         csm.ma_khoi AS block_code,
         csm.ma_mon AS subject_code,
         csm.ten_mon AS subject_name,
         csm.khoa_mon AS subject_key,
         csm.thoi_gian_thi_phut AS duration_minutes,
         CASE WHEN csm.che_do_chon_de = 'ngau_nhien' THEN 'random' ELSE 'default' END AS set_selection_mode,
         chonde.id_de AS default_set_id,
         ds.ma_de AS default_set_code,
         ds.ten_de AS default_set_name,
         csm.metadata,
         csm.dang_hoat_dong AS is_active,
         csm.tao_luc AS created_at,
         csm.tao_luc AS updated_at
       FROM chuyen_sau_monhoc csm
       LEFT JOIN LATERAL (
         SELECT ct.id_de
         FROM chuyen_sau_chonde_thang ct
         WHERE ct.id_mon = csm.id
         ORDER BY ct.nam DESC, ct.thang DESC
         LIMIT 1
       ) chonde ON TRUE
       LEFT JOIN chuyen_sau_bode ds ON ds.id = chonde.id_de
       WHERE csm.dang_hoat_dong = TRUE
       ORDER BY csm.ma_khoi ASC, csm.ten_mon ASC`
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching exam subjects:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch exam subjects' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    await ensureSubjectConfigColumns();

    const body = await request.json();
    const subjectName = String(body?.subject_name || '').trim();
    const rawBlockCode = String(body?.block_code || 'CODING').toUpperCase();
    if (!isAllowedBlockCode(rawBlockCode)) {
      return NextResponse.json(
        { success: false, error: 'Khối môn không hợp lệ' },
        { status: 400 }
      );
    }
    const inputBlockCode = resolveInputBlockCode(rawBlockCode);

    if (!subjectName) {
      return NextResponse.json(
        { success: false, error: 'Tên môn là bắt buộc' },
        { status: 400 }
      );
    }

    const prefix = getSubjectPrefix(inputBlockCode);
    const normalizedBase = normalizeSubjectKey(subjectName) || 'mon_hoc';
    const subjectKey = `${prefix}_${normalizedBase}`;
    const examType = inferExamType(inputBlockCode);
    const inputDurationMinutes = Number(body?.duration_minutes);
    const defaultDurationMinutes = inputBlockCode.startsWith('PROCESS') ? 60 : 120;
    const durationMinutes = Number.isFinite(inputDurationMinutes) && inputDurationMinutes > 0
      ? Math.min(1440, Math.floor(inputDurationMinutes))
      : defaultDurationMinutes;

    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id
       FROM chuyen_sau_monhoc
       WHERE (khoa_mon = $1)
          OR (ma_khoi = $2 AND lower(ten_mon) = lower($3))
       LIMIT 1`,
      [subjectKey, inputBlockCode, subjectName]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Môn học đã tồn tại trong hệ thống' },
        { status: 409 }
      );
    }

    const displayOrderResult = await client.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order
       FROM chuyen_sau_monhoc
       WHERE ma_khoi = $1`,
      [inputBlockCode]
    );
    const displayOrder = Number(displayOrderResult.rows[0]?.next_order || 1);

    const insertResult = await client.query(
      `INSERT INTO chuyen_sau_monhoc (
         loai_ky_thi,
         ma_khoi,
         ma_mon,
         ten_mon,
         khoa_mon,
         thoi_gian_thi_phut,
         exam_duration_minutes,
         che_do_chon_de,
         display_order,
         dang_hoat_dong,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $6, 'mac_dinh', $7, TRUE, $8::jsonb)
       RETURNING
         id,
         loai_ky_thi AS exam_type,
         ma_khoi AS block_code,
         ma_mon AS subject_code,
         ten_mon AS subject_name,
         khoa_mon AS subject_key,
         thoi_gian_thi_phut AS duration_minutes,
         CASE WHEN che_do_chon_de = 'ngau_nhien' THEN 'random' ELSE 'default' END AS set_selection_mode,
         NULL::bigint AS default_set_id,
         metadata,
         dang_hoat_dong AS is_active,
         tao_luc AS created_at,
         tao_luc AS updated_at`,
      // NOTE: tham số giữ nguyên thứ tự ($1=loai_ky_thi, $2=ma_khoi, ...)
      [
        examType,
        inputBlockCode,
        subjectName,
        subjectName,
        subjectKey,
        durationMinutes,
        displayOrder,
        JSON.stringify({ created_source: 'thu_vien_de_manual', duration_minutes: durationMinutes }),
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: insertResult.rows[0],
    });
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors to preserve original error handling.
    }
    console.error('Error creating exam subject:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create exam subject' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSubjectConfigColumns();

    const body = await request.json();
    const subjectId = Number(body?.id);
    const hasDuration = body?.duration_minutes !== undefined;
    const hasSelectionMode = body?.set_selection_mode !== undefined;
    const inputDurationMinutes = Number(body?.duration_minutes);
    const inputSelectionMode = String(body?.set_selection_mode || '').trim().toLowerCase();

    if (!Number.isFinite(subjectId) || subjectId <= 0) {
      return NextResponse.json(
        { success: false, error: 'id bộ môn không hợp lệ' },
        { status: 400 }
      );
    }

    if (!hasDuration && !hasSelectionMode) {
      return NextResponse.json(
        { success: false, error: 'Không có dữ liệu cần cập nhật' },
        { status: 400 }
      );
    }

    if (hasDuration && (!Number.isFinite(inputDurationMinutes) || inputDurationMinutes <= 0)) {
      return NextResponse.json(
        { success: false, error: 'duration_minutes phải lớn hơn 0' },
        { status: 400 }
      );
    }

    if (hasSelectionMode && !['default', 'random'].includes(inputSelectionMode)) {
      return NextResponse.json(
        { success: false, error: 'set_selection_mode chỉ chấp nhận default hoặc random' },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: Array<number | string | null> = [];

    if (hasDuration) {
      const durationMinutes = Math.min(1440, Math.floor(inputDurationMinutes));
      updates.push(`thoi_gian_thi_phut = $${values.length + 1}`);
      updates.push(`exam_duration_minutes = $${values.length + 1}`);
      values.push(durationMinutes);
    }

    if (hasSelectionMode) {
      const dbSelectionMode = inputSelectionMode === 'random' ? 'ngau_nhien' : 'mac_dinh';
      updates.push(`che_do_chon_de = $${values.length + 1}`);
      values.push(dbSelectionMode);
    }

    updates.push(`metadata = COALESCE(metadata, '{}'::jsonb)`);

    const result = await pool.query(
      `UPDATE chuyen_sau_monhoc
       SET ${updates.join(', ')}
       WHERE id = $${values.length + 1}
       RETURNING
         id,
         loai_ky_thi AS exam_type,
         ma_khoi AS block_code,
         ma_mon AS subject_code,
         ten_mon AS subject_name,
         khoa_mon AS subject_key,
         thoi_gian_thi_phut AS duration_minutes,
         CASE WHEN che_do_chon_de = 'ngau_nhien' THEN 'random' ELSE 'default' END AS set_selection_mode,
         metadata,
         dang_hoat_dong AS is_active,
         tao_luc AS created_at,
         tao_luc AS updated_at`,
      [...values, subjectId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy bộ môn' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating exam subject:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update exam subject' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const subjectId = Number(searchParams.get('id'));

  if (!Number.isFinite(subjectId) || subjectId <= 0) {
    return NextResponse.json(
      { success: false, error: 'id bộ môn không hợp lệ' },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check subject exists
    const existed = await client.query(
      `SELECT id FROM chuyen_sau_monhoc WHERE id = $1`,
      [subjectId]
    );
    if (existed.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy bộ môn' },
        { status: 404 }
      );
    }

    // Nullify selected_set_id on assignments pointing to sets of this subject
    // (teacher_exam_assignments.selected_set_id has ON DELETE RESTRICT)
    await client.query(
      `UPDATE teacher_exam_assignments
       SET selected_set_id = NULL
       WHERE selected_set_id IN (
         SELECT id FROM chuyen_sau_bode WHERE id_mon = $1
       )`,
      [subjectId]
    );

    // Delete the subject — cascades to:
    //   chuyen_sau_bode (id_mon FK ON DELETE CASCADE)
    //   chuyen_sau_chonde_thang (id_mon FK ON DELETE CASCADE)
    //   chuyen_sau_bode_cauhoi via bode cascade (if FK exists)
    //   monthly_exam_selections (subject_id FK ON DELETE CASCADE)
    await client.query(
      `DELETE FROM chuyen_sau_monhoc WHERE id = $1`,
      [subjectId]
    );

    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('Error deleting exam subject:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete exam subject' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
