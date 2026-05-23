/**
 * Date Formatting Utilities
 * 
 * Formats dates following Vietnamese conventions:
 * - Display format: DD/MM/YYYY
 * - Input/Storage format: YYYY-MM-DD (ISO 8601)
 * - Vietnamese day/month names
 * 
 * Requirements: 13.22, 13.23, 26.5
 * 
 * @example
 * ```ts
 * formatDate(new Date()) // "15/01/2024"
 * formatDateForInput(new Date()) // "2024-01-15"
 * formatDateLong(new Date()) // "15 tháng 1 năm 2024"
 * formatDateFull(new Date()) // "Thứ hai, 15 tháng 1 năm 2024"
 * ```
 */

/**
 * Format date for display (DD/MM/YYYY)
 * 
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date | string | number): string {
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
 * Format date for input/storage (YYYY-MM-DD)
 * ISO 8601 format for forms and database
 * 
 * @param date - Date to format
 * @returns ISO date string
 */
export function formatDateForInput(date: Date | string | number): string {
  const timestamp = new Date(date)

  if (isNaN(timestamp.getTime())) {
    return ''
  }

  const year = timestamp.getFullYear()
  const month = (timestamp.getMonth() + 1).toString().padStart(2, '0')
  const day = timestamp.getDate().toString().padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Format date in long format (15 tháng 1 năm 2024)
 * 
 * @param date - Date to format
 * @returns Long format date string
 */
export function formatDateLong(date: Date | string | number): string {
  const timestamp = new Date(date)

  if (isNaN(timestamp.getTime())) {
    return 'Không xác định'
  }

  const day = timestamp.getDate()
  const month = timestamp.getMonth() + 1
  const year = timestamp.getFullYear()

  return `${day} tháng ${month} năm ${year}`
}

/**
 * Format date with day of week (Thứ hai, 15/01/2024)
 * 
 * @param date - Date to format
 * @returns Date with day of week
 */
export function formatDateWithDay(date: Date | string | number): string {
  const timestamp = new Date(date)

  if (isNaN(timestamp.getTime())) {
    return 'Không xác định'
  }

  const dayOfWeek = getDayOfWeek(timestamp)
  const dateStr = formatDate(timestamp)

  return `${dayOfWeek}, ${dateStr}`
}

/**
 * Format date in full format (Thứ hai, 15 tháng 1 năm 2024)
 * 
 * @param date - Date to format
 * @returns Full format date string
 */
export function formatDateFull(date: Date | string | number): string {
  const timestamp = new Date(date)

  if (isNaN(timestamp.getTime())) {
    return 'Không xác định'
  }

  const dayOfWeek = getDayOfWeek(timestamp)
  const dateLong = formatDateLong(timestamp)

  return `${dayOfWeek}, ${dateLong}`
}

/**
 * Get Vietnamese day of week
 * 
 * @param date - Date to get day of week
 * @returns Vietnamese day name
 */
export function getDayOfWeek(date: Date | string | number): string {
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
 * Get Vietnamese month name
 * 
 * @param monthIndex - Month index (0-11)
 * @returns Vietnamese month name
 */
export function getMonthName(monthIndex: number): string {
  const months = [
    'Tháng 1',
    'Tháng 2',
    'Tháng 3',
    'Tháng 4',
    'Tháng 5',
    'Tháng 6',
    'Tháng 7',
    'Tháng 8',
    'Tháng 9',
    'Tháng 10',
    'Tháng 11',
    'Tháng 12',
  ]

  if (monthIndex < 0 || monthIndex > 11) {
    return 'Không xác định'
  }

  return months[monthIndex]
}

/**
 * Format month and year (Tháng 1 năm 2024)
 * 
 * @param date - Date to format
 * @returns Month and year string
 */
export function formatMonthYear(date: Date | string | number): string {
  const timestamp = new Date(date)

  if (isNaN(timestamp.getTime())) {
    return 'Không xác định'
  }

  const month = timestamp.getMonth() + 1
  const year = timestamp.getFullYear()

  return `Tháng ${month} năm ${year}`
}

/**
 * Format date range
 * 
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted date range
 */
export function formatDateRange(
  startDate: Date | string | number,
  endDate: Date | string | number
): string {
  const start = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Không xác định'
  }

  const startStr = formatDate(start)
  const endStr = formatDate(end)

  return `${startStr} - ${endStr}`
}

/**
 * Parse Vietnamese date string (DD/MM/YYYY) to Date
 * 
 * @param dateStr - Date string in DD/MM/YYYY format
 * @returns Parsed Date object
 */
export function parseVietnameseDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null
  }

  const parts = dateStr.split('/')
  
  if (parts.length !== 3) {
    return null
  }

  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
  const year = parseInt(parts[2], 10)

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return null
  }

  const date = new Date(year, month, day)

  // Validate date
  if (
    date.getDate() !== day ||
    date.getMonth() !== month ||
    date.getFullYear() !== year
  ) {
    return null
  }

  return date
}

/**
 * Check if date is valid
 * 
 * @param date - Date to check
 * @returns Whether date is valid
 */
export function isValidDate(date: Date | string | number): boolean {
  const timestamp = new Date(date)
  return !isNaN(timestamp.getTime())
}

/**
 * Get today's date at midnight
 * 
 * @returns Today's date at 00:00:00
 */
export function getToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

/**
 * Get tomorrow's date at midnight
 * 
 * @returns Tomorrow's date at 00:00:00
 */
export function getTomorrow(): Date {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow
}

/**
 * Get yesterday's date at midnight
 * 
 * @returns Yesterday's date at 00:00:00
 */
export function getYesterday(): Date {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  return yesterday
}

/**
 * Check if two dates are the same day
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Whether dates are the same day
 */
export function isSameDay(
  date1: Date | string | number,
  date2: Date | string | number
): boolean {
  const d1 = new Date(date1)
  const d2 = new Date(date2)

  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    return false
  }

  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  )
}

/**
 * Check if date is in the past
 * 
 * @param date - Date to check
 * @returns Whether date is in the past
 */
export function isPast(date: Date | string | number): boolean {
  const timestamp = new Date(date)
  const now = new Date()

  if (isNaN(timestamp.getTime())) {
    return false
  }

  return timestamp < now
}

/**
 * Check if date is in the future
 * 
 * @param date - Date to check
 * @returns Whether date is in the future
 */
export function isFuture(date: Date | string | number): boolean {
  const timestamp = new Date(date)
  const now = new Date()

  if (isNaN(timestamp.getTime())) {
    return false
  }

  return timestamp > now
}

/**
 * Add days to date
 * 
 * @param date - Base date
 * @param days - Number of days to add
 * @returns New date
 */
export function addDays(date: Date | string | number, days: number): Date {
  const timestamp = new Date(date)
  timestamp.setDate(timestamp.getDate() + days)
  return timestamp
}

/**
 * Add months to date
 * 
 * @param date - Base date
 * @param months - Number of months to add
 * @returns New date
 */
export function addMonths(date: Date | string | number, months: number): Date {
  const timestamp = new Date(date)
  timestamp.setMonth(timestamp.getMonth() + months)
  return timestamp
}

/**
 * Add years to date
 * 
 * @param date - Base date
 * @param years - Number of years to add
 * @returns New date
 */
export function addYears(date: Date | string | number, years: number): Date {
  const timestamp = new Date(date)
  timestamp.setFullYear(timestamp.getFullYear() + years)
  return timestamp
}

/**
 * Get difference in days between two dates
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days difference
 */
export function getDaysDifference(
  date1: Date | string | number,
  date2: Date | string | number
): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)

  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    return 0
  }

  const diffMs = Math.abs(d2.getTime() - d1.getTime())
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}
