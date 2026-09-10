export const CANONICAL_CENTERS = [
  '3 tháng 2',
  'Hải Thượng Lãn Ông',
  'Him Lam ( Nguyễn Thị Thập )',
  'Lê Văn Việt',
  'Lũy Bán Bích',
  'Mizuki',
  'Nguyễn Duy Trinh',
  'Nguyễn Xí',
  'Phạm Ngũ Lão',
  'Phạm Văn Đồng',
  'Phan Văn Trị',
  'Phan Xích Long',
  'Phú Mỹ Hưng',
  'Quang Trung',
  'Song Hành',
  'Tây Thạnh',
  'Tên Lửa',
  'Tô Ký',
  'Trường Chinh',
  'Vinhome Central Park (Bình Thạnh)',
  'Vinhome Grand Park (Q9-Thủ Đức)',
] as const

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeCheckoutCenter(name: unknown): string {
  const raw = collapseWhitespace(String(name ?? ''))
  if (!raw) return ''

  for (const center of CANONICAL_CENTERS) {
    if (raw.toLowerCase() === center.toLowerCase()) return center
  }
  for (const center of CANONICAL_CENTERS) {
    if (raw.toLowerCase().includes(center.toLowerCase())) return center
  }
  if (/3\s*tháng\s*2|3\/2/i.test(raw)) return '3 tháng 2'
  if (/nguyễn\s*thị\s*thập|him\s*lam/i.test(raw)) return 'Him Lam ( Nguyễn Thị Thập )'
  if (/grand\s*park/i.test(raw)) return 'Vinhome Grand Park (Q9-Thủ Đức)'
  if (/central\s*park/i.test(raw)) return 'Vinhome Central Park (Bình Thạnh)'
  return raw.replace(/^(HCM|HN|ĐN|BD)\s*-\s*(\d+[A-Z]*\s*)?/i, '').trim() || raw
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

function normalizedCenterValue(columnName: string): string {
  return `regexp_replace(TRIM(COALESCE(${columnName}, '')), '\\s+', ' ', 'g')`
}

export function checkoutCenterSqlExpression(columnName: string): string {
  const value = normalizedCenterValue(columnName)
  const canonicalCases = CANONICAL_CENTERS.map((center) => {
    const pattern = center.split(/\s+/).map(escapeRegex).join('\\s+')
    return `WHEN ${value} ~* '${escapeSqlLiteral(pattern)}' THEN '${escapeSqlLiteral(center)}'`
  }).join(' ')

  return `CASE
    ${canonicalCases}
    WHEN ${value} ~* '3\\s*tháng\\s*2|3/2' THEN '3 tháng 2'
    WHEN ${value} ~* 'nguyễn\\s*thị\\s*thập|him\\s*lam' THEN 'Him Lam ( Nguyễn Thị Thập )'
    WHEN ${value} ~* 'grand\\s*park' THEN 'Vinhome Grand Park (Q9-Thủ Đức)'
    WHEN ${value} ~* 'central\\s*park' THEN 'Vinhome Central Park (Bình Thạnh)'
    ELSE regexp_replace(${value}, '^(HCM|HN|ĐN|BD)\\s*-\\s*(\\d+[A-Z]*\\s*)?', '', 'i')
  END`
}