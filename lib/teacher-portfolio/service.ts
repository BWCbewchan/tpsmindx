import 'server-only'

import { randomBytes } from 'crypto'
import type { PoolClient } from 'pg'

import { getTeacherCheckCong } from '@/lib/check-cong-service'
import pool from '@/lib/db'
import {
  findTeacherForPortfolioSession,
  resolveTeacherPortfolioAccess,
  type TeacherPortfolioOwnerRow,
} from './access'
import type {
  TeacherPortfolioAchievement,
  TeacherPortfolioDemoSection,
  TeacherPortfolioDto,
  TeacherPortfolioProvenance,
  TeacherPortfolioUpdateInput,
  TeacherPortfolioVerificationStatus,
} from './types'
import { TeacherPortfolioValidationError } from './validation'

const SELF_REPORTED: TeacherPortfolioProvenance = {
  kind: 'self_reported',
  label: 'GV tự cập nhật',
}
const TPS_SYNCED: TeacherPortfolioProvenance = {
  kind: 'tps_synced',
  label: 'Dữ liệu TPS',
}
const DEMO_TEACHER_CODES = new Set(
  (process.env.TEACHER_PORTFOLIO_DEMO_CODES || 'daitk')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
)

type PortfolioRow = {
  id: string | number
  teacher_code: string
  public_slug: string
  status: 'published' | 'revoked'
  created_at: unknown
  updated_at: unknown
}

export type TeacherPortfolioShareResult =
  | { status: 'ok'; data: TeacherPortfolioDto }
  | { status: 'not_found' }
  | { status: 'forbidden' }

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function nullableText(value: unknown): string | null {
  const valueText = text(value)
  return valueText || null
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function integer(value: unknown): number {
  const number = Number(value)
  return Number.isInteger(number) ? number : 0
}

function isoDate(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const valueText = text(value)
  return valueText ? valueText.slice(0, 10) : null
}

function isoTimestamp(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ''))
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString()
}

function normalize(value: unknown): string {
  return text(value).toLowerCase()
}

function splitValues(value: unknown): string[] {
  return Array.from(
    new Set(
      text(value)
        .split(/[\n,;|]+/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function profileEmail(teacher: Record<string, unknown>): string {
  return text(teacher.work_email || teacher['Work email'])
}

function teacherName(teacher: Record<string, unknown>): string {
  return text(teacher.full_name || teacher['Full name']) || 'Giáo viên MindX'
}

function teacherCenter(teacher: Record<string, unknown>): string | null {
  return nullableText(
    teacher.main_centre || teacher['Main centre'] || teacher.centers || teacher.center,
  )
}

function slugBase(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  return normalized || 'giao-vien'
}

async function waitForMigrations() {
  if (global.migrationInitPromise) {
    await global.migrationInitPromise.catch(() => undefined)
  }
}

async function ensurePortfolio(
  client: PoolClient,
  teacher: TeacherPortfolioOwnerRow,
): Promise<PortfolioRow> {
  const code = text(teacher.code)
  const email = profileEmail(teacher)
  const base = slugBase(teacherName(teacher))

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = `${base}-${randomBytes(12).toString('hex')}`
    try {
      const result = await client.query(
        `INSERT INTO teacher_portfolios (
           teacher_code, teacher_email_snapshot, public_slug, status
         ) VALUES ($1, $2, $3, 'published')
         ON CONFLICT (teacher_code) DO UPDATE SET
           teacher_email_snapshot = EXCLUDED.teacher_email_snapshot
         RETURNING id, teacher_code, public_slug, status, created_at, updated_at`,
        [code, email || null, slug],
      )
      return result.rows[0] as PortfolioRow
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string }
      if (pgError.code === '23505' && pgError.constraint?.includes('slug')) continue
      throw error
    }
  }
  throw new Error('Không thể tạo đường dẫn portfolio an toàn.')
}

async function findPortfolioForTeacher(
  client: PoolClient,
  teacher: TeacherPortfolioOwnerRow,
): Promise<PortfolioRow> {
  const result = await client.query(
    `SELECT id, teacher_code, public_slug, status, created_at, updated_at
     FROM teacher_portfolios
     WHERE teacher_code = $1
     LIMIT 1`,
    [teacher.code],
  )
  const existing = result.rows[0] as PortfolioRow | undefined
  return existing ?? ensurePortfolio(client, teacher)
}

function achievementProvenance(row: Record<string, unknown>): TeacherPortfolioProvenance {
  if (row.verification_status === 'verified') {
    return {
      kind: 'verified',
      label: 'Đã xác thực',
      verifiedAt: row.verified_at ? isoTimestamp(row.verified_at) : null,
    }
  }
  return SELF_REPORTED
}

async function loadSelfReported(portfolioId: string | number) {
  const [educationResult, experienceResult, achievementResult] = await Promise.all([
    pool.query(
      `SELECT * FROM teacher_portfolio_educations
       WHERE portfolio_id = $1 ORDER BY display_order, id`,
      [portfolioId],
    ),
    pool.query(
      `SELECT * FROM teacher_portfolio_experiences
       WHERE portfolio_id = $1 ORDER BY display_order, id`,
      [portfolioId],
    ),
    pool.query(
      `SELECT * FROM teacher_portfolio_achievements
       WHERE portfolio_id = $1 ORDER BY display_order, id`,
      [portfolioId],
    ),
  ])

  return {
    education: educationResult.rows.map((row) => ({
      id: integer(row.id),
      institution: text(row.institution),
      qualification: text(row.qualification),
      fieldOfStudy: nullableText(row.field_of_study),
      startYear: finiteNumber(row.start_year),
      endYear: finiteNumber(row.end_year),
      description: nullableText(row.description),
      provenance: SELF_REPORTED,
    })),
    experiences: experienceResult.rows.map((row) => ({
      id: integer(row.id),
      organization: text(row.organization),
      jobTitle: text(row.job_title),
      startDate: isoDate(row.start_date),
      endDate: isoDate(row.end_date),
      isCurrent: row.is_current === true,
      description: nullableText(row.description),
      provenance: SELF_REPORTED,
    })),
    achievements: achievementResult.rows.map((row): TeacherPortfolioAchievement => ({
      id: integer(row.id),
      category: row.category === 'competition' ? 'competition' : 'award',
      title: text(row.title),
      organization: nullableText(row.organization),
      level: nullableText(row.level),
      achievedOn: isoDate(row.achieved_on),
      description: nullableText(row.description),
      evidenceUrl: nullableText(row.evidence_url),
      verificationStatus: text(row.verification_status) as TeacherPortfolioVerificationStatus,
      verificationNote: nullableText(row.verification_note),
      provenance: achievementProvenance(row),
    })),
  }
}

async function loadCertificates(teacher: TeacherPortfolioOwnerRow) {
  const email = profileEmail(teacher).toLowerCase()
  if (!email) return []
  const result = await pool.query(
    `SELECT id, certificate_name, certificate_type, issue_date, expiry_date, description
     FROM teacher_certificates
     WHERE LOWER(TRIM(teacher_email)) = $1
     ORDER BY issue_date DESC NULLS LAST, id DESC`,
    [email],
  )
  return result.rows.map((row) => ({
    id: integer(row.id),
    name: text(row.certificate_name),
    type: text(row.certificate_type) || 'Other',
    issueDate: isoDate(row.issue_date),
    expiryDate: isoDate(row.expiry_date),
    description: nullableText(row.description),
    provenance: SELF_REPORTED,
  }))
}

async function loadAvatar(teacher: TeacherPortfolioOwnerRow): Promise<string | null> {
  const emails = Array.from(
    new Set(
      [teacher.work_email, teacher['Work email'], teacher.personal_email]
        .map(normalize)
        .filter(Boolean),
    ),
  )
  if (emails.length === 0) return null
  const result = await pool.query(
    `SELECT avatar_url
     FROM teacher_avatars
     WHERE LOWER(TRIM(teacher_email)) = ANY($1::text[])
       AND NULLIF(TRIM(avatar_url), '') IS NOT NULL
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1`,
    [emails],
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }))
  return nullableText(result.rows[0]?.avatar_url)
}

function average(values: unknown[]): number | null {
  const valid = values.map(finiteNumber).filter((value): value is number => value !== null)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10
}

function hasMeaningfulInternalTraining(
  internal: TeacherPortfolioDto['training']['internal'],
): boolean {
  return [
    internal.totalVideosAssigned,
    internal.videosCompleted,
    internal.assignmentsTaken,
    internal.assignmentsPassed,
    internal.averageVideoScore,
    internal.averageAssignmentScore,
  ].some((value) => (finiteNumber(value) ?? 0) > 0)
}

async function loadTraining(teacher: TeacherPortfolioOwnerRow) {
  const code = normalize(teacher.code)
  const username = normalize(teacher.user_name || teacher['User name'])
  const emailPrefix = normalize(profileEmail(teacher).split('@')[0])
  const aliases = Array.from(new Set([code, username, emailPrefix].filter(Boolean)))

  const [onboardingResult, internalResult, advancedResult] = await Promise.all([
    pool.query(
      `SELECT
         c.status AS candidate_status,
         g.gen_name,
         s.id AS session_id,
         s.session_number,
         s.title,
         s.session_date,
         r.attendance,
         r.score
       FROM teachers t
       JOIN hr_candidates c ON c.id = t.hr_candidate_id
       LEFT JOIN hr_gen_catalog g ON g.id = c.gen_id
       LEFT JOIN hr_training_sessions s ON s.gen_id = c.gen_id
       LEFT JOIN hr_candidate_training_records r
         ON r.candidate_id = c.id AND r.session_id = s.id
       WHERE t.code = $1
       ORDER BY s.session_number`,
      [teacher.code],
    ).catch(() => ({ rows: [] as Record<string, unknown>[] })),
    aliases.length > 0
      ? pool.query(
          `WITH matched_teacher AS (
             SELECT *
             FROM training_teacher_stats
             WHERE LOWER(TRIM(teacher_code)) = ANY($1::text[])
                OR LOWER(TRIM(COALESCE(username, ''))) = ANY($1::text[])
                OR LOWER(TRIM(SPLIT_PART(COALESCE(work_email, ''), '@', 1))) = ANY($1::text[])
             ORDER BY updated_at DESC NULLS LAST
             LIMIT 1
           ), video_stats AS (
             SELECT
               mt.teacher_code,
               COUNT(DISTINCT tvs.video_id) FILTER (WHERE tv.status = 'active') AS total_videos_assigned,
               COUNT(DISTINCT tvs.video_id) FILTER (
                 WHERE tv.status = 'active' AND tvs.completion_status = 'completed'
               ) AS videos_completed,
               ROUND((AVG(tvs.score) FILTER (WHERE tv.status = 'active' AND tvs.score > 0))::numeric, 1) AS avg_video_score
             FROM matched_teacher mt
             LEFT JOIN training_teacher_video_scores tvs
               ON LOWER(TRIM(tvs.teacher_code)) = LOWER(TRIM(mt.teacher_code))
             LEFT JOIN training_videos tv ON tv.id = tvs.video_id
             GROUP BY mt.teacher_code
           ), assignment_stats AS (
             SELECT
               mt.teacher_code,
               COUNT(DISTINCT tas.id) AS total_assignments_taken,
               COUNT(DISTINCT tas.id) FILTER (WHERE tas.is_passed = TRUE) AS assignments_passed,
               ROUND((AVG(tas.score) FILTER (WHERE tas.status = 'graded'))::numeric, 1) AS avg_assignment_score
             FROM matched_teacher mt
             LEFT JOIN training_assignment_submissions tas
               ON LOWER(TRIM(tas.teacher_code)) = LOWER(TRIM(mt.teacher_code))
             GROUP BY mt.teacher_code
           )
           SELECT
             mt.teacher_code,
             COALESCE(vs.total_videos_assigned, 0) AS total_videos_assigned,
             COALESCE(vs.videos_completed, 0) AS videos_completed,
             COALESCE(vs.avg_video_score, 0) AS avg_video_score,
             COALESCE(ats.total_assignments_taken, 0) AS total_assignments_taken,
             COALESCE(ats.assignments_passed, 0) AS assignments_passed,
             COALESCE(ats.avg_assignment_score, 0) AS avg_assignment_score
           FROM matched_teacher mt
           LEFT JOIN video_stats vs ON vs.teacher_code = mt.teacher_code
           LEFT JOIN assignment_stats ats ON ats.teacher_code = mt.teacher_code`,
          [aliases],
        ).catch(() => ({ rows: [] as Record<string, unknown>[] }))
      : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    aliases.length > 0
      ? pool.query(
          `SELECT r.diem, COALESCE(m.loai_ky_thi, 'expertise') AS exam_type
           FROM chuyen_sau_results r
           LEFT JOIN chuyen_sau_monhoc m ON m.id = r.id_mon
           WHERE r.diem IS NOT NULL
             AND r.xu_ly_diem IS NOT NULL
             AND (
               LOWER(TRIM(COALESCE(r.ma_giao_vien, ''))) = ANY($1::text[])
               OR LOWER(TRIM(SPLIT_PART(COALESCE(r.dia_chi_email, ''), '@', 1))) = ANY($1::text[])
             )`,
          [aliases],
        ).catch(() => ({ rows: [] as Record<string, unknown>[] }))
      : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
  ])

  const onboardingRows = onboardingResult.rows as Record<string, unknown>[]
  const firstOnboarding = onboardingRows[0]
  const internal = internalResult.rows[0] as Record<string, unknown> | undefined
  const advancedRows = advancedResult.rows as Record<string, unknown>[]
  const expertiseScores = advancedRows
    .filter((row) => normalize(row.exam_type) !== 'experience')
    .map((row) => row.diem)
  const experienceScores = advancedRows
    .filter((row) => normalize(row.exam_type) === 'experience')
    .map((row) => row.diem)

  return {
    provenance: TPS_SYNCED,
    onboarding: {
      available: onboardingRows.length > 0,
      genName: nullableText(firstOnboarding?.gen_name),
      status: nullableText(firstOnboarding?.candidate_status),
      sessions: onboardingRows
        .filter((row) => row.session_id != null)
        .map((row) => ({
          id: integer(row.session_id),
          sessionNumber: integer(row.session_number),
          title: text(row.title),
          sessionDate: isoDate(row.session_date),
          attendance: row.attendance === true,
          score: finiteNumber(row.score),
        })),
    },
    internal: {
      available: Boolean(internal),
      videosCompleted: internal ? finiteNumber(internal.videos_completed) : null,
      totalVideosAssigned: internal ? finiteNumber(internal.total_videos_assigned) : null,
      averageVideoScore: internal ? finiteNumber(internal.avg_video_score) : null,
      assignmentsPassed: internal ? finiteNumber(internal.assignments_passed) : null,
      assignmentsTaken: internal ? finiteNumber(internal.total_assignments_taken) : null,
      averageAssignmentScore: internal ? finiteNumber(internal.avg_assignment_score) : null,
    },
    advanced: {
      available: advancedRows.length > 0,
      expertiseAverage: average(expertiseScores),
      expertiseRecords: expertiseScores.length,
      experienceAverage: average(experienceScores),
      experienceRecords: experienceScores.length,
    },
    media: [],
  }
}

async function loadOperations(teacher: TeacherPortfolioOwnerRow) {
  try {
    const result = await getTeacherCheckCong({
      email: profileEmail(teacher),
      personalEmail: text(teacher.personal_email),
      username: text(teacher.user_name || teacher['User name']),
      code: text(teacher.code),
      fullName: teacherName(teacher),
      month: 'all',
    })
    const teachingRecords = result.records.filter(
      (record) => normalize(record.type) === 'class' && normalize(record.status) === 'checked',
    )
    const classNames = new Set<string>()
    const studentsByClass = new Map<string, number>()
    for (const record of teachingRecords) {
      const className = text(record.className)
      if (!className) continue
      const classKey = normalize(className)
      classNames.add(classKey)
      const count = finiteNumber(record.studentCount)
      if (count !== null) {
        studentsByClass.set(classKey, Math.max(studentsByClass.get(classKey) ?? 0, count))
      }
    }
    const studentCount = studentsByClass.size
      ? [...studentsByClass.values()].reduce((sum, count) => sum + count, 0)
      : null
    const teachingHours = teachingRecords.reduce(
      (sum, record) => sum + Math.max(0, finiteNumber(record.slotDuration) ?? 0),
      0,
    )
    return {
      provenance: TPS_SYNCED,
      available: teachingRecords.length > 0,
      periodLabel: result.summary.monthLabel || 'Toàn bộ dữ liệu',
      classCount: classNames.size || null,
      studentCount,
      classSessions: teachingRecords.length || null,
      teachingHours: teachingRecords.length > 0 ? Math.round(teachingHours * 10) / 10 : null,
      cpr: null,
      retention: null,
    }
  } catch {
    return {
      provenance: TPS_SYNCED,
      available: false,
      periodLabel: 'Toàn bộ dữ liệu',
      classCount: null,
      studentCount: null,
      classSessions: null,
      teachingHours: null,
      cpr: null,
      retention: null,
    }
  }
}

async function loadHonors(teacherCode: string) {
  const result = await pool.query(
    `SELECT id, thang, loai, so_case, so_hoc_sinh, ti_le
     FROM teacher_monthly_honors
     WHERE teacher_code = $1
     ORDER BY imported_at DESC, id DESC
     LIMIT 24`,
    [teacherCode],
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }))

  return result.rows.map((row) => {
    const details = [
      finiteNumber(row.so_case) !== null ? `${finiteNumber(row.so_case)} case` : '',
      finiteNumber(row.so_hoc_sinh) !== null ? `${finiteNumber(row.so_hoc_sinh)} học viên` : '',
      finiteNumber(row.ti_le) !== null ? `Tỷ lệ ${finiteNumber(row.ti_le)}%` : '',
    ].filter(Boolean)
    return {
      id: integer(row.id),
      month: nullableText(row.thang),
      title: nullableText(row.loai) || 'Vinh danh giáo viên',
      detail: details.length ? details.join(' · ') : null,
      provenance: TPS_SYNCED,
    }
  })
}

async function composeDto(
  portfolio: PortfolioRow,
  teacher: TeacherPortfolioOwnerRow,
  options: {
    mode: 'self' | 'shared'
    canEditSelfReported: boolean
    canVerifyAchievements: boolean
  },
): Promise<TeacherPortfolioDto> {
  const [selfReported, loadedCertificates, avatarUrl, loadedTraining, operations, honors] = await Promise.all([
    loadSelfReported(portfolio.id),
    loadCertificates(teacher),
    loadAvatar(teacher),
    loadTraining(teacher),
    loadOperations(teacher),
    loadHonors(teacher.code),
  ])
  const demoSections: TeacherPortfolioDemoSection[] = []
  const useDemoData = DEMO_TEACHER_CODES.has(normalize(teacher.code))
  let certificates = loadedCertificates
  let training = loadedTraining

  if (useDemoData && certificates.length === 0) {
    demoSections.push('certificates')
    certificates = [
      {
        id: -101,
        name: 'Phương pháp giảng dạy tích cực',
        type: 'Nghiệp vụ sư phạm',
        issueDate: '2025-06-18',
        expiryDate: null,
        description: 'Chứng nhận năng lực tổ chức lớp học và thúc đẩy sự chủ động của học viên.',
        provenance: SELF_REPORTED,
      },
      {
        id: -102,
        name: 'Ứng dụng AI trong giáo dục',
        type: 'Công nghệ giáo dục',
        issueDate: '2026-02-12',
        expiryDate: null,
        description: 'Ứng dụng công cụ AI để thiết kế học liệu và cá nhân hóa hoạt động học tập.',
        provenance: SELF_REPORTED,
      },
    ]
  }

  if (useDemoData && training.onboarding.sessions.length === 0) {
    demoSections.push('onboarding')
    training = {
      ...training,
      onboarding: {
        available: true,
        genName: 'Gen Teacher Onboarding 2026',
        status: 'training',
        sessions: [
          { id: -201, sessionNumber: 1, title: 'Văn hóa & phương pháp giáo dục MindX', sessionDate: '2026-08-18', attendance: true, score: 9.1 },
          { id: -202, sessionNumber: 2, title: 'Quản lý lớp học tích cực', sessionDate: '2026-08-20', attendance: true, score: 8.8 },
          { id: -203, sessionNumber: 3, title: 'Thực hành giảng dạy', sessionDate: '2026-08-22', attendance: true, score: 9.2 },
        ],
      },
    }
  }

  if (useDemoData && !hasMeaningfulInternalTraining(training.internal)) {
    demoSections.push('internal_training')
    training = {
      ...training,
      internal: {
        available: true,
        videosCompleted: 8,
        totalVideosAssigned: 10,
        averageVideoScore: 8.7,
        assignmentsPassed: 4,
        assignmentsTaken: 5,
        averageAssignmentScore: 8.5,
      },
    }
  }
  const achievements = selfReported.achievements.map((achievement) => ({
    ...achievement,
    ...(!options.canEditSelfReported && !options.canVerifyAchievements
      ? { evidenceUrl: undefined, verificationNote: undefined }
      : {}),
  }))

  const courseLines = splitValues(teacher.course_line || teacher['Course Line'])
  return {
    meta: {
      slug: portfolio.public_slug,
      sharePath: `/public/teacher-portfolio/${encodeURIComponent(portfolio.public_slug)}`,
      createdAt: isoTimestamp(portfolio.created_at),
      updatedAt: isoTimestamp(portfolio.updated_at),
      demoSections,
    },
    access: {
      mode: options.mode,
      canEditSelfReported: options.canEditSelfReported,
      canVerifyAchievements: options.canVerifyAchievements,
    },
    profile: {
      displayName: teacherName(teacher),
      professionalTitle: courseLines.length
        ? `Giáo viên ${courseLines.join(' · ')}`
        : 'Giáo viên MindX',
      centerName: teacherCenter(teacher),
      courseLines,
      avatarUrl,
    },
    education: selfReported.education,
    experiences: selfReported.experiences,
    achievements,
    certificates,
    training,
    operations,
    honors,
    studentAchievements: {
      available: false,
      total: null,
      provenance: TPS_SYNCED,
    },
    sourceNotes: [
      'Ảnh buổi đào tạo chưa có kho dữ liệu theo Session/Gen trên TPS.',
      'CPR và retention chưa có nguồn chuẩn gắn trực tiếp với từng giáo viên.',
      'Dữ liệu học viên đạt giải sẽ hiển thị khi quy trình khai báo thưởng được chuyển lên TPS.',
    ],
  }
}

export async function getTeacherPortfolioForSelf(
  sessionEmail: string,
): Promise<TeacherPortfolioDto | null> {
  await waitForMigrations()
  const teacher = await findTeacherForPortfolioSession(sessionEmail)
  if (!teacher) return null
  const client = await pool.connect()
  try {
    const portfolio = await findPortfolioForTeacher(client, teacher)
    return composeDto(portfolio, teacher, {
      mode: 'self',
      canEditSelfReported: true,
      canVerifyAchievements: false,
    })
  } finally {
    client.release()
  }
}

export async function getTeacherPortfolioForViewer(
  sessionEmail: string,
  teacherCode: string,
): Promise<TeacherPortfolioShareResult> {
  await waitForMigrations()
  const code = teacherCode.trim()
  if (!code || code.length > 50) return { status: 'not_found' }
  const teacherResult = await pool.query(
    'SELECT * FROM teachers WHERE LOWER(TRIM(code)) = LOWER(TRIM($1)) LIMIT 1',
    [code],
  )
  const teacher = teacherResult.rows[0] as TeacherPortfolioOwnerRow | undefined
  if (!teacher) return { status: 'not_found' }
  const access = await resolveTeacherPortfolioAccess(sessionEmail, teacher)
  if (!access.allowed) return { status: 'forbidden' }

  const client = await pool.connect()
  try {
    const portfolio = await findPortfolioForTeacher(client, teacher)
    return {
      status: 'ok',
      data: await composeDto(portfolio, teacher, {
        mode: access.isOwner ? 'self' : 'shared',
        canEditSelfReported: access.isOwner,
        canVerifyAchievements: access.canVerifyAchievements,
      }),
    }
  } finally {
    client.release()
  }
}

async function replaceEducationAndExperience(
  client: PoolClient,
  portfolioId: string | number,
  input: TeacherPortfolioUpdateInput,
) {
  await client.query('DELETE FROM teacher_portfolio_educations WHERE portfolio_id = $1', [portfolioId])
  for (const [index, item] of input.education.entries()) {
    await client.query(
      `INSERT INTO teacher_portfolio_educations (
         portfolio_id, institution, qualification, field_of_study,
         start_year, end_year, description, display_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        portfolioId,
        item.institution,
        item.qualification,
        item.fieldOfStudy ?? null,
        item.startYear ?? null,
        item.endYear ?? null,
        item.description ?? null,
        index,
      ],
    )
  }

  await client.query('DELETE FROM teacher_portfolio_experiences WHERE portfolio_id = $1', [portfolioId])
  for (const [index, item] of input.experiences.entries()) {
    await client.query(
      `INSERT INTO teacher_portfolio_experiences (
         portfolio_id, organization, job_title, start_date, end_date,
         is_current, description, display_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        portfolioId,
        item.organization,
        item.jobTitle,
        item.startDate ?? null,
        item.isCurrent ? null : item.endDate ?? null,
        item.isCurrent === true,
        item.description ?? null,
        index,
      ],
    )
  }
}

function achievementChanged(
  existing: Record<string, unknown>,
  item: TeacherPortfolioUpdateInput['achievements'][number],
) {
  return (
    text(existing.category) !== item.category ||
    text(existing.title) !== item.title ||
    nullableText(existing.organization) !== (item.organization ?? null) ||
    nullableText(existing.level) !== (item.level ?? null) ||
    isoDate(existing.achieved_on) !== (item.achievedOn ?? null) ||
    nullableText(existing.description) !== (item.description ?? null) ||
    nullableText(existing.evidence_url) !== (item.evidenceUrl ?? null)
  )
}

async function replaceAchievements(
  client: PoolClient,
  portfolioId: string | number,
  input: TeacherPortfolioUpdateInput,
) {
  const current = await client.query(
    'SELECT * FROM teacher_portfolio_achievements WHERE portfolio_id = $1 FOR UPDATE',
    [portfolioId],
  )
  const byId = new Map(current.rows.map((row) => [integer(row.id), row as Record<string, unknown>]))
  const retainedIds: number[] = []

  for (const [index, item] of input.achievements.entries()) {
    if (item.id) {
      const existing = byId.get(item.id)
      if (!existing) {
        throw new TeacherPortfolioValidationError({
          achievements: 'Có mục giải thưởng không thuộc portfolio này.',
        })
      }
      const changed = achievementChanged(existing, item)
      const nextStatus = changed
        ? item.evidenceUrl
          ? 'pending'
          : 'self_declared'
        : text(existing.verification_status)
      await client.query(
        `UPDATE teacher_portfolio_achievements SET
           category=$1, title=$2, organization=$3, level=$4, achieved_on=$5,
           description=$6, evidence_url=$7, display_order=$8,
           verification_status=$9,
           verified_by_email=CASE WHEN $10 THEN NULL ELSE verified_by_email END,
           verified_at=CASE WHEN $10 THEN NULL ELSE verified_at END,
           verification_note=CASE WHEN $10 THEN NULL ELSE verification_note END
         WHERE id=$11 AND portfolio_id=$12`,
        [
          item.category,
          item.title,
          item.organization ?? null,
          item.level ?? null,
          item.achievedOn ?? null,
          item.description ?? null,
          item.evidenceUrl ?? null,
          index,
          nextStatus,
          changed,
          item.id,
          portfolioId,
        ],
      )
      retainedIds.push(item.id)
      continue
    }

    const inserted = await client.query(
      `INSERT INTO teacher_portfolio_achievements (
         portfolio_id, category, title, organization, level, achieved_on,
         description, evidence_url, verification_status, display_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        portfolioId,
        item.category,
        item.title,
        item.organization ?? null,
        item.level ?? null,
        item.achievedOn ?? null,
        item.description ?? null,
        item.evidenceUrl ?? null,
        item.evidenceUrl ? 'pending' : 'self_declared',
        index,
      ],
    )
    retainedIds.push(integer(inserted.rows[0]?.id))
  }

  if (retainedIds.length === 0) {
    await client.query('DELETE FROM teacher_portfolio_achievements WHERE portfolio_id = $1', [portfolioId])
  } else {
    await client.query(
      'DELETE FROM teacher_portfolio_achievements WHERE portfolio_id = $1 AND NOT (id = ANY($2::bigint[]))',
      [portfolioId, retainedIds],
    )
  }
}

export async function updateTeacherPortfolioForSelf(
  sessionEmail: string,
  input: TeacherPortfolioUpdateInput,
): Promise<TeacherPortfolioDto | null> {
  await waitForMigrations()
  const teacher = await findTeacherForPortfolioSession(sessionEmail)
  if (!teacher) return null
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const portfolio = await findPortfolioForTeacher(client, teacher)
    await replaceEducationAndExperience(client, portfolio.id, input)
    await replaceAchievements(client, portfolio.id, input)
    await client.query(
      'UPDATE teacher_portfolios SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [portfolio.id],
    )
    await client.query('COMMIT')
    const refreshed = await client.query(
      `SELECT id, teacher_code, public_slug, status, created_at, updated_at
       FROM teacher_portfolios WHERE id = $1`,
      [portfolio.id],
    )
    return composeDto(refreshed.rows[0] as PortfolioRow, teacher, {
      mode: 'self',
      canEditSelfReported: true,
      canVerifyAchievements: false,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getTeacherPortfolioShareView(
  slug: string,
): Promise<TeacherPortfolioShareResult> {
  await waitForMigrations()
  let decodedSlug = ''
  try {
    decodedSlug = decodeURIComponent(slug).trim()
  } catch {
    return { status: 'not_found' }
  }
  if (!decodedSlug || decodedSlug.length > 180) return { status: 'not_found' }
  const result = await pool.query(
    `SELECT p.id, p.teacher_code, p.public_slug, p.status, p.created_at, p.updated_at,
            to_jsonb(t.*) AS teacher
     FROM teacher_portfolios p
     JOIN teachers t ON t.code = p.teacher_code
     WHERE p.public_slug = $1 AND p.status = 'published'
     LIMIT 1`,
    [decodedSlug],
  )
  const row = result.rows[0] as (PortfolioRow & { teacher: TeacherPortfolioOwnerRow }) | undefined
  if (!row) return { status: 'not_found' }

  const data = await composeDto(row, row.teacher, {
      mode: 'shared',
      canEditSelfReported: false,
      canVerifyAchievements: false,
    })
  if (data.profile.avatarUrl) {
    data.profile.avatarUrl = `/api/public/teacher-portfolio/${encodeURIComponent(row.public_slug)}/avatar`
  }
  return {
    status: 'ok',
    data,
  }
}

export async function verifyTeacherPortfolioAchievement(input: {
  viewerEmail: string
  achievementId: number
  status: 'verified' | 'rejected'
  note?: string | null
}): Promise<'ok' | 'not_found' | 'forbidden'> {
  await waitForMigrations()
  const result = await pool.query(
    `SELECT a.id, a.evidence_url, a.verification_status, to_jsonb(t.*) AS teacher
     FROM teacher_portfolio_achievements a
     JOIN teacher_portfolios p ON p.id = a.portfolio_id
     JOIN teachers t ON t.code = p.teacher_code
     WHERE a.id = $1
     LIMIT 1`,
    [input.achievementId],
  )
  const row = result.rows[0] as {
    id: number
    evidence_url: string | null
    verification_status: TeacherPortfolioVerificationStatus
    teacher: TeacherPortfolioOwnerRow
  } | undefined
  if (!row) return 'not_found'
  const access = await resolveTeacherPortfolioAccess(input.viewerEmail, row.teacher)
  if (!access.canVerifyAchievements) return 'forbidden'
  if (!nullableText(row.evidence_url) || row.verification_status !== 'pending') {
    return 'forbidden'
  }

  await pool.query(
    `UPDATE teacher_portfolio_achievements
     SET verification_status = $1,
         verified_by_email = $2,
         verified_at = CASE WHEN $1 = 'verified' THEN CURRENT_TIMESTAMP ELSE NULL END,
         verification_note = $3
     WHERE id = $4`,
    [input.status, input.viewerEmail.trim().toLowerCase(), input.note ?? null, input.achievementId],
  )
  return 'ok'
}
