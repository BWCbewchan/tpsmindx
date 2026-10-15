import 'server-only'

import { google } from 'googleapis'
import { SHEET_HEADERS } from './constants'
import {
  detectSheetDateOrder,
  parseSheetTimestamp,
  type RawSheetRow,
  type SheetDateOrder,
} from './normalize'

export interface GoogleSheetFetchResult {
  rows: RawSheetRow[]
  totalRowsScanned: number
  boundedRange: string | null
  missingHeaders: string[]
  warnings: string[]
  dateOrder: SheetDateOrder
}

export interface GoogleSheetConfiguration {
  configured: boolean
  spreadsheetId: string
  sheetName: string
  message: string
  missingVariables: string[]
}

const REQUIRED_HEADERS = Object.values(SHEET_HEADERS)
const GOOGLE_REQUEST_TIMEOUT_MS = 15000

function configuredDateOrder(): SheetDateOrder | null {
  const value = process.env.TEACHER_SURVEY_DATE_ORDER?.trim().toUpperCase()
  return value === 'DMY' || value === 'MDY' ? value : null
}

export function getTeacherSurveyGoogleConfiguration(): GoogleSheetConfiguration {
  const spreadsheetId = (
    process.env.TEACHER_SURVEY_SPREADSHEET_ID ||
    process.env.GOOGLE_SPREADSHEET_ID ||
    ''
  ).trim()
  const sheetName = (process.env.TEACHER_SURVEY_SHEET_NAME || 'Form Responses 1').trim()
  const clientId = (
    process.env.TEACHER_SURVEY_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    ''
  ).trim()
  const clientSecret = (
    process.env.TEACHER_SURVEY_GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    ''
  ).trim()
  const refreshToken = (
    process.env.TEACHER_SURVEY_GOOGLE_REFRESH_TOKEN ||
    process.env.GOOGLE_REFRESH_TOKEN ||
    ''
  ).trim()
  const missingVariables = [
    !spreadsheetId && 'GOOGLE_SPREADSHEET_ID',
    !clientId && 'GOOGLE_CLIENT_ID',
    !clientSecret && 'GOOGLE_CLIENT_SECRET',
    !refreshToken && 'GOOGLE_REFRESH_TOKEN',
  ].filter((value): value is string => Boolean(value))
  const configured = Boolean(spreadsheetId && clientId && clientSecret && refreshToken)
  return {
    configured,
    spreadsheetId,
    sheetName,
    message: configured
      ? 'Google Sheets đã được cấu hình.'
      : `TPS đang thiếu cấu hình Google Forms: ${missingVariables.join(', ')}.`,
    missingVariables,
  }
}

function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`
}

function buildSheetsClient() {
  const clientId = process.env.TEACHER_SURVEY_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.TEACHER_SURVEY_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.TEACHER_SURVEY_GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN
  const oauthClient = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000')
  oauthClient.setCredentials({ refresh_token: refreshToken })
  return google.sheets({ version: 'v4', auth: oauthClient })
}

export async function fetchTeacherSurveySheet(input: {
  from: Date
  to: Date
  signal?: AbortSignal
}): Promise<GoogleSheetFetchResult> {
  const configuration = getTeacherSurveyGoogleConfiguration()
  if (!configuration.configured) {
    return {
      rows: [],
      totalRowsScanned: 0,
      boundedRange: null,
      missingHeaders: [],
      warnings: [configuration.message],
      dateOrder: configuredDateOrder() || 'MDY',
    }
  }

  const sheets = buildSheetsClient()
  const sheet = quoteSheetName(configuration.sheetName)
  const lookup = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: configuration.spreadsheetId,
    ranges: [`${sheet}!A1:Z1`, `${sheet}!A2:A`],
    valueRenderOption: 'FORMATTED_VALUE',
  }, { timeout: GOOGLE_REQUEST_TIMEOUT_MS, signal: input.signal })
  const headers = (lookup.data.valueRanges?.[0]?.values?.[0] || [])
    .map((value) => String(value || '').trim())
  const timestampRows = lookup.data.valueRanges?.[1]?.values || []
  const dateOrder = configuredDateOrder() || detectSheetDateOrder(
    timestampRows.map((row) => row?.[0]),
    'MDY',
  )
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header))
  const warnings: string[] = []
  if (missingHeaders.length > 0) {
    warnings.push(`Google Sheet thiếu ${missingHeaders.length} cột bắt buộc.`)
  }
  if (timestampRows.length === 0) {
    return {
      rows: [],
      totalRowsScanned: 0,
      boundedRange: null,
      missingHeaders,
      warnings,
      dateOrder,
    }
  }

  const matchedIndexes: number[] = []
  let parsedTimestampCount = 0
  timestampRows.forEach((row, index) => {
    const timestamp = parseSheetTimestamp(row?.[0], dateOrder)
    if (!timestamp) return
    parsedTimestampCount += 1
    if (timestamp >= input.from && timestamp <= input.to) matchedIndexes.push(index)
  })

  if (parsedTimestampCount === 0) {
    warnings.push('Không đọc được định dạng ngày giờ ở cột Timestamp của Google Sheet.')
  }
  if (matchedIndexes.length === 0) {
    return {
      rows: [],
      totalRowsScanned: timestampRows.length,
      boundedRange: null,
      missingHeaders,
      warnings,
      dateOrder,
    }
  }

  const firstIndex = Math.min(...matchedIndexes)
  const lastIndex = Math.max(...matchedIndexes)
  const startRow = firstIndex + 2
  const endRow = lastIndex + 2
  const boundedRange = `${sheet}!A${startRow}:Z${endRow}`
  const dataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: configuration.spreadsheetId,
    range: boundedRange,
    valueRenderOption: 'FORMATTED_VALUE',
  }, { timeout: GOOGLE_REQUEST_TIMEOUT_MS, signal: input.signal })

  const rows = (dataResponse.data.values || []).flatMap((values, index): RawSheetRow[] => {
    const rowNumber = startRow + index
    const record = Object.fromEntries(headers.map((header, columnIndex) => [
      header,
      String(values[columnIndex] ?? '').trim(),
    ]))
    if (!Object.values(record).some(Boolean)) return []
    const timestamp = parseSheetTimestamp(record[SHEET_HEADERS.timestamp], dateOrder)
    if (!timestamp || timestamp < input.from || timestamp > input.to) return []
    return [{ rowNumber, values: record }]
  })

  return {
    rows,
    totalRowsScanned: timestampRows.length,
    boundedRange,
    missingHeaders,
    warnings,
    dateOrder,
  }
}
