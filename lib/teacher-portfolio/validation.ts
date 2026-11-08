import type {
  TeacherPortfolioAchievementInput,
  TeacherPortfolioEducationInput,
  TeacherPortfolioExperienceInput,
  TeacherPortfolioUpdateInput,
} from './types'

const MAX_ITEMS = 20
const MIN_YEAR = 1950
const MAX_YEAR = new Date().getFullYear() + 5

export class TeacherPortfolioValidationError extends Error {
  fieldErrors: Record<string, string>

  constructor(fieldErrors: Record<string, string>) {
    super('Dữ liệu portfolio chưa hợp lệ.')
    this.name = 'TeacherPortfolioValidationError'
    this.fieldErrors = fieldErrors
  }
}

function cleanText(value: unknown, max: number): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  return text.slice(0, max)
}

function requiredText(
  value: unknown,
  path: string,
  max: number,
  errors: Record<string, string>,
): string {
  const text = String(value ?? '').trim()
  if (text.length < 2) {
    errors[path] = 'Vui lòng nhập ít nhất 2 ký tự.'
    return text
  }
  if (text.length > max) errors[path] = `Tối đa ${max} ký tự.`
  return text.slice(0, max)
}

function optionalYear(
  value: unknown,
  path: string,
  errors: Record<string, string>,
): number | null {
  if (value == null || value === '') return null
  const year = Number(value)
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    errors[path] = `Năm phải trong khoảng ${MIN_YEAR}–${MAX_YEAR}.`
    return null
  }
  return year
}

function optionalDate(
  value: unknown,
  path: string,
  errors: Record<string, string>,
): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    errors[path] = 'Ngày phải theo định dạng YYYY-MM-DD.'
    return null
  }
  const parsed = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    errors[path] = 'Ngày không hợp lệ.'
    return null
  }
  return text
}

function optionalEvidenceUrl(
  value: unknown,
  path: string,
  errors: Record<string, string>,
): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (text.length > 1000) {
    errors[path] = 'Đường dẫn minh chứng tối đa 1000 ký tự.'
    return null
  }
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error()
    return url.toString()
  } catch {
    errors[path] = 'Minh chứng phải là đường dẫn http/https hợp lệ.'
    return null
  }
}

function parseEducation(
  raw: unknown,
  index: number,
  errors: Record<string, string>,
): TeacherPortfolioEducationInput {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const base = `education.${index}`
  const startYear = optionalYear(item.startYear, `${base}.startYear`, errors)
  const endYear = optionalYear(item.endYear, `${base}.endYear`, errors)
  if (startYear && endYear && endYear < startYear) {
    errors[`${base}.endYear`] = 'Năm kết thúc không được trước năm bắt đầu.'
  }
  return {
    institution: requiredText(item.institution, `${base}.institution`, 200, errors),
    qualification: requiredText(item.qualification, `${base}.qualification`, 160, errors),
    fieldOfStudy: cleanText(item.fieldOfStudy, 160),
    startYear,
    endYear,
    description: cleanText(item.description, 1000),
  }
}

function parseExperience(
  raw: unknown,
  index: number,
  errors: Record<string, string>,
): TeacherPortfolioExperienceInput {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const base = `experiences.${index}`
  const isCurrent = item.isCurrent === true
  const startDate = optionalDate(item.startDate, `${base}.startDate`, errors)
  const endDate = isCurrent
    ? null
    : optionalDate(item.endDate, `${base}.endDate`, errors)
  if (startDate && endDate && endDate < startDate) {
    errors[`${base}.endDate`] = 'Ngày kết thúc không được trước ngày bắt đầu.'
  }
  return {
    organization: requiredText(item.organization, `${base}.organization`, 200, errors),
    jobTitle: requiredText(item.jobTitle, `${base}.jobTitle`, 160, errors),
    startDate,
    endDate,
    isCurrent,
    description: cleanText(item.description, 1500),
  }
}

function parseAchievement(
  raw: unknown,
  index: number,
  errors: Record<string, string>,
): TeacherPortfolioAchievementInput {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const base = `achievements.${index}`
  const id = Number(item.id)
  const category = item.category === 'competition' ? 'competition' : 'award'
  return {
    ...(Number.isInteger(id) && id > 0 ? { id } : {}),
    category,
    title: requiredText(item.title, `${base}.title`, 200, errors),
    organization: cleanText(item.organization, 200),
    level: cleanText(item.level, 100),
    achievedOn: optionalDate(item.achievedOn, `${base}.achievedOn`, errors),
    description: cleanText(item.description, 1000),
    evidenceUrl: optionalEvidenceUrl(item.evidenceUrl, `${base}.evidenceUrl`, errors),
  }
}

export function parseTeacherPortfolioUpdate(value: unknown): TeacherPortfolioUpdateInput {
  const body = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const education = Array.isArray(body.education) ? body.education : []
  const experiences = Array.isArray(body.experiences) ? body.experiences : []
  const achievements = Array.isArray(body.achievements) ? body.achievements : []
  const errors: Record<string, string> = {}

  if (!Array.isArray(body.education)) errors.education = 'Danh sách học vấn không hợp lệ.'
  if (!Array.isArray(body.experiences)) errors.experiences = 'Danh sách kinh nghiệm không hợp lệ.'
  if (!Array.isArray(body.achievements)) errors.achievements = 'Danh sách thành tích không hợp lệ.'

  if (education.length > MAX_ITEMS) errors.education = `Tối đa ${MAX_ITEMS} mục học vấn.`
  if (experiences.length > MAX_ITEMS) errors.experiences = `Tối đa ${MAX_ITEMS} mục kinh nghiệm.`
  if (achievements.length > MAX_ITEMS) errors.achievements = `Tối đa ${MAX_ITEMS} giải thưởng/cuộc thi.`

  const parsed = {
    education: education.slice(0, MAX_ITEMS).map((item, index) => parseEducation(item, index, errors)),
    experiences: experiences.slice(0, MAX_ITEMS).map((item, index) => parseExperience(item, index, errors)),
    achievements: achievements.slice(0, MAX_ITEMS).map((item, index) => parseAchievement(item, index, errors)),
  }

  if (Object.keys(errors).length > 0) throw new TeacherPortfolioValidationError(errors)
  return parsed
}
