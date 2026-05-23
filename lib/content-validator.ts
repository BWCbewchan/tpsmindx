/**
 * Vietnamese Content Validation Utilities
 * 
 * Utilities for extracting and validating Vietnamese content in UI components.
 * 
 * Requirements: 26.12, 26.13, 26.14
 * 
 * @example
 * ```tsx
 * const issues = validateVietnameseContent('<Button>Submit</Button>')
 * // Returns: [{ type: 'english-content', text: 'Submit', ... }]
 * ```
 */

import {
  isVietnamese,
  hasDiacritics,
  isTechnicalTerm,
  isNumberOrPunctuation,
} from './language-utils'

export interface ContentIssue {
  type: 'english-content' | 'missing-diacritics' | 'mixed-content'
  text: string
  line?: number
  column?: number
  suggestion?: string
}

/**
 * Extract text content from JSX/TSX code
 * This is a simple regex-based extractor for demonstration.
 * In production, use a proper AST parser like @babel/parser
 */
export function extractUIText(code: string): string[] {
  const texts: string[] = []
  
  // Extract text between JSX tags: >text<
  const jsxTextRegex = />([^<>]+)</g
  let match
  while ((match = jsxTextRegex.exec(code)) !== null) {
    const text = match[1].trim()
    if (text && !text.startsWith('{') && !text.startsWith('//')) {
      texts.push(text)
    }
  }
  
  // Extract text from string literals in JSX attributes
  // placeholder="text", aria-label="text", title="text"
  const attrRegex = /(?:placeholder|aria-label|title|alt)=["']([^"']+)["']/g
  while ((match = attrRegex.exec(code)) !== null) {
    const text = match[1].trim()
    if (text) {
      texts.push(text)
    }
  }
  
  return texts
}

/**
 * Check if text is valid Vietnamese content
 */
export function isValidVietnameseContent(text: string): boolean {
  if (!text || text.trim() === '') return true
  
  const trimmed = text.trim()
  
  // Allow technical terms
  if (isTechnicalTerm(trimmed)) return true
  
  // Allow numbers and punctuation
  if (isNumberOrPunctuation(trimmed)) return true
  
  // Check if it's Vietnamese with diacritics
  return isVietnamese(trimmed) && hasDiacritics(trimmed)
}

/**
 * Detect English content in text
 */
export function hasEnglishContent(text: string): boolean {
  if (!text || text.trim() === '') return false
  
  const trimmed = text.trim()
  
  // Skip technical terms
  if (isTechnicalTerm(trimmed)) return false
  
  // Skip numbers and punctuation
  if (isNumberOrPunctuation(trimmed)) return false
  
  // Check if text contains English letters without Vietnamese diacritics
  const hasEnglishLetters = /[a-zA-Z]/.test(trimmed)
  const hasVietnameseChars = isVietnamese(trimmed)
  
  return hasEnglishLetters && !hasVietnameseChars
}

/**
 * Detect missing diacritics in Vietnamese text
 */
export function hasMissingDiacritics(text: string): boolean {
  if (!text || text.trim() === '') return false
  
  const trimmed = text.trim()
  
  // Skip technical terms
  if (isTechnicalTerm(trimmed)) return false
  
  // Skip numbers and punctuation
  if (isNumberOrPunctuation(trimmed)) return false
  
  // If text has English letters but no Vietnamese diacritics, it might be missing diacritics
  const hasEnglishLetters = /[a-zA-Z]/.test(trimmed)
  const hasVietnameseChars = isVietnamese(trimmed)
  
  // Common Vietnamese words without diacritics
  const commonWordsWithoutDiacritics = [
    'nha', 'ma', 'la', 'ca', 'ba', 'cha', 'con', 'ban', 'toi', 'anh', 'em',
    'nguoi', 'viet', 'nam', 'ha', 'noi', 'sai', 'gon', 'hue', 'da', 'nang',
  ]
  
  const lowerText = trimmed.toLowerCase()
  const hasSuspiciousWords = commonWordsWithoutDiacritics.some(word =>
    lowerText.includes(word)
  )
  
  return hasEnglishLetters && !hasVietnameseChars && hasSuspiciousWords
}

/**
 * Validate Vietnamese content in code
 */
export function validateVietnameseContent(code: string): ContentIssue[] {
  const issues: ContentIssue[] = []
  const texts = extractUIText(code)
  
  for (const text of texts) {
    if (hasEnglishContent(text)) {
      issues.push({
        type: 'english-content',
        text,
        suggestion: 'Sử dụng tiếng Việt cho nội dung UI',
      })
    } else if (hasMissingDiacritics(text)) {
      issues.push({
        type: 'missing-diacritics',
        text,
        suggestion: 'Thêm dấu thanh tiếng Việt',
      })
    }
  }
  
  return issues
}

/**
 * Validate a single text string
 */
export function validateText(text: string): ContentIssue | null {
  if (!text || text.trim() === '') return null
  
  if (hasEnglishContent(text)) {
    return {
      type: 'english-content',
      text,
      suggestion: 'Sử dụng tiếng Việt cho nội dung UI',
    }
  }
  
  if (hasMissingDiacritics(text)) {
    return {
      type: 'missing-diacritics',
      text,
      suggestion: 'Thêm dấu thanh tiếng Việt',
    }
  }
  
  return null
}

/**
 * Get suggestions for English text
 */
export function getSuggestions(englishText: string): string[] {
  // Common English to Vietnamese translations
  const commonTranslations: Record<string, string> = {
    'Submit': 'Gửi',
    'Save': 'Lưu',
    'Delete': 'Xóa',
    'Cancel': 'Hủy',
    'Edit': 'Chỉnh sửa',
    'Add': 'Thêm',
    'Remove': 'Xóa bỏ',
    'Update': 'Cập nhật',
    'Create': 'Tạo',
    'Close': 'Đóng',
    'Open': 'Mở',
    'Download': 'Tải xuống',
    'Upload': 'Tải lên',
    'Search': 'Tìm kiếm',
    'Filter': 'Lọc',
    'Sort': 'Sắp xếp',
    'View': 'Xem',
    'Back': 'Quay lại',
    'Next': 'Tiếp theo',
    'Previous': 'Trước đó',
    'Continue': 'Tiếp tục',
    'Finish': 'Hoàn thành',
    'Confirm': 'Xác nhận',
    'Yes': 'Có',
    'No': 'Không',
    'OK': 'OK',
    'Loading': 'Đang tải',
    'Error': 'Lỗi',
    'Success': 'Thành công',
    'Warning': 'Cảnh báo',
    'Info': 'Thông tin',
  }
  
  const suggestions: string[] = []
  
  // Check for exact match
  if (commonTranslations[englishText]) {
    suggestions.push(commonTranslations[englishText])
  }
  
  // Check for case-insensitive match
  const lowerText = englishText.toLowerCase()
  for (const [eng, vie] of Object.entries(commonTranslations)) {
    if (eng.toLowerCase() === lowerText) {
      suggestions.push(vie)
    }
  }
  
  return suggestions
}

/**
 * Format validation report
 */
export function formatValidationReport(issues: ContentIssue[]): string {
  if (issues.length === 0) {
    return '✅ Không có vấn đề về nội dung tiếng Việt'
  }
  
  let report = `❌ Tìm thấy ${issues.length} vấn đề:\n\n`
  
  for (const issue of issues) {
    report += `- ${issue.type === 'english-content' ? 'Nội dung tiếng Anh' : 'Thiếu dấu thanh'}: "${issue.text}"\n`
    if (issue.suggestion) {
      report += `  Gợi ý: ${issue.suggestion}\n`
    }
    report += '\n'
  }
  
  return report
}

/**
 * Check if component file follows Vietnamese content standards
 */
export function validateComponentFile(
  filePath: string,
  content: string
): {
  valid: boolean
  issues: ContentIssue[]
  report: string
} {
  const issues = validateVietnameseContent(content)
  const valid = issues.length === 0
  const report = formatValidationReport(issues)
  
  return { valid, issues, report }
}

/**
 * Batch validate multiple files
 */
export function validateMultipleFiles(
  files: Array<{ path: string; content: string }>
): Map<string, ContentIssue[]> {
  const results = new Map<string, ContentIssue[]>()
  
  for (const file of files) {
    const issues = validateVietnameseContent(file.content)
    if (issues.length > 0) {
      results.set(file.path, issues)
    }
  }
  
  return results
}

/**
 * Get statistics about Vietnamese content usage
 */
export function getContentStatistics(code: string): {
  totalTexts: number
  vietnameseTexts: number
  englishTexts: number
  technicalTerms: number
  missingDiacritics: number
  percentage: number
} {
  const texts = extractUIText(code)
  let vietnameseTexts = 0
  let englishTexts = 0
  let technicalTerms = 0
  let missingDiacritics = 0
  
  for (const text of texts) {
    if (isTechnicalTerm(text)) {
      technicalTerms++
    } else if (hasEnglishContent(text)) {
      englishTexts++
    } else if (hasMissingDiacritics(text)) {
      missingDiacritics++
    } else if (isVietnamese(text)) {
      vietnameseTexts++
    }
  }
  
  const percentage = texts.length > 0
    ? Math.round((vietnameseTexts / texts.length) * 100)
    : 0
  
  return {
    totalTexts: texts.length,
    vietnameseTexts,
    englishTexts,
    technicalTerms,
    missingDiacritics,
    percentage,
  }
}
