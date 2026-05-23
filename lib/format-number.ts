/**
 * Number Formatting Utilities
 * 
 * Formats numbers following Vietnamese conventions:
 * - Thousand separator: period (.) - e.g., 1.234.567
 * - Decimal separator: comma (,) - e.g., 3,14
 * 
 * Requirements: 13.20
 * 
 * @example
 * ```ts
 * formatNumber(1234567) // "1.234.567"
 * formatNumber(3.14159, 2) // "3,14"
 * formatNumberCompact(1234567) // "1,2 triệu"
 * formatPercent(0.85) // "85%"
 * ```
 */

/**
 * Format number with Vietnamese thousand separators
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string
 */
export function formatNumber(value: number | string, decimals: number = 0): string {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return '0'
  }

  // Round to specified decimals
  const rounded = decimals > 0 
    ? num.toFixed(decimals)
    : Math.round(num).toString()

  // Split integer and decimal parts
  const [integerPart, decimalPart] = rounded.split('.')

  // Add thousand separators (period)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  // Return with decimal part if exists (comma separator)
  if (decimalPart) {
    return `${formattedInteger},${decimalPart}`
  }

  return formattedInteger
}

/**
 * Format number in compact form (K, M, B)
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Compact number string
 */
export function formatNumberCompact(value: number | string, decimals: number = 1): string {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return '0'
  }

  const absNum = Math.abs(num)
  const sign = num < 0 ? '-' : ''

  // Billion (tỷ)
  if (absNum >= 1_000_000_000) {
    const billions = (absNum / 1_000_000_000).toFixed(decimals)
    return `${sign}${billions.replace('.', ',')} tỷ`
  }

  // Million (triệu)
  if (absNum >= 1_000_000) {
    const millions = (absNum / 1_000_000).toFixed(decimals)
    return `${sign}${millions.replace('.', ',')} triệu`
  }

  // Thousand (nghìn/K)
  if (absNum >= 1_000) {
    const thousands = (absNum / 1_000).toFixed(decimals)
    return `${sign}${thousands.replace('.', ',')} nghìn`
  }

  return `${sign}${absNum}`
}

/**
 * Format as percentage
 * 
 * @param value - Number between 0 and 1 (or 0-100 if isPercent is true)
 * @param decimals - Number of decimal places (default: 0)
 * @param isPercent - Whether input is already a percentage (default: false)
 * @returns Formatted percentage string
 */
export function formatPercent(
  value: number | string,
  decimals: number = 0,
  isPercent: boolean = false
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return '0%'
  }

  const percent = isPercent ? num : num * 100
  const rounded = percent.toFixed(decimals)

  // Replace decimal point with comma
  return `${rounded.replace('.', ',')}%`
}

/**
 * Format as ordinal number (Vietnamese)
 * 
 * @param value - Number to format
 * @returns Ordinal string
 */
export function formatOrdinal(value: number | string): string {
  const num = typeof value === 'string' ? parseInt(value) : value

  if (isNaN(num)) {
    return 'Thứ 0'
  }

  return `Thứ ${num}`
}

/**
 * Format file size
 * 
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number | string, decimals: number = 1): string {
  const num = typeof bytes === 'string' ? parseFloat(bytes) : bytes

  if (isNaN(num) || num === 0) {
    return '0 B'
  }

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(num) / Math.log(k))

  const value = (num / Math.pow(k, i)).toFixed(decimals)
  
  return `${value.replace('.', ',')} ${sizes[i]}`
}

/**
 * Format duration in seconds to human-readable format
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number | string): string {
  const num = typeof seconds === 'string' ? parseFloat(seconds) : seconds

  if (isNaN(num) || num < 0) {
    return '0 giây'
  }

  const hours = Math.floor(num / 3600)
  const minutes = Math.floor((num % 3600) / 60)
  const secs = Math.floor(num % 60)

  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours} giờ`)
  }

  if (minutes > 0) {
    parts.push(`${minutes} phút`)
  }

  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs} giây`)
  }

  return parts.join(' ')
}

/**
 * Format range of numbers
 * 
 * @param min - Minimum value
 * @param max - Maximum value
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted range string
 */
export function formatRange(
  min: number | string,
  max: number | string,
  decimals: number = 0
): string {
  const minNum = typeof min === 'string' ? parseFloat(min) : min
  const maxNum = typeof max === 'string' ? parseFloat(max) : max

  if (isNaN(minNum) || isNaN(maxNum)) {
    return '0 - 0'
  }

  return `${formatNumber(minNum, decimals)} - ${formatNumber(maxNum, decimals)}`
}

/**
 * Parse Vietnamese formatted number back to number
 * 
 * @param value - Formatted number string
 * @returns Parsed number
 */
export function parseVietnameseNumber(value: string): number {
  if (!value || typeof value !== 'string') {
    return 0
  }

  // Remove thousand separators (periods)
  // Replace decimal separator (comma) with period
  const normalized = value
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .trim()

  const num = parseFloat(normalized)

  return isNaN(num) ? 0 : num
}

/**
 * Format number with sign (+ or -)
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number with sign
 */
export function formatNumberWithSign(value: number | string, decimals: number = 0): string {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return '0'
  }

  const formatted = formatNumber(Math.abs(num), decimals)
  
  if (num > 0) {
    return `+${formatted}`
  } else if (num < 0) {
    return `-${formatted}`
  }

  return formatted
}
