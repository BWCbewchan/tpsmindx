import { requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import pool from '@/lib/db'
import { getHrCandidateSheetData } from '@/lib/hr-candidate-sheet'
import { validateHrOnboardingAccess } from '@/lib/hr-onboarding-access'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'

const REGION_MAP: Record<string, string> = { 'HCM': '1', 'HN': '2', 'DN': '3' }
const BLOCK_MAP: Record<string, string> = { 'Art': '1', 'Tech': '2', 'Biz': '3' }

export const POST = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  if (!(await validateHrOnboardingAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này.' }, { status: 403 })
  }

  try {
    // 1. Tải dữ liệu ứng viên từ Google Sheet
    const sheetData = await getHrCandidateSheetData(true)
    const { candidates } = sheetData

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        summary: { total: 0, inserted: 0, updated: 0, skipped: 0 }
      })
    }

    // 2. Mã hóa trước mật khẩu mặc định để tránh quá tải CPU
    const salt = await bcrypt.genSalt(10)
    const defaultPasswordHash = await bcrypt.hash('MindX@2024', salt)

    // 3. Nạp trước tất cả ứng viên hiện có từ cơ sở dữ liệu để so khớp bộ nhớ
    const existingRes = await pool.query(
      `SELECT id, email, gen_id, candidate_code FROM hr_candidates WHERE is_deleted = false`
    )
    const existingMap = new Map<string, { id: number; candidate_code: string | null }>()
    for (const r of existingRes.rows) {
      const key = `${r.email?.toLowerCase().trim()}_${r.gen_id || ''}`
      existingMap.set(key, { id: r.id, candidate_code: r.candidate_code })
    }

    // 4. Nạp trước danh mục GEN
    const genCatalogRes = await pool.query(`SELECT id, gen_name FROM hr_gen_catalog`)
    const genMap = new Map<string, number>()
    for (const r of genCatalogRes.rows) {
      genMap.set(r.gen_name.trim(), r.id)
    }

    // 5. Bộ đệm số thứ tự mã ứng viên
    const seqCache = new Map<string, number>()
    const getNextSequence = async (prefix: string): Promise<string> => {
      let seq = seqCache.get(prefix) ?? null
      if (seq === null) {
        const res = await pool.query(
          `SELECT MAX(CAST(RIGHT(candidate_code, 2) AS INTEGER)) as last_seq 
           FROM hr_candidates 
           WHERE candidate_code LIKE $1 || '%'`,
          [prefix]
        )
        seq = Number(res.rows[0]?.last_seq || 0)
      }
      const nextSeq = seq + 1
      seqCache.set(prefix, nextSeq)
      return nextSeq.toString().padStart(2, '0')
    }

    let inserted = 0
    let updated = 0
    let skipped = 0

    const withGenToUpsert: any[] = []
    const noGenToUpsert: any[] = []
    const uniqueEmailsInSheet = new Set<string>()

    for (const c of candidates) {
      const email = c.email?.toLowerCase().trim()
      if (!email) {
        skipped++
        continue
      }

      // Lọc mã ứng viên: nếu có mã thì kiểm tra định dạng, nếu rỗng thì cho qua (không skip)
      const candidateCodeVal = c.candidateCode?.trim() || null
      if (candidateCodeVal) {
        if (!/^\d{5,7}$/.test(candidateCodeVal)) {
          skipped++
          continue
        }
      }

      // Loại bỏ trùng lặp trong cùng một trang tính
      const sheetKey = `${email}_${c.sheetGen || ''}`
      if (uniqueEmailsInSheet.has(sheetKey)) {
        skipped++
        continue
      }
      uniqueEmailsInSheet.add(sheetKey)

      // Kiểm tra và gán nhóm GEN
      let genId: number | null = null
      if (c.sheetGen) {
        const trimmedGen = c.sheetGen.trim()
        if (genMap.has(trimmedGen)) {
          genId = genMap.get(trimmedGen)!
        } else {
          const genRes = await pool.query(
            `INSERT INTO hr_gen_catalog (gen_name, source, created_by_email, is_active)
             VALUES ($1, 'sheet', $2, true)
             ON CONFLICT (gen_name) DO UPDATE SET is_active = true
             RETURNING id`,
            [trimmedGen, auth.sessionEmail]
          )
          genId = genRes.rows[0].id
          genMap.set(trimmedGen, genId!)
        }
      }

      const regionCode = c.regionCode || '2' // mặc định HN/Miền Bắc
      const workBlock = c.workBlock || 'Tech'

      // Tìm ứng viên hiện tại
      const cacheKey = `${email}_${genId || ''}`
      const existing = existingMap.get(cacheKey)

      if (existing) {
        updated++
      } else {
        inserted++
      }

      const itemData = {
        full_name: c.name || 'Unknown',
        email,
        phone: c.phone || null,
        region_code: regionCode,
        desired_campus: c.desiredCampus || null,
        work_block: workBlock,
        subject_code: c.subjectCode || null,
        gen_id: genId,
        initial_gen_id: genId,
        current_gen_id: genId,
        candidate_code: candidateCodeVal,
        source: 'csv',
        created_by_email: auth.sessionEmail,
        status: 'new',
        birth_year: c.birthYear || null,
        facebook_url: c.facebookUrl || null,
        teaching_experience: c.teachingExperience || null,
        gender: c.gender || null,
        current_address: c.currentAddress || null,
        region_name: c.regionName || null,
      }

      if (genId !== null) {
        withGenToUpsert.push(itemData)
      } else {
        noGenToUpsert.push({ ...itemData, existingId: existing?.id || null })
      }
    }

    // 1. Phân trang ghi các ứng viên có GEN theo khối 200 bản ghi
    const CHUNK_SIZE = 200
    for (let i = 0; i < withGenToUpsert.length; i += CHUNK_SIZE) {
      const chunk = withGenToUpsert.slice(i, i + CHUNK_SIZE)
      const values: any[] = []
      const valueStrings: string[] = []
      let pIdx = 1

      for (const item of chunk) {
        valueStrings.push(
          `($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7}, $${pIdx+8}, $${pIdx+9}, $${pIdx+10}, $${pIdx+11}, $${pIdx+12}, $${pIdx+13}, $${pIdx+14}, $${pIdx+15}, $${pIdx+16}, $${pIdx+17}, $${pIdx+18}, $${pIdx+19})`
        )
        values.push(
          item.full_name,
          item.email,
          item.phone,
          item.region_code,
          item.desired_campus,
          item.work_block,
          item.subject_code,
          item.gen_id,
          item.initial_gen_id,
          item.current_gen_id,
          item.candidate_code,
          item.source,
          item.created_by_email,
          item.status,
          item.birth_year,
          item.facebook_url,
          item.teaching_experience,
          item.gender,
          item.current_address,
          item.region_name
        )
        pIdx += 20
      }

      await pool.query(
        `INSERT INTO hr_candidates (
           full_name, email, phone, region_code, desired_campus, work_block, subject_code, gen_id, initial_gen_id, current_gen_id, candidate_code, source, created_by_email, status,
           birth_year, facebook_url, teaching_experience, gender, current_address, region_name
         )
         VALUES ${valueStrings.join(', ')}
         ON CONFLICT (email, gen_id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           phone = COALESCE(EXCLUDED.phone, hr_candidates.phone),
           region_code = EXCLUDED.region_code,
           desired_campus = EXCLUDED.desired_campus,
           work_block = EXCLUDED.work_block,
           subject_code = EXCLUDED.subject_code,
           candidate_code = COALESCE(hr_candidates.candidate_code, EXCLUDED.candidate_code),
           updated_by_email = EXCLUDED.created_by_email,
           updated_at = CURRENT_TIMESTAMP,
           birth_year = EXCLUDED.birth_year,
           facebook_url = EXCLUDED.facebook_url,
           teaching_experience = EXCLUDED.teaching_experience,
           gender = EXCLUDED.gender,
           current_address = EXCLUDED.current_address,
           region_name = EXCLUDED.region_name`,
        values
      )
    }

    // 2. Xử lý các ứng viên chưa xếp GEN (gen_id IS NULL)
    for (const item of noGenToUpsert) {
      if (item.existingId) {
        await pool.query(
          `UPDATE hr_candidates
           SET full_name = $1,
               phone = COALESCE($2, phone),
               region_code = $3,
               desired_campus = $4,
               work_block = $5,
               subject_code = $6,
               candidate_code = COALESCE(candidate_code, $7),
               updated_by_email = $8,
               updated_at = CURRENT_TIMESTAMP,
               birth_year = $9,
               facebook_url = $10,
               teaching_experience = $11,
               gender = $12,
               current_address = $13,
               region_name = $14
           WHERE id = $15`,
          [
            item.full_name,
            item.phone,
            item.region_code,
            item.desired_campus,
            item.work_block,
            item.subject_code,
            item.candidate_code,
            item.created_by_email,
            item.birth_year,
            item.facebook_url,
            item.teaching_experience,
            item.gender,
            item.current_address,
            item.region_name,
            item.existingId,
          ]
        )
      } else {
        await pool.query(
          `INSERT INTO hr_candidates (
             full_name, email, phone, region_code, desired_campus, work_block, subject_code, gen_id, initial_gen_id, current_gen_id, candidate_code, source, created_by_email, status,
             birth_year, facebook_url, teaching_experience, gender, current_address, region_name
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
          [
            item.full_name,
            item.email,
            item.phone,
            item.region_code,
            item.desired_campus,
            item.work_block,
            item.subject_code,
            item.gen_id,
            item.initial_gen_id,
            item.current_gen_id,
            item.candidate_code,
            item.source,
            item.created_by_email,
            item.status,
            item.birth_year,
            item.facebook_url,
            item.teaching_experience,
            item.gender,
            item.current_address,
            item.region_name,
          ]
        )
      }
    }

    // 3. Lấy lại ID của các ứng viên để tạo tài khoản đăng nhập (chỉ tạo cho người có mã ứng viên)
    const allEmails = [...withGenToUpsert, ...noGenToUpsert].map(c => c.email)
    const matchingCandidatesRes = await pool.query(
      `SELECT id, email, gen_id, candidate_code FROM hr_candidates WHERE email = ANY($1)`,
      [allEmails]
    )
    
    const usersToInsert: { candidate_id: number; username: string; password_hash: string }[] = []
    for (const r of matchingCandidatesRes.rows) {
      if (r.candidate_code) {
        usersToInsert.push({
          candidate_id: r.id,
          username: r.candidate_code,
          password_hash: defaultPasswordHash
        })
      }
    }

    for (let i = 0; i < usersToInsert.length; i += CHUNK_SIZE) {
      const chunk = usersToInsert.slice(i, i + CHUNK_SIZE)
      const values: any[] = []
      const valueStrings: string[] = []
      let pIdx = 1

      for (const item of chunk) {
        valueStrings.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2})`)
        values.push(item.candidate_id, item.username, item.password_hash)
        pIdx += 3
      }

      await pool.query(
        `INSERT INTO hr_candidate_users (candidate_id, username, password_hash)
         VALUES ${valueStrings.join(', ')}
         ON CONFLICT (username) DO NOTHING`,
        values
      )
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: candidates.length,
        inserted,
        updated,
        skipped,
      }
    })
  } catch (error: any) {
    console.error('Lỗi khi đồng bộ ứng viên từ Google Sheet:', error)
    return NextResponse.json({ error: error.message || 'Lỗi không xác định khi đồng bộ.' }, { status: 500 })
  }
})
