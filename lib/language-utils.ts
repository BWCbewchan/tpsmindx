/**
 * Vietnamese Language Utilities
 * 
 * Utilities for detecting, validating, and formatting Vietnamese content.
 * 
 * Requirements: 26.2, 26.3, 26.5, 26.8, 26.19
 * 
 * @example
 * ```tsx
 * isVietnamese("Xin chào") // true
 * hasDiacritics("Xin chào") // true
 * formatDate(new Date()) // "15/01/2024"
 * formatCurrency(1234567) // "1.234.567₫"
 * ```
 */

/**
 * Technical terms that are allowed to remain in English
 */
export const TECHNICAL_TERMS = [
  'API',
  'URL',
  'email',
  'HTML',
  'CSS',
  'JavaScript',
  'JSON',
  'XML',
  'HTTP',
  'HTTPS',
  'SDK',
  'UI',
  'UX',
  'SEO',
  'SQL',
  'REST',
  'GraphQL',
  'OAuth',
  'JWT',
  'CRUD',
  'PDF',
  'PNG',
  'JPG',
  'JPEG',
  'GIF',
  'SVG',
  'MP3',
  'MP4',
  'ZIP',
  'CSV',
  'ID',
  'OK',
] as const

/**
 * Vietnamese diacritic characters
 */
const VIETNAMESE_DIACRITICS = [
  'à', 'á', 'ả', 'ã', 'ạ',
  'ă', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ',
  'â', 'ấ', 'ầ', 'ẩ', 'ẫ', 'ậ',
  'đ',
  'è', 'é', 'ẻ', 'ẽ', 'ẹ',
  'ê', 'ế', 'ề', 'ể', 'ễ', 'ệ',
  'ì', 'í', 'ỉ', 'ĩ', 'ị',
  'ò', 'ó', 'ỏ', 'õ', 'ọ',
  'ô', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ',
  'ơ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ',
  'ù', 'ú', 'ủ', 'ũ', 'ụ',
  'ư', 'ứ', 'ừ', 'ử', 'ữ', 'ự',
  'ỳ', 'ý', 'ỷ', 'ỹ', 'ỵ',
  // Uppercase
  'À', 'Á', 'Ả', 'Ã', 'Ạ',
  'Ă', 'Ắ', 'Ằ', 'Ẳ', 'Ẵ', 'Ặ',
  'Â', 'Ấ', 'Ầ', 'Ẩ', 'Ẫ', 'Ậ',
  'Đ',
  'È', 'É', 'Ẻ', 'Ẽ', 'Ẹ',
  'Ê', 'Ế', 'Ề', 'Ể', 'Ễ', 'Ệ',
  'Ì', 'Í', 'Ỉ', 'Ĩ', 'Ị',
  'Ò', 'Ó', 'Ỏ', 'Õ', 'Ọ',
  'Ô', 'Ố', 'Ồ', 'Ổ', 'Ỗ', 'Ộ',
  'Ơ', 'Ớ', 'Ờ', 'Ở', 'Ỡ', 'Ợ',
  'Ù', 'Ú', 'Ủ', 'Ũ', 'Ụ',
  'Ư', 'Ứ', 'Ừ', 'Ử', 'Ữ', 'Ự',
  'Ỳ', 'Ý', 'Ỷ', 'Ỹ', 'Ỵ',
]

/**
 * Check if text contains Vietnamese characters
 */
export function isVietnamese(text: string): boolean {
  if (!text || text.trim() === '') return false
  
  // Check if text contains any Vietnamese diacritic characters
  return VIETNAMESE_DIACRITICS.some(char => text.includes(char))
}

/**
 * Check if text has proper Vietnamese diacritics
 */
export function hasDiacritics(text: string): boolean {
  if (!text || text.trim() === '') return false
  
  // If text contains Vietnamese characters, it has diacritics
  return isVietnamese(text)
}

/**
 * Check if a term is an approved technical term
 */
export function isTechnicalTerm(text: string): boolean {
  if (!text || text.trim() === '') return false
  
  const trimmed = text.trim()
  return TECHNICAL_TERMS.includes(trimmed as any)
}

/**
 * Check if text is a number or punctuation
 */
export function isNumberOrPunctuation(text: string): boolean {
  if (!text || text.trim() === '') return false
  
  // Check if text is only numbers, spaces, and punctuation
  return /^[\d\s.,;:!?()[\]{}"'`\-–—]+$/.test(text)
}

/**
 * Format a date in Vietnamese format (DD/MM/YYYY)
 * 
 * @example
 * formatDate(new Date('2024-01-15')) // "15/01/2024"
 */
export function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  
  return `${day}/${month}/${year}`
}

/**
 * Format a date in formal Vietnamese format
 * 
 * @example
 * formatDateFormal(new Date('2024-01-15')) // "Ngày 15 tháng 01 năm 2024"
 */
export function formatDateFormal(date: Date): string {
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  
  return `Ngày ${day} tháng ${month.toString().padStart(2, '0')} năm ${year}`
}

/**
 * Format a date for form inputs (YYYY-MM-DD)
 * 
 * @example
 * formatDateInput(new Date('2024-01-15')) // "2024-01-15"
 */
export function formatDateInput(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  
  return `${year}-${month}-${day}`
}

/**
 * Format currency in VND (Vietnamese Dong)
 * 
 * @example
 * formatCurrency(1234567) // "1.234.567₫"
 * formatCurrency(1234567, 'comma') // "1,234,567₫"
 */
export function formatCurrency(
  amount: number,
  separator: 'period' | 'comma' = 'period'
): string {
  // Round to nearest integer (VND has no decimal places)
  const rounded = Math.round(amount)
  
  // Format with thousand separators
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator === 'period' ? '.' : ',')
  
  return `${formatted}₫`
}

/**
 * Format a number with thousand separators
 * 
 * @example
 * formatNumber(1234567) // "1.234.567"
 * formatNumber(1234567.89, 'comma', 2) // "1,234,567.89"
 */
export function formatNumber(
  value: number,
  separator: 'period' | 'comma' = 'period',
  decimals: number = 0
): string {
  const fixed = value.toFixed(decimals)
  const [integer, decimal] = fixed.split('.')
  
  const formattedInteger = integer.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    separator === 'period' ? '.' : ','
  )
  
  if (decimals > 0 && decimal) {
    const decimalSeparator = separator === 'period' ? ',' : '.'
    return `${formattedInteger}${decimalSeparator}${decimal}`
  }
  
  return formattedInteger
}

/**
 * Format relative time in Vietnamese
 * 
 * @example
 * formatRelativeTime(new Date(Date.now() - 2 * 60 * 1000)) // "2 phút trước"
 * formatRelativeTime(new Date(Date.now() - 3 * 60 * 60 * 1000)) // "3 giờ trước"
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)
  
  if (diffSeconds < 60) {
    return 'Vừa xong'
  } else if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`
  } else if (diffHours < 24) {
    return `${diffHours} giờ trước`
  } else if (diffDays < 7) {
    return `${diffDays} ngày trước`
  } else if (diffWeeks < 4) {
    return `${diffWeeks} tuần trước`
  } else if (diffMonths < 12) {
    return `${diffMonths} tháng trước`
  } else {
    return `${diffYears} năm trước`
  }
}

/**
 * Format timestamp - relative for recent, absolute for old
 * 
 * @example
 * formatTimestamp(new Date(Date.now() - 2 * 60 * 1000)) // "2 phút trước"
 * formatTimestamp(new Date('2023-01-15')) // "15/01/2023"
 */
export function formatTimestamp(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  
  // Use relative time for events within 24 hours
  if (diffHours < 24) {
    return formatRelativeTime(date)
  }
  
  // Use absolute date for older events
  return formatDate(date)
}

/**
 * Format time in 24-hour format
 * 
 * @example
 * formatTime(new Date('2024-01-15T14:30:00')) // "14:30"
 */
export function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  
  return `${hours}:${minutes}`
}

/**
 * Format time in formal Vietnamese format
 * 
 * @example
 * formatTimeFormal(new Date('2024-01-15T14:30:00')) // "14 giờ 30 phút"
 */
export function formatTimeFormal(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  
  return `${hours} giờ ${minutes.toString().padStart(2, '0')} phút`
}

/**
 * Format Vietnamese address
 * 
 * @example
 * formatAddress({
 *   street: "123 Nguyễn Huệ",
 *   ward: "Phường Bến Nghé",
 *   district: "Quận 1",
 *   city: "TP. Hồ Chí Minh"
 * }) // "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"
 */
export function formatAddress(address: {
  street?: string
  ward?: string
  district?: string
  city?: string
}): string {
  const parts = [
    address.street,
    address.ward,
    address.district,
    address.city,
  ].filter(Boolean)
  
  return parts.join(', ')
}

/**
 * Validate Vietnamese phone number
 * 
 * @example
 * isValidPhoneNumber("0123456789") // true
 * isValidPhoneNumber("123") // false
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Vietnamese phone numbers: 10 digits starting with 0
  return /^0\d{9}$/.test(phone.replace(/\s/g, ''))
}

/**
 * Format Vietnamese phone number
 * 
 * @example
 * formatPhoneNumber("0123456789") // "0123 456 789"
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\s/g, '')
  
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`
  }
  
  return phone
}

/**
 * Get Vietnamese day of week
 * 
 * @example
 * getDayOfWeek(new Date('2024-01-15')) // "Thứ hai"
 */
export function getDayOfWeek(date: Date): string {
  const days = [
    'Chủ nhật',
    'Thứ hai',
    'Thứ ba',
    'Thứ tư',
    'Thứ năm',
    'Thứ sáu',
    'Thứ bảy',
  ]
  
  return days[date.getDay()]
}

/**
 * Get Vietnamese month name
 * 
 * @example
 * getMonthName(0) // "Tháng 1"
 */
export function getMonthName(monthIndex: number): string {
  return `Tháng ${monthIndex + 1}`
}
