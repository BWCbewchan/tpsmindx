/**
 * Utility functions cho HR Onboarding Training module.
 * Tất cả là pure functions — không có side effects, dễ test.
 */

// ─── Score calculations ───────────────────────────────────────────────────────

/**
 * Tính điểm chuyên cần: (số buổi có mặt / tổng buổi) × 10, làm tròn 2 chữ số.
 * Trả về 0 nếu total = 0.
 */
export function calculateAttendanceScore(attended: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((attended / total) * 10 * 100) / 100
}

/**
 * Tính điểm trung bình kiểm tra từ mảng điểm (bỏ qua null/undefined).
 * Trả về null nếu không có điểm nào.
 */
export function calculateAvgTestScore(scores: (number | null | undefined)[]): number | null {
  const valid = scores.filter((s): s is number => s != null && !isNaN(s))
  if (valid.length === 0) return null
  return Math.round((valid.reduce((sum, s) => sum + s, 0) / valid.length) * 100) / 100
}

/**
 * Clamp điểm về khoảng [0, 10].
 */
export function clampScore(score: number): number {
  return Math.max(0, Math.min(10, score))
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

export interface CsvCandidateRow {
  full_name: string
  email: string
  phone: string
  region_code: string
  desired_campus: string
  work_block: string
  subject_code: string
  gen_id: string
}

export interface CsvParseResult {
  valid: CsvCandidateRow[]
  skipped: Array<{ row: number; reason: string }>
}

/**
 * Parse CSV text thành danh sách ứng viên.
 * Dòng đầu tiên là header. Bỏ qua dòng thiếu full_name hoặc email.
 */
export function parseCsvCandidates(csvText: string): CsvParseResult {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return { valid: [], skipped: [] }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const idx = (name: string) => headers.indexOf(name)

  const fullNameIdx = idx('full_name') >= 0 ? idx('full_name') : idx('họ tên') >= 0 ? idx('họ tên') : idx('ho ten')
  const emailIdx = idx('email')
  const phoneIdx = idx('phone') >= 0 ? idx('phone') : idx('sdt') >= 0 ? idx('sdt') : idx('so dien thoai')
  const regionIdx = idx('region_code') >= 0 ? idx('region_code') : idx('khu vuc')
  const campusIdx = idx('desired_campus') >= 0 ? idx('desired_campus') : idx('co so')
  const workBlockIdx = idx('work_block') >= 0 ? idx('work_block') : idx('khoi')
  const subjectIdx = idx('subject_code') >= 0 ? idx('subject_code') : idx('ma mon')
  const genIdx = idx('gen_id') >= 0 ? idx('gen_id') : idx('gen')

  const valid: CsvCandidateRow[] = []
  const skipped: Array<{ row: number; reason: string }> = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cells = parseCsvLine(line)
    const full_name = fullNameIdx >= 0 ? (cells[fullNameIdx] || '').trim() : ''
    const email = emailIdx >= 0 ? (cells[emailIdx] || '').trim().toLowerCase() : ''

    if (!full_name && !email) continue // bỏ qua dòng trống hoàn toàn

    const reasons: string[] = []
    if (!full_name) reasons.push('Thiếu họ tên')
    if (!email) reasons.push('Thiếu email')

    if (reasons.length > 0) {
      skipped.push({ row: i + 1, reason: reasons.join(', ') })
      continue
    }

    valid.push({
      full_name,
      email,
      phone: phoneIdx >= 0 ? (cells[phoneIdx] || '').trim() : '',
      region_code: regionIdx >= 0 ? (cells[regionIdx] || '').trim() : '',
      desired_campus: campusIdx >= 0 ? (cells[campusIdx] || '').trim() : '',
      work_block: workBlockIdx >= 0 ? (cells[workBlockIdx] || '').trim() : '',
      subject_code: subjectIdx >= 0 ? (cells[subjectIdx] || '').trim() : '',
      gen_id: genIdx >= 0 ? (cells[genIdx] || '').trim() : '',
    })
  }

  return { valid, skipped }
}

/** Parse một dòng CSV có hỗ trợ quoted fields. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

// ─── Candidate → Teacher mapping ─────────────────────────────────────────────

export interface CandidateForPromotion {
  full_name: string
  email: string
  desired_campus: string | null
  work_block: string | null
  subject_code: string | null
}

export interface TeacherInsertData {
  code: string
  full_name: string
  work_email: string
  main_centre: string | null
  course_line: string | null
  status: 'Active'
  source: 'hr_onboarding'
}

/**
 * Map thông tin ứng viên sang record teachers khi promote.
 * code = phần trước @ của email.
 */
export function mapCandidateToTeacher(candidate: CandidateForPromotion): TeacherInsertData {
  return {
    code: candidate.email.split('@')[0] || candidate.email,
    full_name: candidate.full_name,
    work_email: candidate.email,
    main_centre: candidate.desired_campus || null,
    course_line: candidate.subject_code || null,
    status: 'Active',
    source: 'hr_onboarding',
  }
}
