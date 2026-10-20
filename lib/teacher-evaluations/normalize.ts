import {
  CLASS_INACTIVE_STATUSES,
  SHEET_HEADERS,
  TEACHER_POINT_EXEMPTED_REASONS,
  TEACHER_POINT_SESSION_INDICES,
  VIETNAM_TIMEZONE_OFFSET_MS,
} from './constants'

export interface MatchableCentre {
  id: string
  name: string
  shortName: string
}

export interface MatchableStudent {
  activeInClass?: boolean
  completionInfo?: {
    status?: string
    reason?: string | null
  } | null
  student?: {
    id?: string
    fullName?: string
  }
}

export interface MatchableSlot {
  _id?: string
  date?: string
  teachers?: Array<{
    isActive?: boolean
    teacher?: { id?: string; fullName?: string }
  }>
  studentAttendance?: Array<{
    student?: { id?: string }
  }>
}

export interface MatchableClass {
  id: string
  name: string
  className?: string
  status?: string
  centre?: MatchableCentre | null
  students?: MatchableStudent[]
  slots?: MatchableSlot[]
}

export interface RawSheetRow {
  rowNumber: number
  values: Record<string, string>
}

export type SheetDateOrder = 'DMY' | 'MDY'

export interface SheetMatchResult {
  raw: RawSheetRow
  matchedClass?: MatchableClass
  matchScore: number
  matchReasons: string[]
  matchMethod: 'direct' | 'inferred' | 'unmatched'
  studentName: string
  inputClassCode: string
  normalizedClassCode: string
  centerHint: string
  timestamp: string
  rowDate: Date | null
  teacherUnderstandabilityScore: number | null
  teacherAffinityScore: number | null
  teacherScore: number | null
}

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()
}

export function normalizeKey(value: unknown): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '')
}

export function getTrueAcronym(value: string): string {
  const normalized = String(value || '').toUpperCase().trim()
  const lastDigitIndex = normalized
    .split('')
    .reduce((last, character, index) => (/\d/.test(character) ? index : last), -1)
  if (lastDigitIndex < 0) return normalized.replace(/[^A-Z]/g, '')
  const trailingLetters = normalized.slice(lastDigitIndex + 1).replace(/[^A-Z]/g, '')
  return trailingLetters.length >= 2
    ? trailingLetters
    : normalized.replace(/[^A-Z]/g, '')
}

export function getJumbleKey(value: string): string {
  const normalized = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const digits = normalized.replace(/[^0-9]/g, '')
  const letters = normalized.replace(/[^A-Z]/g, '').split('').sort().join('')
  return digits && letters ? `${digits}:${letters}` : normalized
}

export function fixClassTypo(value: string): string {
  let cleaned = String(value || '').toUpperCase().trim()
  cleaned = cleaned
    .replace(/^(MA LOP|LOP|TEN LOP)\s*[:\-]*\s*/g, '')
    .replace(/^[:\s-]+/, '')
    .replace(/ẢM/g, 'ARM')
    .replace(/ỎM/g, 'ROM')
    .replace(/ÁRT|ẢT|ẢRT/g, 'ART')
    .replace(/XÁRT/g, 'XART')
    .replace(/VCL([0-9]+)/g, 'VCI$1')
    .replace(/GDL([0-9]+)/g, 'GDI$1')
    .replace(/ARML([0-9]+)/g, 'ARMI$1')
    .replace(/([A-Z])O([0-9])/g, '$10$2')
    .replace(/O([0-9])/g, '0$1')
    .replace(/\s+/g, ' ')
    .replace(/[\u2010-\u2015,;_]/g, '-')
    .replace(/[-\s]+/g, '-')
    .replace(/[^A-Z0-9\-]/g, '')
  return cleaned.replace(/^-+|-+$/g, '')
}

const CENTER_ALIASES: Record<string, string> = {
  'truong chinh': 'TC',
  'ten lua': 'TL',
  'ham nghi': 'VHHN',
  'di an': 'NAN',
  da: 'NAN',
  'can tho': 'CT',
  'long bien': 'LB',
  'pham van dong': 'PVD',
  'minh khai': 'MK',
  'vinh phuc': 'VP',
  'ocean park': 'OCP',
  oceanpark: 'OCP',
  'thanh hoa': 'TH',
  'thai nguyen': 'TN',
  'nguyen phong sat': 'NPS',
  'le van viet': 'LVV',
  'nguyen van cu': 'NVC',
  'nguyen huu tho': 'NHT',
  'digital art': 'DART',
  dart: 'DART',
  'hcm tc': 'TC',
  bh: '253PVT',
  'bien hoa': '253PVT',
  pvt: '672A28PVT',
}

export function normalizeCenterHint(value: string): string {
  if (!value) return ''
  const cleaned = value.toUpperCase().split('(')[0].trim()
  const normalized = normalizeText(cleaned)
  for (const [alias, code] of Object.entries(CENTER_ALIASES)) {
    if (normalized === alias || normalized.includes(alias)) return code
  }
  return cleaned.replace(/[^A-Z0-9]/g, '')
}

export function centreMatchesHint(
  centre: Pick<MatchableCentre, 'name' | 'shortName'>,
  hints: string[],
): boolean {
  const centreCodes = [centre.shortName, centre.name]
    .flatMap((value) => [normalizeKey(value), normalizeCenterHint(value), getTrueAcronym(value)])
    .filter(Boolean)
  return hints.some((hint) => {
    const hintCodes = [normalizeKey(hint), normalizeCenterHint(hint), getTrueAcronym(hint)]
      .filter(Boolean)
    return hintCodes.some((candidate) => centreCodes.some((code) => {
      if (/\d/.test(candidate) && /\d/.test(code)) return candidate === code
      return candidate === code || (candidate.length >= 3 && code.length >= 3 && (
        candidate.includes(code) || code.includes(candidate)
      ))
    }))
  })
}

export function parseDateInputBoundary(value: string, endOfDay = false): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const validationDate = new Date(Date.UTC(year, month - 1, day))
  if (
    validationDate.getUTCFullYear() !== year ||
    validationDate.getUTCMonth() !== month - 1 ||
    validationDate.getUTCDate() !== day
  ) return null
  const localAsUtc = endOfDay
    ? Date.UTC(year, month - 1, day, 23, 59, 59, 999)
    : Date.UTC(year, month - 1, day, 0, 0, 0, 0)
  const result = new Date(localAsUtc - VIETNAM_TIMEZONE_OFFSET_MS)
  return Number.isNaN(result.getTime()) ? null : result
}

export function parseSheetTimestamp(
  rawValue: unknown,
  dateOrder: SheetDateOrder = 'MDY',
): Date | null {
  const value = String(rawValue ?? '').trim()
  if (!value) return null

  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(value)
  if (isoMatch) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = isoMatch
    const localAsUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second)
    const result = new Date(localAsUtc - VIETNAM_TIMEZONE_OFFSET_MS)
    return Number.isNaN(result.getTime()) ? null : result
  }

  const localMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?)?$/i.exec(value)
  if (localMatch) {
    const [, first, second, rawYear, rawHour = '0', minute = '0', seconds = '0', meridiem] = localMatch
    const firstNumber = +first
    const secondNumber = +second
    const day = firstNumber > 12 ? firstNumber : secondNumber > 12 ? secondNumber : dateOrder === 'DMY' ? firstNumber : secondNumber
    const month = firstNumber > 12 ? secondNumber : secondNumber > 12 ? firstNumber : dateOrder === 'DMY' ? secondNumber : firstNumber
    const year = +rawYear < 100 ? 2000 + +rawYear : +rawYear
    let hour = +rawHour
    if (meridiem?.toUpperCase() === 'PM' && hour < 12) hour += 12
    if (meridiem?.toUpperCase() === 'AM' && hour === 12) hour = 0
    const localAsUtc = Date.UTC(year, month - 1, day, hour, +minute, +seconds)
    const validationDate = new Date(localAsUtc)
    if (
      validationDate.getUTCFullYear() !== year ||
      validationDate.getUTCMonth() !== month - 1 ||
      validationDate.getUTCDate() !== day
    ) return null
    return new Date(localAsUtc - VIETNAM_TIMEZONE_OFFSET_MS)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function detectSheetDateOrder(
  values: unknown[],
  fallback: SheetDateOrder = 'MDY',
): SheetDateOrder {
  let dmyEvidence = 0
  let mdyEvidence = 0

  values.forEach((rawValue) => {
    const value = String(rawValue ?? '').trim()
    const match = /^(\d{1,2})[/-](\d{1,2})[/-]\d{2,4}(?:\s|$)/.exec(value)
    if (!match) return
    const first = Number(match[1])
    const second = Number(match[2])
    if (first > 12 && second <= 12) dmyEvidence += 1
    if (second > 12 && first <= 12) mdyEvidence += 1
  })

  if (dmyEvidence > mdyEvidence) return 'DMY'
  if (mdyEvidence > dmyEvidence) return 'MDY'
  return fallback
}

export function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const numericValue = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  const date = new Date(numericValue as string | number | Date)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function extractSurveyScore(value: unknown): number | null {
  const match = String(value ?? '').match(/(?:^|[^\d.,])([1-5](?:[.,]\d+)?)(?=$|[^\d])/)
  if (!match) return null
  const score = Number(match[1].replace(',', '.'))
  return score >= 1 && score <= 5 ? score : null
}

export function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

export function round(value: number | null, precision = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const multiplier = 10 ** precision
  return Math.round(value * multiplier) / multiplier
}

function buildSheetInput(row: RawSheetRow) {
  let studentName = String(row.values[SHEET_HEADERS.studentName] || '').trim()
  let inputClassCode = String(row.values[SHEET_HEADERS.classCode] || '').trim()
  const centerHint = String(row.values[SHEET_HEADERS.centreCode] || '').trim()

  const nameShape = studentName.toUpperCase().replace(/[\u2010-\u2015]/g, '-')
  const classShape = inputClassCode.toUpperCase().replace(/[\u2010-\u2015]/g, '-')
  if (nameShape.includes('-') && /\d/.test(nameShape) && !/\d/.test(classShape) && inputClassCode.length > 4) {
    ;[studentName, inputClassCode] = [inputClassCode, studentName]
  }

  const normalizedCenterColumn = fixClassTypo(centerHint)
  const normalizedClassColumn = fixClassTypo(inputClassCode)
  if (
    normalizedCenterColumn.includes('-') &&
    normalizedCenterColumn.length > 6 &&
    (!normalizedClassColumn.includes('-') || normalizedClassColumn.length < 5)
  ) {
    inputClassCode = centerHint
  }

  const rawNormalized = fixClassTypo(inputClassCode)
  const normalizedCentre = normalizeCenterHint(centerHint)
  const centreAcronym = getTrueAcronym(normalizedCentre)
  const firstSegment = rawNormalized.split('-')[0] || ''
  const inputAcronym = getTrueAcronym(normalizeCenterHint(firstSegment))
  const isFullClassCode = (rawNormalized.match(/-/g) || []).length >= 2
  const normalizedClassCode = centreAcronym && rawNormalized && centreAcronym !== inputAcronym && !isFullClassCode
    ? `${centreAcronym}-${rawNormalized}`
    : rawNormalized

  return { studentName, inputClassCode, centerHint, normalizedClassCode }
}

export function findBestClassMatch(
  row: RawSheetRow,
  classes: MatchableClass[],
  dateOrder: SheetDateOrder = 'MDY',
): SheetMatchResult {
  const input = buildSheetInput(row)
  const comparisonInput = input.normalizedClassCode.replace(/[^A-Z0-9]/g, '').toLowerCase()
  const normalizedCentreLetters = normalizeCenterHint(input.centerHint).replace(/[^A-Z]/gi, '').toLowerCase()
  const inputJumble = getJumbleKey(input.normalizedClassCode)
  let bestMatch: MatchableClass | undefined
  let highestScore = 0
  let bestReasons: string[] = []

  for (const currentClass of classes) {
    const className = (currentClass.className || currentClass.name || '').toUpperCase()
    const comparisonClass = className.replace(/[^A-Z0-9]/g, '').toLowerCase()
    const classJumble = getJumbleKey(className)
    let score = 0
    const reasons: string[] = []

    if (comparisonInput.length > 3 && comparisonClass.includes(comparisonInput)) {
      score += 60
      reasons.push('Trùng mã lớp tương đối')
      if (comparisonClass === comparisonInput) {
        score += 20
        reasons.push('Trùng hoàn toàn mã lớp')
      }
    }

    if (inputJumble.length > 4 && inputJumble === classJumble && score < 60) {
      score += 75
      reasons.push('Khớp cấu trúc mã lớp đảo vị trí')
    }

    const classLetters = classJumble.replace(/[^A-Z]/g, '')
    const inputLetters = inputJumble.replace(/[^A-Z]/g, '')
    if (inputLetters.length >= 3 && classLetters.length >= 3 && inputJumble !== classJumble) {
      const uniqueInputLetters = Array.from(new Set(inputLetters.split('')))
      if (uniqueInputLetters.every((character) => classLetters.includes(character))) {
        score += 20
        reasons.push('Trùng tập ký tự cốt lõi')
      }
    }

    const classCentreLetters = normalizeText(
      currentClass.centre?.shortName || currentClass.centre?.name || '',
    ).replace(/[^a-z]/g, '')
    const exactCentre = Boolean(normalizedCentreLetters && classCentreLetters && normalizedCentreLetters === classCentreLetters)
    const relativeCentre = Boolean(
      normalizedCentreLetters.length >= 2 &&
      classCentreLetters.length >= 2 &&
      (normalizedCentreLetters.includes(classCentreLetters) || classCentreLetters.includes(normalizedCentreLetters)),
    )
    if (exactCentre || relativeCentre) {
      score += exactCentre ? 25 : 20
      reasons.push(exactCentre ? 'Khớp tuyệt đối cơ sở' : 'Khớp tương đối cơ sở')
    }

    const classNumber = comparisonInput.match(/\d+/)?.[0]
    if (classNumber && comparisonClass.includes(classNumber) && (exactCentre || relativeCentre) && score < 60) {
      score += 50
      reasons.push('Trùng số lớp và cơ sở')
    }

    if (score > highestScore) {
      highestScore = score
      bestMatch = currentClass
      bestReasons = reasons
    }
  }

  const understandability = extractSurveyScore(row.values[SHEET_HEADERS.teacherUnderstandability])
  const affinity = extractSurveyScore(row.values[SHEET_HEADERS.teacherAffinity])
  const rowDate = parseSheetTimestamp(
    row.values[SHEET_HEADERS.timestamp],
    dateOrder,
  )

  return {
    raw: row,
    matchedClass: highestScore >= 50 ? bestMatch : undefined,
    matchScore: highestScore,
    matchReasons: bestReasons,
    matchMethod: highestScore >= 50 && bestMatch ? 'direct' : 'unmatched',
    ...input,
    timestamp: row.values[SHEET_HEADERS.timestamp] || '',
    rowDate,
    teacherUnderstandabilityScore: understandability,
    teacherAffinityScore: affinity,
    teacherScore: average([understandability, affinity]),
  }
}

export function matchSheetRows(
  rows: RawSheetRow[],
  classes: MatchableClass[],
  dateOrder: SheetDateOrder = 'MDY',
): SheetMatchResult[] {
  const firstPass = rows.map((row) => findBestClassMatch(row, classes, dateOrder))
  return firstPass.map((item, index) => {
    if (item.matchedClass) return item
    const itemKey = getJumbleKey(item.normalizedClassCode)
    const candidates = new Map<string, { item: SheetMatchResult; support: number }>()
    for (let neighborIndex = Math.max(0, index - 5); neighborIndex <= Math.min(firstPass.length - 1, index + 5); neighborIndex += 1) {
      if (neighborIndex === index) continue
      const neighbor = firstPass[neighborIndex]
      const neighborCode = neighbor.normalizedClassCode
      if (!neighborCode.includes('-')) continue

      const segments = item.normalizedClassCode.split('-')
      const itemCore = segments.find((segment) => /\d/.test(segment)) || segments.at(-1) || ''
      const neighborKey = getJumbleKey(neighborCode)
      const isContained = itemCore.length >= 4 && neighborCode.includes(itemCore)
      const isJumbledEquivalent = itemKey.length > 3 && itemKey === neighborKey
      const itemDigits = item.normalizedClassCode.replace(/[^0-9]/g, '')
      const neighborDigits = neighborCode.replace(/[^0-9]/g, '')
      let isSubsetRescue = false
      if (itemDigits && itemDigits === neighborDigits) {
        const itemLetters = item.normalizedClassCode.replace(/[^A-Z]/g, '')
        const neighborLetters = neighborCode.replace(/[^A-Z]/g, '')
        if (itemLetters.length >= 3 && neighborLetters.length >= 3) {
          const shorter = itemLetters.length <= neighborLetters.length ? itemLetters : neighborLetters
          const longer = itemLetters.length <= neighborLetters.length ? neighborLetters : itemLetters
          isSubsetRescue = Array.from(new Set(shorter)).every((character) => longer.includes(character))
        }
      }
      if (!isContained && !isJumbledEquivalent && !isSubsetRescue) continue

      const current = candidates.get(neighborCode) || { item: neighbor, support: 0 }
      current.support += 1
      candidates.set(neighborCode, current)
    }
    const best = Array.from(candidates.values()).sort((first, second) => {
      if (first.item.matchedClass && !second.item.matchedClass) return -1
      if (!first.item.matchedClass && second.item.matchedClass) return 1
      const lengthDifference = second.item.normalizedClassCode.length - first.item.normalizedClassCode.length
      return lengthDifference || second.support - first.support
    })[0]
    if (!best) return item
    if (best.item.matchedClass) {
      return {
        ...item,
        matchedClass: best.item.matchedClass,
        matchScore: 90,
        matchReasons: ['Suy luận từ dòng lân cận'],
        matchMethod: 'inferred',
      }
    }
    if (
      best.item.normalizedClassCode.length > item.normalizedClassCode.length ||
      (
        best.item.normalizedClassCode.length === item.normalizedClassCode.length &&
        best.item.normalizedClassCode !== item.normalizedClassCode
      )
    ) {
      return { ...item, normalizedClassCode: best.item.normalizedClassCode }
    }
    return item
  })
}

export function sortSlotsByDate(slots: MatchableSlot[] = []): MatchableSlot[] {
  return slots
    .filter((slot) => Boolean(slot.date))
    .slice()
    .sort((first, second) => new Date(first.date || 0).getTime() - new Date(second.date || 0).getTime())
}

export function isTeacherPointExemptStudent(
  student: MatchableStudent,
  slots: MatchableSlot[] = [],
): boolean {
  const studentId = student.student?.id
  const hasAttendance = Boolean(studentId && slots.some((slot) =>
    slot.studentAttendance?.some((attendance) => attendance.student?.id === studentId),
  ))
  const completionStatus = student.completionInfo?.status?.trim().toUpperCase()
  const completionReason = student.completionInfo?.reason
    ?.trim()
    .toUpperCase()
    .replace(/\s+/g, '_') || ''
  if (completionStatus === 'WAITING' && !hasAttendance) return true
  if (student.activeInClass === false && !hasAttendance) return true
  return TEACHER_POINT_EXEMPTED_REASONS.has(completionReason)
}

export function classHasTeacherPointSessionInRange(
  currentClass: MatchableClass,
  start: Date,
  end: Date,
): boolean {
  const slots = sortSlotsByDate(currentClass.slots)
  return TEACHER_POINT_SESSION_INDICES.some((index) => {
    const date = slots[index]?.date ? new Date(slots[index].date as string) : null
    return Boolean(date && !Number.isNaN(date.getTime()) && date >= start && date <= end)
  })
}

export function eligibleTeacherPointStudents(currentClass: MatchableClass): MatchableStudent[] {
  const slots = sortSlotsByDate(currentClass.slots)
  return (currentClass.students || []).filter((student) => !isTeacherPointExemptStudent(student, slots))
}

export function isTeacherPointEligibleClass(
  currentClass: MatchableClass,
  start: Date,
  end: Date,
): boolean {
  return !CLASS_INACTIVE_STATUSES.has(currentClass.status?.toUpperCase() || '') &&
    classHasTeacherPointSessionInRange(currentClass, start, end)
}

export function resolveRosterStudentId(
  studentName: string,
  currentClass: MatchableClass,
): string {
  const studentKey = normalizeKey(studentName)
  const exact = currentClass.students?.find((student) => normalizeKey(student.student?.fullName) === studentKey)
  if (exact?.student?.id) return exact.student.id
  return `sheet:${studentKey || normalizeKey(studentName)}`
}

export function teacherPointScore(rate: number | null): number | null {
  if (rate === null) return null
  if (rate >= 95) return 5
  if (rate >= 81) return 4
  if (rate >= 71) return 3
  if (rate >= 51) return 2
  return 1
}
