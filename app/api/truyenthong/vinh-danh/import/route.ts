import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { parseCsvLine } from '@/lib/csv-registration-import'
import { createSupabaseS3Client, isSupabaseS3Configured, parsePublicUrl, deleteObject } from '@/lib/supabase-s3'
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const BUCKET_NAME = 'mindx-avatars'  // dùng chung bucket avatar giáo viên
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
// Prefix đặc biệt để nhận diện ảnh vinh danh — KHÔNG dùng cho avatar thường
const HONORS_KEY_PREFIX = 'honors-monthly/'

export const dynamic = 'force-dynamic'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

async function ensureBucket() {
  const client = createSupabaseS3Client()
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }))
  }
}

function makeProxyUrl(bucket: string, key: string): string {
  return `/api/storage-image?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`
}

/** Xóa ảnh vinh danh cũ trên S3 nếu URL thuộc prefix honors-monthly/ */
async function deleteHonorsAvatarIfOwned(avatarUrl: string | null): Promise<void> {
  if (!avatarUrl || !isSupabaseS3Configured()) return
  try {
    const parsed = parsePublicUrl(avatarUrl)
    if (!parsed) return
    // Chỉ xóa nếu là ảnh vinh danh trong bucket avatar, không đụng thumbnail bài viết/avatar cá nhân
    if (parsed.bucket !== BUCKET_NAME || !parsed.key.startsWith(HONORS_KEY_PREFIX)) return
    await deleteObject(parsed.bucket, parsed.key)
  } catch (e) {
    console.warn('⚠️ Không xóa được ảnh vinh danh cũ:', e)
  }
}

// ─── Header Map ───────────────────────────────────────────────────────────────
// Map tên cột (lowercase, trimmed) → tên nội bộ
const HEADER_MAP: Record<string, string> = {
  // STT
  'stt': 'stt',
  'số thứ tự': 'stt',
  // Tên
  'tên': 'full_name',
  'họ và tên': 'full_name',
  'họ tên': 'full_name',
  'giảng viên': 'full_name',
  'name': 'full_name',
  // Email
  'email': 'email',
  // Khối dạy
  'khối dạy': 'khoi_day',
  'khoi day': 'khoi_day',
  // Cơ sở
  'cơ sở': 'co_so',
  'co so': 'co_so',
  'cơ sở làm việc': 'co_so',
  // Tháng
  'tháng': 'thang',
  'thang': 'thang',
  'month': 'thang',
  // Số case
  'số case': 'so_case',
  'so case': 'so_case',
  // Số học sinh
  'số học sinh': 'so_hoc_sinh',
  'so hoc sinh': 'so_hoc_sinh',
  // Tỉ lệ / CR45
  'tỉ lệ': 'ti_le',
  'ti le': 'ti_le',
  'tỷ lệ': 'ti_le',
  'tyle': 'ti_le',
  'cr45': 'ti_le',
  'cr 45': 'ti_le',
  'chỉ số cr45': 'ti_le',
  'chi so cr45': 'ti_le',
  // Loại
  'loại': 'loai',
  'loai': 'loai',
  'loại/chọn': 'loai',
  // Thưởng
  'thưởng cr': 'thuong_cr',
  'thuong cr': 'thuong_cr',
  'bonus cr': 'thuong_cr',
  'thưởng': 'thuong_cr',
}

function normalizeKey(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, ' ')
}

// ─── Multi-header parser ──────────────────────────────────────────────────────
// Hỗ trợ file có 2 dòng header (dòng 1: nhóm, dòng 2: tên cột thực)
// Tự động phát hiện dòng header thực bằng cách tìm dòng chứa nhiều field đã biết nhất

function detectHeaderRow(lines: string[]): { headerIdx: number; headers: string[] } {
  let bestIdx = 0
  let bestScore = -1

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cells = parseCsvLine(line).map(h => h.replace(/^\uFEFF/, '').trim())
    // Đếm số cell khớp với HEADER_MAP
    const score = cells.filter(c => HEADER_MAP[normalizeKey(c)] !== undefined).length
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
      // Nếu dòng này là hàng có STT empty + Giảng viên, ưu tiên nó
    }
  }

  const headers = parseCsvLine(lines[bestIdx])
    .map(h => h.replace(/^\uFEFF/, '').trim())

  return { headerIdx: bestIdx, headers }
}

// ─── Number parsers ───────────────────────────────────────────────────────────

function parsePercent(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  // "85,00%" → 85.00   hoặc "85.00%" → 85.00
  const s = String(v)
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.')   // dấu phẩy thập phân kiểu VN
    .trim()
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function parseMoney(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  // "1,500,000 ₫" → 1500000
  const s = String(v)
    .replace(/[₫đ\s]/gi, '')
    .replace(/\./g, '')   // dấu chấm ngàn
    .replace(/,/g, '')    // dấu phẩy ngàn
    .trim()
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const s = String(v).replace(/,/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const importedBy = (formData.get('imported_by') as string) || 'admin'

    if (!file) {
      return jsonNoStore({ success: false, error: 'Thiếu file CSV' }, { status: 400 })
    }

    const text = await file.text()
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = normalized.split('\n').filter(l => l.trim().length > 0)

    if (lines.length < 2) {
      return jsonNoStore({ success: false, error: 'File cần có ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.' }, { status: 400 })
    }

    // Tự phát hiện dòng header
    const { headerIdx, headers } = detectHeaderRow(lines)

    // Map header index → tên nội bộ
    const colMap: Record<number, string> = {}
    headers.forEach((h, i) => {
      const key = HEADER_MAP[normalizeKey(h)]
      if (key) colMap[i] = key
    })

    // Parse các dòng dữ liệu (bỏ tất cả dòng <= headerIdx)
    const dataLines = lines.slice(headerIdx + 1)
    const rows: Record<string, string>[] = []
    for (const line of dataLines) {
      if (!line.trim() || line.startsWith('#')) continue
      const cells = parseCsvLine(line)
      const row: Record<string, string> = {}
      Object.entries(colMap).forEach(([idxStr, fieldName]) => {
        row[fieldName] = (cells[Number(idxStr)] ?? '').trim()
      })
      if (row.full_name) rows.push(row)
    }

    if (!rows.length) {
      return jsonNoStore({
        success: false,
        error: 'Không tìm thấy dữ liệu hợp lệ. Kiểm tra lại tên cột CSV (cần có cột "Giảng viên" hoặc "Tên").'
      }, { status: 400 })
    }

    const thangFromForm = (formData.get('thang') as string) || ''

    // ─── Upload top 3 images ──────────────────────────────────────────────────
    // topImages[i] = url, key = rank index (1,2,3) = thứ tự trong danh sách rows
    const topImages: Record<number, string> = {}

    for (let i = 1; i <= 3; i++) {
      const imageFile = formData.get(`top${i}Image`)
      if (!imageFile || typeof imageFile === 'string') continue
      if (!imageFile.type.startsWith('image/')) continue
      if (imageFile.size > MAX_IMAGE_BYTES) continue

      if (isSupabaseS3Configured()) {
        // Upload lên Supabase S3
        try {
          await ensureBucket()
          const s3 = createSupabaseS3Client()
          const buffer = Buffer.from(await imageFile.arrayBuffer())
          const ext = imageFile.name.includes('.') ? imageFile.name.split('.').pop() : 'jpg'
          const key = `${HONORS_KEY_PREFIX}top${i}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          await s3.send(new PutObjectCommand({
            Bucket: BUCKET_NAME, Key: key,
            Body: buffer, ContentType: imageFile.type || 'image/jpeg',
          }))
          topImages[i] = makeProxyUrl(BUCKET_NAME, key)
          console.log(`✅ Uploaded top${i} avatar to S3: ${key}`)
        } catch (e) {
          console.error(`❌ S3 upload top${i} failed:`, e)
          // Fallback base64 nếu S3 lỗi
          try {
            const buffer = Buffer.from(await imageFile.arrayBuffer())
            topImages[i] = `data:${imageFile.type};base64,${buffer.toString('base64')}`
            console.warn(`⚠️ top${i}: dùng base64 fallback do S3 lỗi`)
          } catch {}
        }
      } else {
        // S3 chưa cấu hình → base64
        try {
          const buffer = Buffer.from(await imageFile.arrayBuffer())
          topImages[i] = `data:${imageFile.type};base64,${buffer.toString('base64')}`
        } catch (e) {
          console.error(`Base64 encode top${i} failed:`, e)
        }
      }
    }

    const client = await pool.connect()
    try {
      // Migrate: thêm cột honors_avatar_url nếu chưa có
      await client.query(`
        ALTER TABLE teacher_monthly_honors ADD COLUMN IF NOT EXISTS honors_avatar_url TEXT;
        ALTER TABLE teacher_monthly_honors ADD COLUMN IF NOT EXISTS slogan VARCHAR(255);
      `)

      const selectedRows = new Map<number, {
        row: Record<string, string>
        sourceIndex: number
        rankIndex: number
      }>()

      rows.forEach((row, sourceIndex) => {
        const explicitRank = parseInt(row.stt || '0', 10)
        if (explicitRank >= 1 && explicitRank <= 3 && !selectedRows.has(explicitRank)) {
          selectedRows.set(explicitRank, { row, sourceIndex, rankIndex: explicitRank })
        }
      })

      const usedSourceIndexes = new Set([...selectedRows.values()].map(item => item.sourceIndex))
      const missingRanks = [1, 2, 3].filter(rank => !selectedRows.has(rank))
      for (let sourceIndex = 0; sourceIndex < rows.length && missingRanks.length > 0; sourceIndex++) {
        if (usedSourceIndexes.has(sourceIndex)) continue
        const rankIndex = missingRanks.shift()
        if (!rankIndex) break
        selectedRows.set(rankIndex, { row: rows[sourceIndex], sourceIndex, rankIndex })
      }

      const importRows = [1, 2, 3]
        .map(rank => selectedRows.get(rank))
        .filter((item): item is { row: Record<string, string>; sourceIndex: number; rankIndex: number } => Boolean(item))

      if (importRows.length < 3) {
        await Promise.allSettled(Object.values(topImages).map(url => deleteHonorsAvatarIfOwned(url)))
        return jsonNoStore({
          success: false,
          error: `File cần có đủ 3 giáo viên Top 1/2/3. Hiện chỉ tìm thấy ${importRows.length} dòng hợp lệ.`,
        }, { status: 400 })
      }

      const targetMonth = (thangFromForm || importRows[0].row.thang || '').trim()
      if (!targetMonth) {
        await Promise.allSettled(Object.values(topImages).map(url => deleteHonorsAvatarIfOwned(url)))
        return jsonNoStore({
          success: false,
          error: 'Thiếu tháng. Vui lòng nhập tháng trong popup hoặc thêm cột Tháng trong CSV.',
        }, { status: 400 })
      }

      if (!thangFromForm) {
        const mixedMonth = importRows.find(({ row }) => (row.thang || '').trim() !== targetMonth)
        if (mixedMonth) {
          await Promise.allSettled(Object.values(topImages).map(url => deleteHonorsAvatarIfOwned(url)))
          return jsonNoStore({
            success: false,
            error: '3 giáo viên Top 1/2/3 cần cùng một tháng. Vui lòng kiểm tra lại cột Tháng trong CSV.',
          }, { status: 400 })
        }
      }

      let insertedCount = 0
      const preview: Record<string, unknown>[] = []
      let deletedCount = 0
      const oldHonorsAvatarRows = await client.query(
        `SELECT honors_avatar_url
         FROM teacher_monthly_honors
         WHERE thang = $1 AND honors_avatar_url IS NOT NULL`,
        [targetMonth]
      )
      const oldHonorsAvatarUrls = oldHonorsAvatarRows.rows
        .map((row: { honors_avatar_url: string | null }) => row.honors_avatar_url)
        .filter((url: string | null): url is string => Boolean(url))

      await client.query('BEGIN')
      try {
        const deleteRes = await client.query(
          `DELETE FROM teacher_monthly_honors WHERE thang = $1`,
          [targetMonth]
        )
        deletedCount = deleteRes.rowCount || 0

        for (const { row, rankIndex } of importRows) {
          const email = (row.email || '').trim().toLowerCase()

          // Liên kết vinh danh với giáo viên bằng định danh chắc chắn. Ưu tiên email;
          // chỉ dùng họ tên khi có đúng một giáo viên khớp tuyệt đối.
          const teacherMatch = await client.query(
            `WITH matches AS (
               SELECT code,
                      CASE
                        WHEN $1 <> '' AND (
                          LOWER(TRIM(COALESCE(work_email, ''))) = $1
                          OR LOWER(TRIM(COALESCE("Work email", ''))) = $1
                          OR LOWER(TRIM(COALESCE(personal_email, ''))) = $1
                        ) THEN 0
                        ELSE 1
                      END AS priority
               FROM teachers
               WHERE (
                 $1 <> '' AND (
                   LOWER(TRIM(COALESCE(work_email, ''))) = $1
                   OR LOWER(TRIM(COALESCE("Work email", ''))) = $1
                   OR LOWER(TRIM(COALESCE(personal_email, ''))) = $1
                 )
               )
               OR LOWER(COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(TRIM("Full name"), ''), '')) = LOWER(TRIM($2))
             ), ranked AS (
               SELECT code, priority, COUNT(*) OVER (PARTITION BY priority) AS same_priority_count
               FROM matches
             )
             SELECT code
             FROM ranked
             WHERE same_priority_count = 1
             ORDER BY priority
             LIMIT 1`,
            [email, row.full_name || ''],
          )
          const teacherCode = teacherMatch.rows[0]?.code || null

          // ── honors_avatar_url: chỉ lưu ảnh do admin upload riêng cho vinh danh ──
          const honorsAvatarUrl: string | null = topImages[rankIndex] || null

          // ── avatar_url hiển thị: ưu tiên ảnh vinh danh mới upload, fallback avatar cá nhân ──
          let displayAvatarUrl: string | null = honorsAvatarUrl

          if (!displayAvatarUrl && email) {
            try {
              const avatarRes = await client.query(
                `SELECT avatar_url FROM teacher_avatars WHERE LOWER(teacher_email) = $1 LIMIT 1`,
                [email]
              )
              displayAvatarUrl = avatarRes.rows[0]?.avatar_url || null
            } catch { /* skip */ }

            if (!displayAvatarUrl) {
              try {
                await client.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT`)
                const userRes = await client.query(
                  `SELECT avatar_url FROM app_users WHERE LOWER(email) = $1 LIMIT 1`,
                  [email]
                )
                displayAvatarUrl = userRes.rows[0]?.avatar_url || null
              } catch { /* skip */ }
            }
          }

          // KHÔNG ghi đè teacher_avatars — ảnh vinh danh chỉ thuộc về teacher_monthly_honors

          // Parse số liệu với format VN
          const tiLe = parsePercent(row.ti_le)
          const thuongCr = parseMoney(row.thuong_cr)
          const soCase = parseNum(row.so_case)
          const soHocSinh = parseNum(row.so_hoc_sinh)

          await client.query(
            `INSERT INTO teacher_monthly_honors
              (stt, full_name, email, khoi_day, co_so, thang, so_case, so_hoc_sinh, ti_le, loai, thuong_cr,
               avatar_url, honors_avatar_url, imported_by, teacher_code)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [rankIndex, row.full_name, email || null, row.khoi_day || null, row.co_so || null,
             targetMonth, soCase, soHocSinh, tiLe, row.loai || null, thuongCr,
             displayAvatarUrl, honorsAvatarUrl, importedBy, teacherCode]
          )

          insertedCount++
          preview.push({
            stt: rankIndex, full_name: row.full_name, co_so: row.co_so,
            thang: targetMonth, ti_le: tiLe, rank_index: rankIndex,
            avatar_url: displayAvatarUrl,
            honors_avatar_url: honorsAvatarUrl,
          })
        }

        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        await Promise.allSettled(Object.values(topImages).map(url => deleteHonorsAvatarIfOwned(url)))
        throw err
      }

      await Promise.allSettled(oldHonorsAvatarUrls.map(url => deleteHonorsAvatarIfOwned(url)))

      return jsonNoStore({
        success: true,
        inserted: insertedCount,
        total: importRows.length,
        source_total: rows.length,
        deleted: deletedCount,
        current_month: targetMonth,
        errors: [],
        preview,
      })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Import honors error:', err)
    return jsonNoStore({
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi server'
    }, { status: 500 })
  }
}
