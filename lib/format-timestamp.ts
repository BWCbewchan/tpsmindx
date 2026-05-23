/**
 * Timestamp Formatting Utilities
 * 
 * Formats timestamps following Vietnamese conventions:
 * - Relative time for recent events (< 24 hours)
 * - Absolute date for older events
 * 
 * Requirements: 13.19, 26.5
 * 
 * @example
 * ```ts
 * formatTimestamp(new Date()) // "Vừa xong"
 * formatTimestamp(subMinutes(new Date(), 5)) // "5 phút trước"
 * formatTimestamp(subHours(new Date(), 2)) // "2 giờ trước"
 * formatTimestamp(subDays(new Date(), 2)) // "15/01/2024"
 * ```
 */

/**
 * Format timestamp as relative time (< 24h) or absolute date (>= 24h)
 */
export function formatTimestamp(date: Date | string | number): string {
  const timestamp = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - timestamp.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  // Invalid date
  if (isNaN(timestamp.getTime())) {
    return 'Không xác định'
  }

  // Future date
  if (diffMs < 0) {
    return formatAbsoluteDate(timestamp)
  }

  // Just now (< 1 minute)
  if (diffSeconds < 60) {
    return 'Vừa xong'
  }

  // Minutes ago (< 1 hour)
  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`
  }

  // Hours ago (< 24 hours)
  if (diffHours < 24) {
    return `${diffHours} giờ trước`
  }

  // Days ago (>= 24 hours) - show absolute date
  return formatAbsoluteDate(timestamp)
}

/**
 * Format as relative time only (always show relative, even for old dates)
 */
export function formatRelativeTime(date: Date | string | number): string {
  const timestamp = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - timestamp.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  // Invalid date
  if (isNaN(timestamp.getTime())) {
    return 'Không xác định'
  }

  // Future date
  if (diffMs < 0) {
    const absDiffSeconds = Math.abs(diffSeconds)
    const absDiffMinutes = Math.floor(absDiffSeconds / 60)
    const absDiffHours = Math.floor(absDiffMinutes / 60)
    const absDiffDays = Math.floor(absDiffHours / 24)

    if (absDiffSeconds < 60) return 'Trong vài giây nữa'
    if (absDiffMinutes < 60) return `Trong ${absDiffMinutes} phút nữa`
    if (absDiffHours < 24) return `Trong ${absDiffHours} giờ nữa`
    return `Trong ${absDiffDays} ngày nữa`
  }

  // Just now
  if (diffSeconds < 60) return 'Vừa xong'

  // Minutes
  if (diffMinutes < 60) return `${diffMinutes} phút trước`

  // Hours
  if (diffHours < 24) return `${diffHours} giờ trước`

  // Days
  if (diffDays < 7) return `${diffDays} ngày trước`

  // Weeks
  if (diffWeeks < 4) return `${diffWeeks} tuần trước`

  // Months
  if (diffMonths < 12) return `${diffMonths} tháng trước`

  // Years
  return `${diffYears} năm trước`
}

/**
 * Format as absolute date (DD/MM/YYYY)
 */
export function formatAbsoluteDate(date: Date | string | number): string {
  const timestamp = new Date(date)

  if (isNaN(timestamp.getTime())) {
    return 'Không xác định'
  }

  const day = timestamp.getDate().toString().padStart(2, '0')
  const month = (timestamp.getMonth() + 1).toString().padStart(2, '0')
  const year = timestamp.getFullYear()

  return `${day}/${month}/${year}`
}

/**
 * Format as absolute date with time (DD/MM/YYYY HH:mm)
 */
export function formatAbsoluteDateTime(date: Date | string | number): string {
  const timestamp = new Date(date)

  if (isNaN(timestamp.getTime())) {
    return 'Không xác định'
  }

  const dateStr = formatAbsoluteDate(timestamp)
  const hours = timestamp.getHours().toString().padStart(2, '0')
  const minutes = timestamp.getMinutes().toString().padStart(2, '0')

  return `${dateStr} ${hours}:${minutes}`
}

/**
 * Format as time only (HH:mm)
 */
export function formatTime(date: Date | string | number): string {
  const timestamp = new Date(date)

  if (isNaN(timestamp.getTime())) {
    return 'Không xác định'
  }

  const hours = timestamp.getHours().toString().padStart(2, '0')
  const minutes = timestamp.getMinutes().toString().padStart(2, '0')

  return `${hours}:${minutes}`
}

/**
 * Format as Vietnamese day of week
 */
export function formatDayOfWeek(date: Date | string | number): string {
  const timestamp = new Date(date)

  if (isNaN(timestamp.getTime())) {
    return 'Không xác định'
  }

  const days = [
    'Chủ nhật',
    'Thứ hai',
    'Thứ ba',
    'Thứ tư',
    'Thứ năm',
    'Thứ sáu',
    'Thứ bảy',
  ]

  return days[timestamp.getDay()]
}

/**
 * Format as full Vietnamese date (Thứ hai, 15/01/2024)
 */
export function formatFullDate(date: Date | string | number): string {
  const timestamp = new Date(date)

  if (isNaN(timestamp.getTime())) {
    return 'Không xác định'
  }

  const dayOfWeek = formatDayOfWeek(timestamp)
  const dateStr = formatAbsoluteDate(timestamp)

  return `${dayOfWeek}, ${dateStr}`
}

/**
 * Check if date is today
 */
export function isToday(date: Date | string | number): boolean {
  const timestamp = new Date(date)
  const today = new Date()

  return (
    timestamp.getDate() === today.getDate() &&
    timestamp.getMonth() === today.getMonth() &&
    timestamp.getFullYear() === today.getFullYear()
  )
}

/**
 * Check if date is yesterday
 */
export function isYesterday(date: Date | string | number): boolean {
  const timestamp = new Date(date)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  return (
    timestamp.getDate() === yesterday.getDate() &&
    timestamp.getMonth() === yesterday.getMonth() &&
    timestamp.getFullYear() === yesterday.getFullYear()
  )
}

/**
 * Format with "Hôm nay", "Hôm qua" for recent dates
 */
export function formatSmartDate(date: Date | string | number): string {
  const timestamp = new Date(date)

  if (isNaN(timestamp.getTime())) {
    return 'Không xác định'
  }

  if (isToday(timestamp)) {
    return `Hôm nay, ${formatTime(timestamp)}`
  }

  if (isYesterday(timestamp)) {
    return `Hôm qua, ${formatTime(timestamp)}`
  }

  return formatAbsoluteDateTime(timestamp)
}
