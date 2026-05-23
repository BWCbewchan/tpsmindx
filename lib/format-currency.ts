/**
 * Currency Formatting Utilities
 * 
 * Formats currency following Vietnamese conventions:
 * - VND format: 1.234.567₫ (no decimals)
 * - Thousand separator: period (.)
 * - Currency symbol: ₫ (after number)
 * 
 * Requirements: 13.21, 26.8
 * 
 * @example
 * ```ts
 * formatCurrency(1234567) // "1.234.567₫"
 * formatCurrencyCompact(1234567) // "1,2 triệu₫"
 * formatCurrencyRange(100000, 500000) // "100.000₫ - 500.000₫"
 * ```
 */

import { formatNumber, formatNumberCompact } from './format-number'

/**
 * Format as VND currency
 * 
 * @param value - Amount in VND
 * @param showSymbol - Whether to show ₫ symbol (default: true)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | string, showSymbol: boolean = true): string {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return showSymbol ? '0₫' : '0'
  }

  // VND has no decimals
  const formatted = formatNumber(num, 0)

  return showSymbol ? `${formatted}₫` : formatted
}

/**
 * Format currency in compact form
 * 
 * @param value - Amount in VND
 * @param decimals - Number of decimal places (default: 1)
 * @param showSymbol - Whether to show ₫ symbol (default: true)
 * @returns Compact currency string
 */
export function formatCurrencyCompact(
  value: number | string,
  decimals: number = 1,
  showSymbol: boolean = true
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return showSymbol ? '0₫' : '0'
  }

  const formatted = formatNumberCompact(num, decimals)

  return showSymbol ? `${formatted}₫` : formatted
}

/**
 * Format currency range
 * 
 * @param min - Minimum amount
 * @param max - Maximum amount
 * @param showSymbol - Whether to show ₫ symbol (default: true)
 * @returns Formatted currency range string
 */
export function formatCurrencyRange(
  min: number | string,
  max: number | string,
  showSymbol: boolean = true
): string {
  const minNum = typeof min === 'string' ? parseFloat(min) : min
  const maxNum = typeof max === 'string' ? parseFloat(max) : max

  if (isNaN(minNum) || isNaN(maxNum)) {
    return showSymbol ? '0₫ - 0₫' : '0 - 0'
  }

  const minFormatted = formatNumber(minNum, 0)
  const maxFormatted = formatNumber(maxNum, 0)

  if (showSymbol) {
    return `${minFormatted}₫ - ${maxFormatted}₫`
  }

  return `${minFormatted} - ${maxFormatted}`
}

/**
 * Format currency with sign (+ or -)
 * 
 * @param value - Amount in VND
 * @param showSymbol - Whether to show ₫ symbol (default: true)
 * @returns Formatted currency with sign
 */
export function formatCurrencyWithSign(
  value: number | string,
  showSymbol: boolean = true
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return showSymbol ? '0₫' : '0'
  }

  const formatted = formatNumber(Math.abs(num), 0)
  const symbol = showSymbol ? '₫' : ''

  if (num > 0) {
    return `+${formatted}${symbol}`
  } else if (num < 0) {
    return `-${formatted}${symbol}`
  }

  return `${formatted}${symbol}`
}

/**
 * Format as price (alias for formatCurrency)
 */
export const formatPrice = formatCurrency

/**
 * Format as salary (VND per month)
 * 
 * @param value - Salary amount in VND
 * @param showPeriod - Whether to show "/tháng" (default: true)
 * @returns Formatted salary string
 */
export function formatSalary(value: number | string, showPeriod: boolean = true): string {
  const formatted = formatCurrency(value)

  return showPeriod ? `${formatted}/tháng` : formatted
}

/**
 * Format as hourly rate (VND per hour)
 * 
 * @param value - Hourly rate in VND
 * @param showPeriod - Whether to show "/giờ" (default: true)
 * @returns Formatted hourly rate string
 */
export function formatHourlyRate(value: number | string, showPeriod: boolean = true): string {
  const formatted = formatCurrency(value)

  return showPeriod ? `${formatted}/giờ` : formatted
}

/**
 * Parse Vietnamese currency string back to number
 * 
 * @param value - Formatted currency string
 * @returns Parsed number
 */
export function parseCurrency(value: string): number {
  if (!value || typeof value !== 'string') {
    return 0
  }

  // Remove currency symbol and thousand separators
  const normalized = value
    .replace(/₫/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .trim()

  const num = parseFloat(normalized)

  return isNaN(num) ? 0 : num
}

/**
 * Format discount amount
 * 
 * @param originalPrice - Original price
 * @param discountedPrice - Discounted price
 * @returns Formatted discount string
 */
export function formatDiscount(
  originalPrice: number | string,
  discountedPrice: number | string
): string {
  const original = typeof originalPrice === 'string' ? parseFloat(originalPrice) : originalPrice
  const discounted = typeof discountedPrice === 'string' ? parseFloat(discountedPrice) : discountedPrice

  if (isNaN(original) || isNaN(discounted)) {
    return '0%'
  }

  const discountAmount = original - discounted
  const discountPercent = (discountAmount / original) * 100

  return `${Math.round(discountPercent)}%`
}

/**
 * Format price with discount
 * 
 * @param originalPrice - Original price
 * @param discountedPrice - Discounted price
 * @returns Formatted price with discount
 */
export function formatPriceWithDiscount(
  originalPrice: number | string,
  discountedPrice: number | string
): string {
  const original = formatCurrency(originalPrice)
  const discounted = formatCurrency(discountedPrice)
  const discount = formatDiscount(originalPrice, discountedPrice)

  return `${discounted} (giảm ${discount} từ ${original})`
}

/**
 * Check if amount is valid VND (positive integer)
 * 
 * @param value - Amount to check
 * @returns Whether amount is valid VND
 */
export function isValidVND(value: number | string): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return false
  }

  // VND must be positive and integer
  return num >= 0 && Number.isInteger(num)
}

/**
 * Round to nearest VND denomination
 * 
 * @param value - Amount to round
 * @param denomination - Denomination to round to (default: 1000)
 * @returns Rounded amount
 */
export function roundVND(value: number | string, denomination: number = 1000): number {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return 0
  }

  return Math.round(num / denomination) * denomination
}
