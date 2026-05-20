/**
 * /api/explanations
 *
 * HoĂ n toĂ n dĂ¹ng báº£ng má»›i, khĂ´ng cĂ²n báº£ng explanations cÅ©:
 *   - chuyen_sau_giaitrinh  â†’ Ä‘Æ¡n giáº£i trĂ¬nh
 *       noi_dung_giai_thich : lĂ½ do giáº£i trĂ¬nh (reason)
 *       html_giai_thich     : pháº£n há»“i admin (admin_note)
 *       status              : pending / accepted / rejected
 *       id_ket_qua          : FK â†’ chuyen_sau_results.id
 *       admin_name          : tĂªn ngÆ°á»i xá»­ lĂ½
 *       reviewer_email      : email ngÆ°á»i xá»­ lĂ½
 *
 *   - chuyen_sau_results    â†’ káº¿t quáº£ Ä‘Äƒng kĂ½ thi
 *       ho_ten              : teacher_name
 *       ma_giao_vien        : lms_code
 *       dia_chi_email       : email
 *       co_so_lam_viec      : campus
 *       id_mon              : FK â†’ chuyen_sau_monhoc.id
 *       thoi_gian_kiem_tra  : test_date
 *       xu_ly_diem          : 'chá» giáº£i trĂ¬nh' | 'Ä‘Ă£ hoĂ n thĂ nh'
 *       email_giai_trinh    : email của giáo viên gửi giải trình (set khi POST, không thay đổi khi admin duyệt)
 *       da_giai_thich       : Ä‘Ă£ tá»«ng giáº£i trĂ¬nh
 *       so_lan_giai_thich   : sá»‘ láº§n giáº£i trĂ¬nh
 *
 * xu_ly_diem chá»‰ cĂ³ 2 tráº¡ng thĂ¡i:
 *   - 'chá» giáº£i trĂ¬nh'  : Ä‘Äƒng kĂ½ / Ä‘ang thi / háº¿t giá» chÆ°a ná»™p
 *   - 'Ä‘Ă£ hoĂ n thĂ nh'   : Ä‘Ă£ ná»™p bĂ i
 * Tráº¡ng thĂ¡i giáº£i trĂ¬nh Ä‘Æ°á»£c theo dĂµi qua chuyen_sau_giaitrinh.status.
 */

import {
  rejectIfChuyenSauResultNotOwned,
  rejectIfEmailNotSelf,
  requireBearerSession,
} from '@/lib/datasource-api-auth'
import { isResultEligibleForGiaiTrinhThisMonth } from '@/lib/giaitrinh-eligibility'
import pool from '@/lib/db'
import { eventScheduleTsInstantExpr } from '@/lib/event-schedule-time'
import { NextRequest, NextResponse } from 'next/server'

// â”€â”€â”€ GET â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Query params: email, status, result_id

export async function GET(request: NextRequest) {
  let client

  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const status = searchParams.get('status')
    const resultId = searchParams.get('result_id')

    if (!auth.privileged && !email && !resultId) {
      return NextResponse.json(
        { success: false, error: 'Cần email hoặc result_id' },
        { status: 400 },
      )
    }
    if (email) {
      const denied = rejectIfEmailNotSelf(auth.sessionEmail, auth.privileged, email)
      if (denied) return denied
    }
    if (resultId) {
      const denied = await rejectIfChuyenSauResultNotOwned(
        auth.sessionEmail,
        auth.privileged,
        resultId,
      )
      if (denied) return denied
    }

    const conditions: string[] = []
    const values: unknown[] = []

    if (email) {
      values.push(email)
      conditions.push(
        `LOWER(TRIM(COALESCE(r.dia_chi_email, ''))) = LOWER(TRIM($${values.length}))`,
      )
    }
    if (status) {
      if (status === 'accepted') {
        conditions.push(`g.xu_ly_giai_trinh = 'đã duyệt'`)
      } else if (status === 'rejected') {
        conditions.push(`g.xu_ly_giai_trinh = 'từ chối'`)
      } else {
        conditions.push(
          `COALESCE(g.xu_ly_giai_trinh, 'chờ giải trình') NOT IN ('đã duyệt', 'từ chối')`,
        )
      }
    }
    if (resultId) {
      values.push(resultId)
      conditions.push(`g.id_ket_qua = $${values.length}`)
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    client = await pool.connect()

    const result = await client.query(
      `SELECT
         g.id,
         g.id_ket_qua                                              AS result_id,
         COALESCE(r.ho_ten, '')                                    AS teacher_name,
         COALESCE(r.ma_giao_vien, '')                              AS lms_code,
         COALESCE(r.dia_chi_email, '')                             AS email,
         COALESCE(r.co_so_lam_viec, '')                           AS campus,
         COALESCE(mh.ten_mon, mh.ma_mon, r.id_mon::text, '')       AS subject,
         COALESCE(
           es.bat_dau_luc AT TIME ZONE 'Asia/Ho_Chi_Minh',
           CASE
             WHEN COALESCE(r.thoi_gian_kiem_tra, '') ~ '^[0-9]{1,2}:[0-9]{2} [0-9]{2}/[0-9]{2}/[0-9]{4}$'
               THEN to_timestamp(r.thoi_gian_kiem_tra, 'HH24:MI DD/MM/YYYY')
             ELSE NULL
           END,
           make_timestamp(COALESCE(r.nam_dk, EXTRACT(YEAR FROM NOW())::int),
                         COALESCE(r.thang_dk, EXTRACT(MONTH FROM NOW())::int), 1, 0, 0, 0)
         )                                                           AS test_date,
         COALESCE(g.noi_dung_giai_thich, '')                       AS reason,
         CASE g.xu_ly_giai_trinh
           WHEN 'đã duyệt'   THEN 'accepted'
           WHEN 'từ chối'    THEN 'rejected'
           ELSE 'pending'
         END                                                        AS status,
         g.html_giai_thich                                          AS admin_note,
         g.tao_luc                                                  AS created_at
       FROM chuyen_sau_giaitrinh g
       JOIN chuyen_sau_results r ON r.id = g.id_ket_qua
       LEFT JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       LEFT JOIN event_schedules es ON es.id::text = r.id_su_kien::text
       ${where}
       ORDER BY g.tao_luc DESC`,
      values,
    )

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    })
  } catch (error: any) {
    console.error('GET /api/explanations error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    )
  } finally {
    client?.release()
  }
}

// â”€â”€â”€ POST: User ná»™p giáº£i trĂ¬nh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Body: result_id (hoáº·c assignment_id), lms_code, email, reason
//       CĂ¡c trÆ°á»ng teacher_name, campus, subject, test_date khĂ´ng cáº§n gá»­i â€”
//       Ä‘Ă£ cĂ³ sáºµn trong chuyen_sau_results.

export async function POST(request: Request) {
  let client

  try {
    const body = await request.json()
    const {
      result_id,
      assignment_id, // backward compat â€” frontend váº«n gá»­i field nĂ y
      lms_code,
      email,
      reason,
    } = body

    const resolvedResultId = Number(result_id || assignment_id || 0) || null

    if (!reason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập nội dung giải trình' },
        { status: 400 },
      )
    }
    if (!resolvedResultId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Không xác định được kết quả thi cần giải trình',
        },
        { status: 400 },
      )
    }

    client = await pool.connect()
    await client.query('BEGIN')

    // 1. Kiểm tra result tồn tại; điểm = 0; kỳ thi thuộc tháng hiện tại (VN)
    const resultRow = await client.query(
      `SELECT r.id, r.diem, r.xu_ly_diem, r.ma_giao_vien, r.dia_chi_email,
              r.thang_dk, r.nam_dk, r.lich_thi_dk,
              ${eventScheduleTsInstantExpr('es', 'bat_dau_luc')} AS schedule_open
       FROM chuyen_sau_results r
       LEFT JOIN event_schedules es ON es.id::text = r.id_su_kien::text
       WHERE r.id = $1
       LIMIT 1`,
      [resolvedResultId],
    )

    if (!resultRow.rows.length) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy kết quả thi' },
        { status: 404 },
      )
    }

    const record = resultRow.rows[0]
    if (Number(record.diem ?? 0) > 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Chỉ được gửi giải trình khi điểm bằng 0' },
        { status: 400 },
      )
    }

    if (
      !isResultEligibleForGiaiTrinhThisMonth({
        thang_dk: record.thang_dk != null ? Number(record.thang_dk) : null,
        nam_dk: record.nam_dk != null ? Number(record.nam_dk) : null,
        lich_thi_dk: record.lich_thi_dk ?? null,
        schedule_open: record.schedule_open ?? null,
      })
    ) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        {
          success: false,
          error:
            'Chỉ được gửi giải trình trong tháng hiện tại (theo giờ Việt Nam). Các tháng khác không chấp nhận.',
        },
        { status: 403 },
      )
    }

    // 2. Kiá»ƒm tra khĂ´ng cho giáº£i trĂ¬nh láº¡i khi Ä‘Ă£ Ä‘Æ°á»£c cháº¥p nháº­n
    const existingGT = await client.query(
      `SELECT id, xu_ly_giai_trinh FROM chuyen_sau_giaitrinh WHERE id_ket_qua = $1 LIMIT 1`,
      [resolvedResultId],
    )

    if (
      existingGT.rows.length > 0 &&
      existingGT.rows[0].xu_ly_giai_trinh === 'đã duyệt'
    ) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Giải trình này đã được chấp nhận' },
        { status: 409 },
      )
    }

    const resolvedTeacherCode = (lms_code || record.ma_giao_vien || '')
      .toString()
      .trim()
    const resolvedEmail = (email || record.dia_chi_email || '')
      .toString()
      .trim()
    const trimmedReason = reason.trim()

    // 3. INSERT má»›i hoáº·c reset láº¡i náº¿u Ä‘Ă£ cĂ³ giáº£i trĂ¬nh cÅ© (rejected / pending)
    let gtResult
    if (existingGT.rows.length > 0) {
      gtResult = await client.query(
        `UPDATE chuyen_sau_giaitrinh
         SET noi_dung_giai_thich = $2,
             xu_ly_giai_trinh    = 'chờ giải trình',
             html_giai_thich     = NULL
         WHERE id_ket_qua = $1
         RETURNING *`,
        [resolvedResultId, trimmedReason],
      )
    } else {
      gtResult = await client.query(
        `INSERT INTO chuyen_sau_giaitrinh
           (id_ket_qua, noi_dung_giai_thich, xu_ly_giai_trinh, tao_luc)
         VALUES ($1, $2, 'chờ giải trình', NOW())
         RETURNING *`,
        [resolvedResultId, trimmedReason],
      )
    }

    // 4. ÄĂ¡nh dáº¥u Ä‘Ă£ giáº£i trĂ¬nh trong chuyen_sau_results
    await client.query(
      `UPDATE chuyen_sau_results
       SET da_giai_thich     = TRUE,
           so_lan_giai_thich = COALESCE(so_lan_giai_thich, 0) + 1,
           email_giai_trinh  = COALESCE($2, email_giai_trinh)
       WHERE id = $1`,
      [resolvedResultId, resolvedEmail || null],
    )

    await client.query('COMMIT')

    // Mail giải trình kiểm tra chuyên sâu đã tắt — chỉ còn luồng mail xin nghỉ (/api/emails).
    const emailNotSent = true

    return NextResponse.json(
      {
        success: true,
        message: 'Gửi giải trình thành công',
        data: gtResult.rows[0],
        emailNotSent,
      },
      { status: 201 },
    )
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => {})
    console.error('POST /api/explanations error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    )
  } finally {
    client?.release()
  }
}

// â”€â”€â”€ PATCH: Admin phĂª duyá»‡t / tá»« chá»‘i â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Body: id (chuyen_sau_giaitrinh.id), status, admin_note, admin_email, admin_name

export async function PATCH(request: Request) {
  let client

  try {
    const body = await request.json()
    const {
      id,
      status,
      admin_note,
      admin_email,
      admin_name,
      tong_diem_bi_tru,
    } = body

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc (id, status)' },
        { status: 400 },
      )
    }
    if (!['accepted', 'rejected'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Trạng thái không hợp lệ - chỉ chấp nhận: accepted, rejected',
        },
        { status: 400 },
      )
    }

    const statusDbValue = status === 'accepted' ? 'đã duyệt' : 'từ chối'

    client = await pool.connect()
    await client.query('BEGIN')

    // 1. Cập nhật chuyen_sau_giaitrinh
    const gtResult = await client.query(
      `UPDATE chuyen_sau_giaitrinh
       SET xu_ly_giai_trinh = $2,
           html_giai_thich  = $3
       WHERE id = $1
       RETURNING *, id_ket_qua`,
      [id, statusDbValue, admin_note || null],
    )

    if (!gtResult.rows.length) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy giải trình' },
        { status: 404 },
      )
    }

    const ketQuaId = gtResult.rows[0].id_ket_qua

    // 2. Update chuyen_sau_results based on admin decision
    if (ketQuaId) {
      await client.query(
        `UPDATE chuyen_sau_results
         SET cau_dung        = NULL,
             diem            = NULL,
             xu_ly_diem      = $2,
             tong_diem_bi_tru = $3
         WHERE id = $1`,
        [
          ketQuaId,
          statusDbValue,
          status === 'accepted' ? null : (tong_diem_bi_tru ?? null),
        ],
      )
    }

    await client.query('COMMIT')

    // Mail giải trình kiểm tra chuyên sâu đã tắt — chỉ còn luồng mail xin nghỉ (/api/emails).
    const emailNotSent = true

    return NextResponse.json({
      success: true,
      message:
        status === 'accepted'
          ? 'Đã chấp nhận giải trình'
          : 'Đã từ chối giải trình',
      data: gtResult.rows[0],
      emailNotSent,
    })
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => {})
    console.error('PATCH /api/explanations error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    )
  } finally {
    client?.release()
  }
}
