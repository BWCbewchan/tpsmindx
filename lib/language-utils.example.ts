/**
 * Language Utilities Examples
 * 
 * Demonstrates how to use Vietnamese language utilities.
 */

import {
  isVietnamese,
  hasDiacritics,
  isTechnicalTerm,
  isNumberOrPunctuation,
  formatDate,
  formatDateFormal,
  formatDateInput,
  formatCurrency,
  formatNumber,
  formatRelativeTime,
  formatTimestamp,
  formatTime,
  formatTimeFormal,
  formatAddress,
  isValidPhoneNumber,
  formatPhoneNumber,
  getDayOfWeek,
  getMonthName,
} from './language-utils'

// Example 1: Detect Vietnamese text
export function DetectVietnameseExamples() {
  return {
    vietnamese: isVietnamese('Xin chào'), // true
    english: isVietnamese('Hello'), // false
    mixed: isVietnamese('Hello Việt Nam'), // true (contains Vietnamese)
    empty: isVietnamese(''), // false
  }
}

// Example 2: Check for diacritics
export function CheckDiacriticsExamples() {
  return {
    withDiacritics: hasDiacritics('Xin chào'), // true
    withoutDiacritics: hasDiacritics('Xin chao'), // false
    english: hasDiacritics('Hello'), // false
  }
}

// Example 3: Check technical terms
export function TechnicalTermExamples() {
  return {
    api: isTechnicalTerm('API'), // true
    email: isTechnicalTerm('email'), // true
    vietnamese: isTechnicalTerm('Xin chào'), // false
    html: isTechnicalTerm('HTML'), // true
  }
}

// Example 4: Check numbers and punctuation
export function NumberPunctuationExamples() {
  return {
    number: isNumberOrPunctuation('123'), // true
    punctuation: isNumberOrPunctuation('...'), // true
    mixed: isNumberOrPunctuation('123.456'), // true
    text: isNumberOrPunctuation('Hello'), // false
  }
}

// Example 5: Format dates
export function FormatDateExamples() {
  const date = new Date('2024-01-15T14:30:00')
  
  return {
    display: formatDate(date), // "15/01/2024"
    formal: formatDateFormal(date), // "Ngày 15 tháng 01 năm 2024"
    input: formatDateInput(date), // "2024-01-15"
  }
}

// Example 6: Format currency
export function FormatCurrencyExamples() {
  return {
    withPeriod: formatCurrency(1234567), // "1.234.567₫"
    withComma: formatCurrency(1234567, 'comma'), // "1,234,567₫"
    small: formatCurrency(50000), // "50.000₫"
    large: formatCurrency(123456789), // "123.456.789₫"
  }
}

// Example 7: Format numbers
export function FormatNumberExamples() {
  return {
    integer: formatNumber(1234567), // "1.234.567"
    withDecimals: formatNumber(1234567.89, 'period', 2), // "1.234.567,89"
    withComma: formatNumber(1234567, 'comma'), // "1,234,567"
    withCommaDecimals: formatNumber(1234567.89, 'comma', 2), // "1,234,567.89"
  }
}

// Example 8: Format relative time
export function FormatRelativeTimeExamples() {
  const now = new Date()
  
  return {
    justNow: formatRelativeTime(new Date(now.getTime() - 30 * 1000)), // "Vừa xong"
    minutes: formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000)), // "5 phút trước"
    hours: formatRelativeTime(new Date(now.getTime() - 3 * 60 * 60 * 1000)), // "3 giờ trước"
    days: formatRelativeTime(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)), // "2 ngày trước"
    weeks: formatRelativeTime(new Date(now.getTime() - 2 * 7 * 24 * 60 * 60 * 1000)), // "2 tuần trước"
  }
}

// Example 9: Format timestamps
export function FormatTimestampExamples() {
  const now = new Date()
  
  return {
    recent: formatTimestamp(new Date(now.getTime() - 2 * 60 * 60 * 1000)), // "2 giờ trước"
    old: formatTimestamp(new Date('2023-01-15')), // "15/01/2023"
  }
}

// Example 10: Format time
export function FormatTimeExamples() {
  const date = new Date('2024-01-15T14:30:00')
  
  return {
    standard: formatTime(date), // "14:30"
    formal: formatTimeFormal(date), // "14 giờ 30 phút"
  }
}

// Example 11: Format addresses
export function FormatAddressExamples() {
  return {
    full: formatAddress({
      street: '123 Nguyễn Huệ',
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      city: 'TP. Hồ Chí Minh',
    }), // "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"
    
    partial: formatAddress({
      street: '456 Lê Lợi',
      city: 'Hà Nội',
    }), // "456 Lê Lợi, Hà Nội"
  }
}

// Example 12: Validate and format phone numbers
export function PhoneNumberExamples() {
  return {
    valid: isValidPhoneNumber('0123456789'), // true
    invalid: isValidPhoneNumber('123'), // false
    formatted: formatPhoneNumber('0123456789'), // "0123 456 789"
    withSpaces: formatPhoneNumber('0123 456 789'), // "0123 456 789"
  }
}

// Example 13: Get day of week
export function DayOfWeekExamples() {
  return {
    monday: getDayOfWeek(new Date('2024-01-15')), // "Thứ hai"
    sunday: getDayOfWeek(new Date('2024-01-14')), // "Chủ nhật"
    friday: getDayOfWeek(new Date('2024-01-19')), // "Thứ sáu"
  }
}

// Example 14: Get month name
export function MonthNameExamples() {
  return {
    january: getMonthName(0), // "Tháng 1"
    december: getMonthName(11), // "Tháng 12"
    june: getMonthName(5), // "Tháng 6"
  }
}

// Example 15: Complete date-time formatting
export function CompleteDateTimeExample() {
  const date = new Date('2024-01-15T14:30:00')
  
  return {
    dayOfWeek: getDayOfWeek(date), // "Thứ hai"
    date: formatDate(date), // "15/01/2024"
    time: formatTime(date), // "14:30"
    full: `${getDayOfWeek(date)}, ${formatDate(date)} lúc ${formatTime(date)}`,
    // "Thứ hai, 15/01/2024 lúc 14:30"
  }
}

// Example 16: User profile display
export function UserProfileExample() {
  return {
    name: 'Nguyễn Văn An',
    email: 'nguyenvanan@email.com',
    phone: formatPhoneNumber('0123456789'), // "0123 456 789"
    address: formatAddress({
      street: '123 Nguyễn Huệ',
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      city: 'TP. Hồ Chí Minh',
    }),
    joinDate: formatDate(new Date('2023-06-15')), // "15/06/2023"
  }
}

// Example 17: Transaction display
export function TransactionExample() {
  const date = new Date('2024-01-15T14:30:00')
  
  return {
    amount: formatCurrency(1234567), // "1.234.567₫"
    date: formatDate(date), // "15/01/2024"
    time: formatTime(date), // "14:30"
    status: 'Thành công',
    description: 'Thanh toán khóa học',
  }
}

// Example 18: Activity feed
export function ActivityFeedExample() {
  const now = new Date()
  
  return [
    {
      action: 'Đã đăng nhập',
      time: formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000)), // "5 phút trước"
    },
    {
      action: 'Đã cập nhật hồ sơ',
      time: formatRelativeTime(new Date(now.getTime() - 2 * 60 * 60 * 1000)), // "2 giờ trước"
    },
    {
      action: 'Đã hoàn thành bài tập',
      time: formatRelativeTime(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)), // "1 ngày trước"
    },
  ]
}

// Example 19: Price comparison
export function PriceComparisonExample() {
  return {
    original: formatCurrency(2000000), // "2.000.000₫"
    discount: formatCurrency(500000), // "500.000₫"
    final: formatCurrency(1500000), // "1.500.000₫"
    savings: formatNumber(25) + '%', // "25%"
  }
}

// Example 20: Statistics display
export function StatisticsExample() {
  return {
    totalUsers: formatNumber(12345), // "12.345"
    revenue: formatCurrency(123456789), // "123.456.789₫"
    growth: formatNumber(15.5, 'period', 1) + '%', // "15,5%"
    averageRating: formatNumber(4.8, 'period', 1), // "4,8"
  }
}
