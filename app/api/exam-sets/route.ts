import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { deleteObject, parsePublicUrl } from '@/lib/supabase-s3';

/** Xóa ảnh S3 an toàn, không throw */
async function deleteImageSilently(url: string | null) {
  if (!url) return;
  const parsed = parsePublicUrl(url);
  if (!parsed) return;
  try {
    await deleteObject(parsed.bucket, parsed.key);
  } catch (err) {
    console.error(`[S3 Cleanup] Failed to delete ${url}:`, err);
  }
}

/** Extract tất cả src URL từ HTML content */
function extractImageUrls(html: string): string[] {
  if (!html) return [];
  const urls: string[] = [];
  const regex = /src=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    urls.push(match[1].replace(/&amp;/g, '&'));
  }
  return urls;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeText(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .trim();
}

function buildSetPrefix(maKhoi: string, maMon: string) {
  const blockMap: Record<string, string> = {
    CODING: 'COD',
    ROBOTICS: 'ROB',
    ART: 'ART',
    PROCESS: 'PRO',
    'PROCESS-ART': 'PRO',
    'PROCESS-COD': 'PRO',
    'PROCESS-ROB': 'PRO',
  };
  let blockPrefix = blockMap[maKhoi] || maKhoi.slice(0, 3).toUpperCase();
  if (maKhoi.startsWith('PROCESS-') && !blockMap[maKhoi]) {
    blockPrefix = 'PRO';
  }

  // PROCESS: dùng nội dung trong ngoặc [...] để phân biệt [Art]/[Coding]/[Robotics].
  // normalizeText() xoá ngoặc trước khi lấy prefix → 3 môn đều ra "KIE" nếu không xử lý riêng.
  if (maKhoi.startsWith('PROCESS')) {
    const bracketMatch = maMon.match(/\[([^\]]+)\]/);
    if (bracketMatch) {
      return `${blockPrefix}-${bracketMatch[1].slice(0, 3).toUpperCase()}`;
    }
  }

  const normalized = normalizeText(maMon);
  const words = normalized.split(/\s+/).filter(Boolean);
  const subjectPrefix = words.length > 0 ? words[0].slice(0, 3).toUpperCase() : 'GEN';
  return `${blockPrefix}-${subjectPrefix}`;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const examType = searchParams.get('exam_type');       // loai_ky_thi
    const blockCode = searchParams.get('block_code');     // ma_khoi
    const subjectCode = searchParams.get('subject_code'); // ma_mon
    const subjectId = searchParams.get('subject_id');     // id_mon (chuyen_sau_monhoc.id) — lọc chính xác nhất

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (id) {
      conditions.push(`bd.id = $${values.length + 1}`);
      values.push(id);
    }
    // subject_id ưu tiên hơn block_code/examType/subjectCode: truy vấn thẳng qua id_mon
    if (subjectId) {
      conditions.push(`bd.id_mon = $${values.length + 1}`);
      values.push(Number(subjectId));
    } else {
      if (examType) {
        conditions.push(`mh.loai_ky_thi = $${values.length + 1}`);
        values.push(examType);
      }
      if (blockCode) {
        conditions.push(`mh.ma_khoi = $${values.length + 1}`);
        values.push(blockCode);
      }
      if (subjectCode) {
        conditions.push(`mh.ma_mon = $${values.length + 1}`);
        values.push(subjectCode);
      }
    }

    let query = `
      SELECT
        bd.id,
        bd.id_mon                                         AS subject_id,
        mh.ma_mon                                         AS subject_code,
        mh.ma_khoi                                        AS block_code,
        mh.loai_ky_thi                                    AS exam_type,
        mh.ten_mon                                        AS subject_name,
        bd.ma_de                                          AS set_code,
        bd.ten_de                                         AS set_name,
        bd.trang_thai                                     AS status,
        bd.diem_dat                                       AS passing_score,
        bd.tong_diem                                      AS total_points,
        bd.che_do_tinh_diem                               AS scoring_mode,
        bd.trong_so_ngau_nhien                            AS random_weight,
        bd.tao_luc                                        AS created_at,
        COALESCE(qc.question_count, 0)                    AS question_count,
        chonde.id_de                                      AS default_set_id
      FROM chuyen_sau_bode bd
      JOIN chuyen_sau_monhoc mh ON mh.id = bd.id_mon
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS question_count
        FROM chuyen_sau_bode_cauhoi bc
        WHERE bc.id_de = bd.id
      ) qc ON TRUE
      LEFT JOIN LATERAL (
        SELECT ct.id_de
        FROM chuyen_sau_chonde_thang ct
        WHERE ct.id_mon = mh.id
        ORDER BY ct.nam DESC, ct.thang DESC
        LIMIT 1
      ) chonde ON TRUE
    `;

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ` ORDER BY mh.ma_khoi ASC, mh.ma_mon ASC, bd.tao_luc DESC`;

    const result = await pool.query(query, values);
    return NextResponse.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error: unknown) {
    console.error('Error fetching exam sets:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch exam sets';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const {
      exam_type,
      block_code,
      subject_code,
      subject_name,
      set_code,
      set_name,
      total_points,
      passing_score,
      min_questions_required,
      scoring_mode,
      random_weight,
      status,
      valid_from,
      valid_to,
    } = body;

    if (!set_name) {
      return NextResponse.json({ success: false, error: 'set_name is required' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Resolve subject id.
    // Ưu tiên subject_id từ client (= chuyen_sau_monhoc.id) → không cần upsert lại monhoc.
    const directSubjectId = body?.subject_id ? Number(body.subject_id) : null;
    let subjectId: number;

    if (directSubjectId && directSubjectId > 0) {
      subjectId = directSubjectId;
    } else {
      // Fallback: upsert môn học theo ma_mon (giữ backward-compat với các caller không truyền subject_id)
      if (!exam_type || !block_code || !subject_code || !subject_name) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Thiếu field bắt buộc: exam_type, block_code, subject_code, subject_name (khi không truyền subject_id)' },
          { status: 400 }
        );
      }
      const durationMinutes = exam_type === 'experience' ? 60 : 120;
      const subjectUpsert = await client.query(
        `INSERT INTO chuyen_sau_monhoc (loai_ky_thi, ma_khoi, ma_mon, ten_mon, dang_hoat_dong, thoi_gian_thi_phut, exam_duration_minutes, che_do_chon_de)
         VALUES ($1, $2, $3, $4, TRUE, $5, $5, 'mac_dinh')
         ON CONFLICT (ma_mon) DO UPDATE SET
           ten_mon               = EXCLUDED.ten_mon,
           dang_hoat_dong        = TRUE,
           ma_khoi               = EXCLUDED.ma_khoi,
           loai_ky_thi           = EXCLUDED.loai_ky_thi,
           exam_duration_minutes = EXCLUDED.exam_duration_minutes
         RETURNING id`,
        [exam_type, block_code, subject_code, subject_name, durationMinutes]
      );
      subjectId = subjectUpsert.rows[0].id;
    }

    // Tự sinh mã đề nếu không có
    let finalSetCode = (set_code || '').trim();
    if (!finalSetCode) {
      // Khi gọi qua subject_id, block_code/subject_code có thể vắng mặt → load từ DB
      let prefixBlockCode = block_code || '';
      let prefixSubjectCode = subject_code || '';
      if ((!prefixBlockCode || !prefixSubjectCode) && directSubjectId && directSubjectId > 0) {
        const subjectRow = await client.query(
          `SELECT ma_khoi, ma_mon FROM chuyen_sau_monhoc WHERE id = $1`,
          [directSubjectId]
        );
        if (subjectRow.rows.length > 0) {
          prefixBlockCode = subjectRow.rows[0].ma_khoi || prefixBlockCode;
          prefixSubjectCode = subjectRow.rows[0].ma_mon || prefixSubjectCode;
        }
      }
      const prefix = buildSetPrefix(prefixBlockCode, prefixSubjectCode);
      const nextSeqResult = await client.query(
        `SELECT COALESCE(MAX((regexp_match(ma_de, '-(\\d+)$'))[1]::int), 0) + 1 AS next_seq
         FROM chuyen_sau_bode
         WHERE id_mon = $1 AND ma_de ~ $2`,
        [subjectId, `^${prefix}-\\d+$`]
      );
      const nextSeq = Number(nextSeqResult.rows[0]?.next_seq || 1);
      finalSetCode = `${prefix}-${String(nextSeq).padStart(2, '0')}`;
    }

    const normalizedPassingScore =
      passing_score === null || passing_score === undefined
        ? null
        : Math.min(10, Math.max(0, Number(passing_score)));

    const setResult = await client.query(
      `INSERT INTO chuyen_sau_bode (
         id_mon, ma_de, ten_de, trang_thai,
         diem_dat, tong_diem, che_do_tinh_diem, trong_so_ngau_nhien
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (ma_de) DO UPDATE SET
         id_mon             = EXCLUDED.id_mon,
         ten_de             = EXCLUDED.ten_de,
         trang_thai         = EXCLUDED.trang_thai,
         diem_dat           = EXCLUDED.diem_dat,
         tong_diem          = EXCLUDED.tong_diem,
         che_do_tinh_diem   = EXCLUDED.che_do_tinh_diem,
         trong_so_ngau_nhien = EXCLUDED.trong_so_ngau_nhien
       RETURNING id, ma_de AS set_code, ten_de AS set_name, tong_diem AS total_points,
                 diem_dat AS passing_score, trang_thai AS status,
                 che_do_tinh_diem AS scoring_mode, trong_so_ngau_nhien AS random_weight,
                 tao_luc AS created_at`,
      [
        subjectId,
        finalSetCode,
        set_name,
        status || 'hoat_dong',
        normalizedPassingScore,
        Number(total_points || 10),
        scoring_mode || 'raw_10',
        Math.max(1, Number(random_weight || 1)),
      ]
    );

    await client.query('COMMIT');
    return NextResponse.json({ success: true, data: setResult.rows[0], message: 'Exam set saved successfully' });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    console.error('Error saving exam set:', error);
    const msg = error instanceof Error ? error.message : 'Failed to save exam set';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, set_name, total_points, passing_score, scoring_mode, random_weight, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof set_name === 'string') {
      updates.push(`ten_de = $${values.length + 1}`);
      values.push(set_name.trim());
    }
    if (total_points !== undefined) {
      updates.push(`tong_diem = $${values.length + 1}`);
      values.push(Number(total_points || 10));
    }
    if (passing_score !== undefined) {
      updates.push(`diem_dat = $${values.length + 1}`);
      values.push(
        passing_score === null || passing_score === ''
          ? null
          : Math.min(10, Math.max(0, Number(passing_score)))
      );
    }
    if (scoring_mode !== undefined) {
      updates.push(`che_do_tinh_diem = $${values.length + 1}`);
      values.push(scoring_mode);
    }
    if (random_weight !== undefined) {
      updates.push(`trong_so_ngau_nhien = $${values.length + 1}`);
      values.push(Math.max(1, Number(random_weight)));
    }
    if (status !== undefined) {
      if (!['active', 'inactive', 'hoat_dong', 'khong_hoat_dong'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'status không hợp lệ' },
          { status: 400 }
        );
      }
      updates.push(`trang_thai = $${values.length + 1}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE chuyen_sau_bode SET ${updates.join(', ')} WHERE id = $${values.length}
      RETURNING id, ma_de AS set_code, ten_de AS set_name, tong_diem AS total_points,
                diem_dat AS passing_score, trang_thai AS status,
                che_do_tinh_diem AS scoring_mode, trong_so_ngau_nhien AS random_weight,
                tao_luc AS created_at`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Exam set not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0], message: 'Exam set updated successfully' });
  } catch (error: unknown) {
    console.error('Error updating exam set:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update exam set';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'set id is required' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Lấy nội dung tất cả câu hỏi thuộc bộ đề để cleanup ảnh S3 sau
    const questionsResult = await client.query(
      `SELECT cq.noi_dung_cau_hoi
       FROM chuyen_sau_cauhoi cq
       JOIN chuyen_sau_bode_cauhoi bc ON bc.id_cau = cq.id
       WHERE bc.id_de = $1`,
      [id]
    );

    const deleteResult = await client.query(
      'DELETE FROM chuyen_sau_bode WHERE id = $1 RETURNING id, ma_de AS set_code, ten_de AS set_name',
      [id]
    );

    if (deleteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Không tìm thấy bộ đề để xóa' }, { status: 404 });
    }

    await client.query('COMMIT');

    // Xóa ảnh S3 của tất cả câu hỏi trong bộ đề
    questionsResult.rows.forEach(q => {
      const urls = extractImageUrls(q.noi_dung_cau_hoi || '');
      urls.forEach(url => deleteImageSilently(url));
    });

    return NextResponse.json({ success: true, message: 'Đã xóa bộ đề thành công', data: deleteResult.rows[0] });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    console.error('Error deleting exam set:', error);
    const e = error as { code?: string; message?: string };
    if (e?.code === '23503') {
      return NextResponse.json({ success: false, error: 'Bộ đề đang được sử dụng nên không thể xóa.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: e.message || 'Failed to delete exam set' }, { status: 500 });
  } finally {
    client.release();
  }
}
