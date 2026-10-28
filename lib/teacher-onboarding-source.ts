export const ONBOARDING_HEADERS = [
  "No",
  "Full name",
  "Code",
  "User name",
  "Work email",
  "Personal email",
  "Phone number",
  "Status (update)",
  "Centers",
  "Khối final",
  "Role",
  "Course line",
  "Rank",
  "Joined date",
  "Teacher point",
  "Data HR (Raw)",
  "Status check",
  "BU check",
  "Khối check",
  "CHECK",
  "TE quản lý",
  "Leader quản lý",
  "Rate K12 check",
  "Rank K12 check",
] as const;

function onboardingRows(csv: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell.trim()); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row)
      row = []; cell = ''
      if (char === '\r' && csv[i + 1] === '\n') i++
    } else cell += char
  }
  if (quoted) throw new Error('Dữ liệu CSV không hợp lệ')
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row)
  return rows.slice(2).map(values => Object.fromEntries(ONBOARDING_HEADERS.map((header, index) => [header, values[index] || ''])))
}

export function parseOnboardingCsv(csv: string, email: string): Record<string, string> | null {
  const target = email.trim().toLowerCase()
  if (!target) return null
  const matches = onboardingRows(csv).filter(row => row['Work email']?.trim().toLowerCase() === target)
  if (matches.length > 1) throw new Error('Nguồn dữ liệu có nhiều hồ sơ cùng email. Vui lòng liên hệ quản lý.')
  return matches[0] || null
}

const normalizeLookup = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
export function findOnboardingMatches(csv: string, query: string): Record<string, string>[] {
  const normalized = normalizeLookup(query)
  if (normalized.length < 2) return []
  const rows = onboardingRows(csv)
  const exact = rows.filter(row => ['Code','User name','Work email'].some(key => normalizeLookup(row[key] || '') === normalized))
  return exact.length ? exact : rows.filter(row => normalizeLookup(row['Full name'] || '').includes(normalized)).slice(0, 13)
}

async function fetchOnboardingCsv(): Promise<string> {
  const url = process.env.TEACHER_ONBOARDING_CSV_URL?.trim()
  if (!url) throw new Error('Nguồn dữ liệu giáo viên chưa được cấu hình')
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error('Không thể kết nối nguồn dữ liệu giáo viên. Vui lòng thử lại sau.')
  return response.text()
}

export async function loadTeacherOnboardingMatches(query: string) {
  return findOnboardingMatches(await fetchOnboardingCsv(), query)
}

export async function loadTeacherOnboarding(email: string): Promise<Record<string, string> | null> {
  return parseOnboardingCsv(await fetchOnboardingCsv(), email)
}
