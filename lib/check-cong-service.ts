import { promises as fs } from 'fs'
import { createHash } from 'crypto'
import path from 'path'
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import * as XLSX from 'xlsx'
import pool from '@/lib/db'
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3'

export type CheckCongRecord = {
  checkKey: string
  centre: string
  type: string
  className: string
  course: string
  courseLine: string
  teacherName: string
  workEmail: string
  personalEmail: string
  username: string
  roleType: string
  status: string
  slotTime: string
  slotDuration: number
  effectiveDuration: number
  studentCount: number | null
  note: string
  managerNote: string
  confirmStatus: string
  confirmNote: string
  salaryAmount: number | null
  salaryRule: string
  payHours: number
}

export type CheckCongSummary = {
  totalRecords: number
  checkedRecords: number
  uncheckedRecords: number
  classSessions: number
  officeHours: number
  totalSlotDuration: number
  totalEffectiveDuration: number
  estimatedSalary: number | null
  grossEstimatedSalary: number | null
  salaryTaxAmount: number | null
  checkRate: number
  monthLabel: string
}

type AdminTeacherRankingItem = {
  teacherName: string
  username: string
  workEmail: string
  checkedRecords: number
  totalRecords: number
  centres: string[]
}

type AdminMonthBase = {
  scoped: CheckCongRecord[]
  summary: CheckCongSummary
  analytics: {
    teacherCount: number
    checkedByType: Record<string, number>
    teacherRanking: AdminTeacherRankingItem[]
    topTeachers: AdminTeacherRankingItem[]
    monthLabel: string
  }
}

type ParsedCheckCongCsv = {
  headers: string[]
  rows: string[][]
  records: CheckCongRecord[]
  availableMonths: string[]
}

type StoredCheckCongImportFile = {
  id: number
  periodMonth: string
  originalFileName: string
  originalFileType: 'csv' | 'excel'
  sheetName: string | null
  s3Bucket: string
  s3Key: string
  fileSize: number
  recordCount: number
  contentSha256: string
  uploadedByEmail: string | null
  createdAt: string
}

type CheckCongImportResult = {
  savedPath: string
  recordCount: number
  files: Array<{
    month: string
    recordCount: number
    storagePath: string
  }>
  sheetName?: string
}

const CSV_PATH =
  process.env.CHECK_CONG_CSV_PATH ||
  path.join(process.cwd(), 'public', 'data', 'check-cong-class.csv')

const STORAGE_BUCKET =
  process.env.CHECK_CONG_STORAGE_BUCKET || 'check-cong-data'

const STORAGE_PREFIX = (process.env.CHECK_CONG_STORAGE_PREFIX || 'check-cong')
  .replace(/^\/+|\/+$/g, '')

const ACTIVE_IMPORT_CACHE_TTL_MS = 30_000

const REQUIRED_HEADERS = [
  'Centre shortname',
  'Type',
  'Teacher name',
  'Work email',
  'Username',
  'Status',
  'Slot time',
]

let cached:
  | {
      loadedAt: number
      mtimeMs: number
      records: CheckCongRecord[]
      availableMonths: string[]
    }
  | undefined

let adminBaseCache:
  | {
      cacheKey: string
      months: string[]
      byMonth: Map<string, AdminMonthBase>
    }
  | undefined

let activeImportsCache:
  | {
      loadedAt: number
      files: StoredCheckCongImportFile[]
    }
  | undefined

const storageCsvCache = new Map<
  string,
  {
    loadedAt: number
    csvText: string
    parsed: ParsedCheckCongCsv
  }
>()

function parseCSVRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuote = false
  const source = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < source.length; i++) {
    const char = source[i]

    if (char === '"') {
      if (inQuote && source[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        inQuote = !inQuote
      }
    } else if (char === ',' && !inQuote) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\n' || char === '\r') && !inQuote) {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(cell.trim())
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.trim())
    if (row.some((value) => value !== '')) rows.push(row)
  }

  return rows
}

function serializeCSVRows(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? '')
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(','),
    )
    .join('\r\n')
}

function formatWorkbookCell(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    const hour = String(value.getHours()).padStart(2, '0')
    const minute = String(value.getMinutes()).padStart(2, '0')
    const second = String(value.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }
  return String(value).trim()
}

function validateCheckCongHeaders(headers: string[], fileTypeLabel: string) {
  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header),
  )

  if (missingHeaders.length > 0) {
    throw new Error(`${fileTypeLabel} thiếu cột: ${missingHeaders.join(', ')}`)
  }
}

function workbookBufferToCsvText(buffer: Buffer): {
  csvText: string
  sheetName: string
  recordCount: number
} {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('File Excel không có sheet dữ liệu')
  }

  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils
    .sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    })
    .map((row) => row.map(formatWorkbookCell))
    .filter((row) => row.some((value) => value !== ''))

  const headers = rows[0] ?? []
  validateCheckCongHeaders(headers, 'File Excel')

  return {
    csvText: serializeCSVRows(rows),
    sheetName,
    recordCount: Math.max(0, rows.length - 1),
  }
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function toNullableNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isOneOnOneClass(className: string): boolean {
  return /(?:^|[-_\s])1-(?:1|2|3)(?:$|[-_\s])/i.test(className)
}

function trialOfflineSalary(record: {
  studentCount: number | null
  confirmStatus: string
}): Pick<CheckCongRecord, 'salaryAmount' | 'salaryRule' | 'payHours'> {
  const status = normalizeToken(record.confirmStatus)
  if (status.includes('gvien k truc') || status.includes('giao vien k truc')) {
    return { salaryAmount: 0, salaryRule: 'Trial offline cancel - không trực', payHours: 0 }
  }
  if (status.includes('truc 30p')) {
    return { salaryAmount: 50000, salaryRule: 'Trial offline cancel - trực 30 phút', payHours: 0.5 }
  }
  if (status.includes('huy') && status.includes('truc het gio')) {
    return { salaryAmount: 80000, salaryRule: 'Trial offline cancel - trực hết giờ', payHours: 0 }
  }

  const students = Math.max(0, record.studentCount ?? 0)
  return {
    salaryAmount: Math.min(300000, 80000 + students * 30000),
    salaryRule: 'Trial offline/FIXED: 80k + 30k/học viên, tối đa 300k',
    payHours: 0,
  }
}

function trialOnlineSalary(record: {
  studentCount: number | null
  confirmStatus: string
}): {
  salaryAmount: number
  salaryRule: string
  payHours: number
} {
  if (normalizeToken(record.confirmStatus).includes('huy')) {
    return {
      salaryAmount: 40000,
      salaryRule: 'Trial online cancel sát giờ: 40k',
      payHours: 0,
    }
  }

  const students = Math.max(0, Math.min(record.studentCount ?? 0, 3))
  const amount = students <= 1 ? 40000 : students === 2 ? 60000 : 80000
  return {
    salaryAmount: amount,
    salaryRule: 'Trial online: 40k/1 HV, 60k/2 HV, 80k/3 HV',
    payHours: 0,
  }
}

function calculateSalary(
  record: Omit<
    CheckCongRecord,
    'salaryAmount' | 'salaryRule' | 'payHours'
  >,
  hourlyRate: number | null,
): Pick<CheckCongRecord, 'salaryAmount' | 'salaryRule' | 'payHours'> {
  if (record.status !== 'CHECKED') {
    return { salaryAmount: 0, salaryRule: 'Unchecked - không tính lương', payHours: 0 }
  }

  const role = normalizeToken(record.roleType)
  const type = normalizeToken(record.type)
  const hours = record.effectiveDuration || record.slotDuration || 0
  const students = record.studentCount ?? 0

  if (type === 'class') {
    if (!hourlyRate) {
      return { salaryAmount: null, salaryRule: 'Thiếu rate theo giờ', payHours: hours }
    }

    if (role === 'ta') {
      return {
        salaryAmount: Math.round(hourlyRate * hours * 0.75),
        salaryRule: 'CLASS TA: 75% x rate x giờ',
        payHours: hours,
      }
    }

    if (role === 'lec') {
      const multiplier =
        students > 3 || isOneOnOneClass(record.className) ? 1 : 0.75
      return {
        salaryAmount: Math.round(hourlyRate * hours * multiplier),
        salaryRule:
          multiplier === 1
            ? 'CLASS LEC: 100% x rate x giờ'
            : 'CLASS LEC thiếu sĩ số: 75% x rate x giờ',
        payHours: hours,
      }
    }

    return {
      salaryAmount: Math.round(hourlyRate * hours),
      salaryRule: 'CLASS vai trò khác: 100% x rate x giờ',
      payHours: hours,
    }
  }

  if (type === 'office_hours') {
    if (role === 'trial') return trialOnlineSalary(record)
    if (role === 'fixed') return trialOfflineSalary(record)

    if (role === 'makeup') {
      if (!hourlyRate) {
        return { salaryAmount: null, salaryRule: 'Thiếu rate theo giờ', payHours: hours }
      }
      const payHours = students > 3 ? hours : Math.min(hours, 1)
      const multiplier = students > 3 ? 1 : 0.75
      return {
        salaryAmount: Math.round(hourlyRate * payHours * multiplier),
        salaryRule:
          students > 3
            ? 'MAKE UP > 3 HV: 100% x rate x giờ'
            : 'MAKE UP <= 3 HV: 75% x rate x 1 giờ/ca',
        payHours,
      }
    }

    if (!hourlyRate) {
      return { salaryAmount: null, salaryRule: 'Thiếu rate theo giờ', payHours: hours }
    }
    return {
      salaryAmount: Math.round(hourlyRate * hours),
      salaryRule: 'Office hours khác: 100% x rate x giờ',
      payHours: hours,
    }
  }

  return { salaryAmount: 0, salaryRule: 'Không xác định loại công', payHours: 0 }
}

function makeCheckCongKey(record: {
  centre: string
  type: string
  className: string
  course: string
  courseLine: string
  teacherName: string
  workEmail: string
  personalEmail: string
  username: string
  roleType: string
  slotTime: string
}): string {
  const raw = [
    record.workEmail,
    record.personalEmail,
    record.username,
    record.teacherName,
    record.slotTime,
    record.type,
    record.roleType,
    record.className,
    record.course,
    record.courseLine,
    record.centre,
  ]
    .map(normalizeSearchText)
    .join('|')
  return createHash('sha1').update(raw).digest('hex')
}

function rowToRecord(row: Record<string, string>): CheckCongRecord {
  const base = {
    centre: row['Centre shortname'] || '',
    type: row.Type || '',
    className: row['Class name'] || '',
    course: row.Course || '',
    courseLine: row['Course Line'] || '',
    teacherName: row['Teacher name'] || '',
    workEmail: row['Work email'] || '',
    personalEmail: row['Personal email'] || '',
    username: row.Username || '',
    roleType: row['Class role/Office hour type'] || '',
    status: row.Status || '',
    slotTime: row['Slot time'] || '',
    slotDuration: toNumber(row['Slot duration'] || ''),
    effectiveDuration: toNumber(row['Effective duration'] || ''),
    studentCount: toNullableNumber(row['Student count'] || ''),
    note: row.Note || '',
    managerNote: row['Manager Note'] || '',
    confirmStatus: row['Confirm Status (OH only)'] || '',
    confirmNote: row['Confirm Note (OH only)'] || '',
  }

  return {
    checkKey: makeCheckCongKey(base),
    ...base,
    salaryAmount: 0,
    salaryRule: '',
    payHours: 0,
  }
}

function rowsToParsedCheckCongCsv(rows: string[], fileTypeLabel: string): ParsedCheckCongCsv
function rowsToParsedCheckCongCsv(rows: string[][], fileTypeLabel: string): ParsedCheckCongCsv
function rowsToParsedCheckCongCsv(
  inputRows: string[] | string[][],
  fileTypeLabel: string,
): ParsedCheckCongCsv {
  const rows =
    typeof inputRows[0] === 'string'
      ? parseCSVRows((inputRows as string[]).join('\n'))
      : (inputRows as string[][])
  const headers = rows[0] ?? []
  validateCheckCongHeaders(headers, fileTypeLabel)

  const records = rows
    .slice(1)
    .map((values) => {
      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      return rowToRecord(row)
    })
    .filter((record) => record.username || record.workEmail || record.personalEmail)

  return {
    headers,
    rows,
    records,
    availableMonths: uniqueMonthKeys(records),
  }
}

function parseCheckCongCsvText(
  csvText: string,
  fileTypeLabel = 'File CSV',
): ParsedCheckCongCsv {
  return rowsToParsedCheckCongCsv(parseCSVRows(csvText), fileTypeLabel)
}

function getRecordMonth(record: CheckCongRecord): string {
  const date = parseSlotDate(record.slotTime)
  if (!date) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function splitParsedCsvByMonth(parsed: ParsedCheckCongCsv): Map<string, string[][]> {
  const byMonth = new Map<string, string[][]>()

  parsed.rows.slice(1).forEach((values) => {
    const row: Record<string, string> = {}
    parsed.headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    const record = rowToRecord(row)
    if (!record.username && !record.workEmail && !record.personalEmail) return
    const month = getRecordMonth(record)
    if (!month) {
      throw new Error(
        `Không xác định được tháng từ Slot time: ${record.slotTime || '(trống)'}`,
      )
    }
    const current = byMonth.get(month) || [parsed.headers]
    current.push(values)
    byMonth.set(month, current)
  })

  if (byMonth.size === 0) {
    throw new Error('File không có dòng công hợp lệ để import')
  }

  return byMonth
}

function parseSlotDate(slotTime: string): Date | null {
  const raw = slotTime.trim()
  const date = new Date(raw)
  if (!Number.isNaN(date.getTime())) return date

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(.+))?$/)
  if (slash) {
    const first = Number(slash[1])
    const second = Number(slash[2])
    const year = Number(slash[3])
    const month = first > 12 ? second : first
    const day = first > 12 ? first : second
    const parsed = new Date(year, month - 1, day)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return Number.isNaN(date.getTime()) ? null : date
}

function sameMonth(record: CheckCongRecord, month: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(month)) return true
  const date = parseSlotDate(record.slotTime)
  if (!date) return false
  const yyyyMm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}`
  return yyyyMm === month
}

function uniqueMonthKeys(records: CheckCongRecord[]): string[] {
  return Array.from(
    new Set(
      records
        .map((record) => {
          const date = parseSlotDate(record.slotTime)
          if (!date) return ''
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            '0',
          )}`
        })
        .filter(Boolean),
    ),
  ).sort((a, b) => b.localeCompare(a))
}

function buildSummary(records: CheckCongRecord[], month: string): CheckCongSummary {
  const checked = records.filter((record) => record.status === 'CHECKED')
  const uncheckedRecords = records.filter((record) => record.status === 'UNCHECKED')
  const classSessions = records.filter((record) => record.type === 'CLASS')
  const officeHours = records.filter((record) => record.type === 'OFFICE_HOURS')
  const totalEffectiveDuration = checked.reduce(
    (sum, record) => sum + record.payHours,
    0,
  )
  const totalSlotDuration = checked.reduce(
    (sum, record) => sum + record.slotDuration,
    0,
  )
  const salaryValues = checked.map((record) => record.salaryAmount)
  const grossEstimatedSalary: number | null = salaryValues.some((value) => value == null)
    ? null
    : salaryValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const salaryTaxAmount =
    grossEstimatedSalary != null && grossEstimatedSalary > 5000000
      ? Math.round(grossEstimatedSalary * 0.1)
      : grossEstimatedSalary == null
        ? null
        : 0
  const estimatedSalary =
    grossEstimatedSalary == null || salaryTaxAmount == null
      ? null
      : grossEstimatedSalary - salaryTaxAmount

  return {
    totalRecords: records.length,
    checkedRecords: checked.length,
    uncheckedRecords: uncheckedRecords.length,
    classSessions: classSessions.length,
    officeHours: officeHours.length,
    totalSlotDuration,
    totalEffectiveDuration,
    estimatedSalary,
    grossEstimatedSalary,
    salaryTaxAmount,
    checkRate: records.length > 0 ? (checked.length / records.length) * 100 : 0,
    monthLabel: /^\d{4}-\d{2}$/.test(month) ? month : 'all',
  }
}

function isMissingRelationError(error: unknown): boolean {
  return (error as { code?: string })?.code === '42P01'
}

function mapImportFileRow(row: Record<string, unknown>): StoredCheckCongImportFile {
  return {
    id: Number(row.id),
    periodMonth: String(row.period_month ?? ''),
    originalFileName: String(row.original_file_name ?? ''),
    originalFileType: String(row.original_file_type || 'csv') as 'csv' | 'excel',
    sheetName: row.sheet_name == null ? null : String(row.sheet_name),
    s3Bucket: String(row.s3_bucket ?? ''),
    s3Key: String(row.s3_key ?? ''),
    fileSize: Number(row.file_size ?? 0),
    recordCount: Number(row.record_count ?? 0),
    contentSha256: String(row.content_sha256 ?? ''),
    uploadedByEmail:
      row.uploaded_by_email == null ? null : String(row.uploaded_by_email),
    createdAt:
      row.created_at == null
        ? new Date().toISOString()
        : new Date(String(row.created_at)).toISOString(),
  }
}

async function waitForMigrationInit() {
  if (!global.migrationInitPromise) return
  await global.migrationInitPromise.catch(() => undefined)
}

async function ensureCheckCongImportTable() {
  await waitForMigrationInit()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS check_cong_import_files (
      id BIGSERIAL PRIMARY KEY,
      period_month VARCHAR(7) NOT NULL CHECK (period_month ~ '^[0-9]{4}-[0-9]{2}$'),
      original_file_name TEXT NOT NULL,
      original_file_type VARCHAR(20) NOT NULL DEFAULT 'csv'
        CHECK (original_file_type IN ('csv', 'excel')),
      sheet_name TEXT,
      s3_bucket TEXT NOT NULL,
      s3_key TEXT NOT NULL,
      file_size BIGINT NOT NULL DEFAULT 0,
      record_count INTEGER NOT NULL DEFAULT 0,
      content_sha256 VARCHAR(64) NOT NULL,
      uploaded_by_email VARCHAR(255),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE check_cong_import_files
      ADD COLUMN IF NOT EXISTS sheet_name TEXT,
      ADD COLUMN IF NOT EXISTS uploaded_by_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

    CREATE INDEX IF NOT EXISTS idx_check_cong_import_files_period_active
      ON check_cong_import_files(period_month, is_active, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_check_cong_import_files_created
      ON check_cong_import_files(created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_check_cong_import_active_month
      ON check_cong_import_files(period_month)
      WHERE is_active IS TRUE;
  `)
}

async function listActiveCheckCongImportFiles(): Promise<StoredCheckCongImportFile[]> {
  if (
    activeImportsCache &&
    Date.now() - activeImportsCache.loadedAt < ACTIVE_IMPORT_CACHE_TTL_MS
  ) {
    return activeImportsCache.files
  }

  await waitForMigrationInit()
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM check_cong_import_files
      WHERE is_active IS TRUE
      ORDER BY period_month DESC, created_at DESC
      `,
    )
    const files = result.rows.map(mapImportFileRow)
    activeImportsCache = { loadedAt: Date.now(), files }
    return files
  } catch (error: unknown) {
    if (isMissingRelationError(error)) return []
    throw error
  }
}

async function ensureStorageBucket() {
  if (!isSupabaseS3Configured()) {
    throw new Error('Chưa cấu hình Supabase S3 Storage để lưu file check công')
  }

  const client = createSupabaseS3Client()
  try {
    await client.send(new HeadBucketCommand({ Bucket: STORAGE_BUCKET }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: STORAGE_BUCKET }))
  }
}

async function streamToBuffer(stream: AsyncIterable<Uint8Array> | undefined) {
  if (!stream) return Buffer.alloc(0)
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function readStorageCsvText(file: StoredCheckCongImportFile): Promise<string> {
  const cacheKey = `${file.id}:${file.contentSha256}`
  const cachedText = storageCsvCache.get(cacheKey)
  if (cachedText) return cachedText.csvText

  const client = createSupabaseS3Client()
  const object = await client.send(
    new GetObjectCommand({
      Bucket: file.s3Bucket,
      Key: file.s3Key,
    }),
  )
  const buffer = await streamToBuffer(object.Body as AsyncIterable<Uint8Array>)
  const csvText = buffer.toString('utf8')
  storageCsvCache.set(cacheKey, {
    loadedAt: Date.now(),
    csvText,
    parsed: parseCheckCongCsvText(csvText),
  })
  return csvText
}

async function loadStorageRecordsForFile(
  file: StoredCheckCongImportFile,
): Promise<ParsedCheckCongCsv> {
  const cacheKey = `${file.id}:${file.contentSha256}`
  const cachedParsed = storageCsvCache.get(cacheKey)
  if (cachedParsed) return cachedParsed.parsed

  const csvText = await readStorageCsvText(file)
  const parsed = parseCheckCongCsvText(csvText)
  storageCsvCache.set(cacheKey, { loadedAt: Date.now(), csvText, parsed })
  return parsed
}

async function loadLegacyCheckCongParsed(): Promise<
  ParsedCheckCongCsv & { mtimeMs: number }
> {
  try {
    const stat = await fs.stat(CSV_PATH)
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return {
        headers: [],
        rows: [],
        records: cached.records,
        availableMonths: cached.availableMonths,
        mtimeMs: stat.mtimeMs,
      }
    }

    const csvText = await fs.readFile(CSV_PATH, 'utf8')
    const parsed = parseCheckCongCsvText(csvText)
    cached = {
      loadedAt: Date.now(),
      mtimeMs: stat.mtimeMs,
      records: parsed.records,
      availableMonths: parsed.availableMonths,
    }
    return { ...parsed, mtimeMs: stat.mtimeMs }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error
    cached = {
      loadedAt: Date.now(),
      mtimeMs: 0,
      records: [],
      availableMonths: [],
    }
    return {
      headers: [],
      rows: [],
      records: [],
      availableMonths: [],
      mtimeMs: 0,
    }
  }
}

async function loadCheckCongData(inputMonth: string = 'all'): Promise<{
  records: CheckCongRecord[]
  availableMonths: string[]
  cacheKey: string
}> {
  const month = inputMonth || 'all'
  const activeFiles = await listActiveCheckCongImportFiles()
  const activeByMonth = new Map(
    activeFiles.map((file) => [file.periodMonth, file]),
  )
  const targetFiles =
    /^\d{4}-\d{2}$/.test(month)
      ? activeByMonth.get(month)
        ? [activeByMonth.get(month)!]
        : []
      : activeFiles

  const records: CheckCongRecord[] = []
  const loadedStorageMonths = new Set<string>()
  const storageCacheParts: string[] = []

  for (const file of targetFiles) {
    try {
      const parsed = await loadStorageRecordsForFile(file)
      records.push(...parsed.records.filter((record) => sameMonth(record, month)))
      loadedStorageMonths.add(file.periodMonth)
      storageCacheParts.push(`${file.id}:${file.contentSha256}`)
    } catch (error) {
      console.warn(
        `Không đọc được file check công trên Storage (${file.periodMonth}):`,
        error,
      )
    }
  }

  const legacy = await loadLegacyCheckCongParsed()
  const legacyRecords = legacy.records.filter((record) => {
    const recordMonth = getRecordMonth(record)
    if (recordMonth && loadedStorageMonths.has(recordMonth)) return false
    return sameMonth(record, month)
  })
  records.push(...legacyRecords)

  const availableMonths = Array.from(
    new Set([
      ...activeFiles.map((file) => file.periodMonth),
      ...legacy.availableMonths,
    ]),
  ).sort((a, b) => b.localeCompare(a))

  return {
    records,
    availableMonths,
    cacheKey: [
      `storage:${storageCacheParts.join('|')}`,
      `legacy:${legacy.mtimeMs}`,
      `month:${month}`,
    ].join(';'),
  }
}

export async function loadCheckCongRecords(month = 'all'): Promise<CheckCongRecord[]> {
  const data = await loadCheckCongData(month)
  return data.records
}

export async function saveCheckCongCsv(csvText: string): Promise<{
  savedPath: string
  recordCount: number
}> {
  const rows = parseCSVRows(csvText)
  const headers = rows[0] ?? []
  validateCheckCongHeaders(headers, 'File CSV')

  await fs.mkdir(path.dirname(CSV_PATH), { recursive: true })
  await fs.writeFile(CSV_PATH, csvText, 'utf8')
  cached = undefined
  adminBaseCache = undefined

  return {
    savedPath: CSV_PATH,
    recordCount: Math.max(0, rows.length - 1),
  }
}

export async function saveCheckCongWorkbook(buffer: Buffer): Promise<{
  savedPath: string
  recordCount: number
  sheetName: string
}> {
  const parsed = workbookBufferToCsvText(buffer)
  const result = await saveCheckCongCsv(parsed.csvText)

  return {
    ...result,
    recordCount: parsed.recordCount,
    sheetName: parsed.sheetName,
  }
}

function buildMonthlyStorageKey(month: string, contentSha256: string): string {
  const year = month.slice(0, 4)
  const monthValue = month.slice(5, 7)
  const prefix = STORAGE_PREFIX ? `${STORAGE_PREFIX}/` : ''
  return `${prefix}${year}/${monthValue}/check-cong-${month}-${Date.now()}-${contentSha256.slice(
    0,
    12,
  )}.csv`
}

async function persistCheckCongImport(input: {
  parsed: ParsedCheckCongCsv
  originalFileName: string
  originalFileType: 'csv' | 'excel'
  sheetName?: string | null
  uploadedByEmail?: string | null
}): Promise<CheckCongImportResult> {
  await ensureStorageBucket()
  await ensureCheckCongImportTable()

  const groupedRows = splitParsedCsvByMonth(input.parsed)
  const uploadedFiles: Array<{
    month: string
    recordCount: number
    storagePath: string
    bucket: string
    key: string
    size: number
    sha256: string
  }> = []

  const client = createSupabaseS3Client()
  for (const [month, rows] of groupedRows) {
    const csvText = `\uFEFF${serializeCSVRows(rows)}`
    const body = Buffer.from(csvText, 'utf8')
    const sha256 = createHash('sha256').update(body).digest('hex')
    const key = buildMonthlyStorageKey(month, sha256)

    await client.send(
      new PutObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: key,
        Body: body,
        ContentType: 'text/csv; charset=utf-8',
        Metadata: {
          period_month: month,
          source: 'check-cong',
        },
      }),
    )

    uploadedFiles.push({
      month,
      recordCount: Math.max(0, rows.length - 1),
      storagePath: `s3://${STORAGE_BUCKET}/${key}`,
      bucket: STORAGE_BUCKET,
      key,
      size: body.length,
      sha256,
    })
  }

  const dbClient = await pool.connect()
  try {
    await dbClient.query('BEGIN')
    for (const file of uploadedFiles) {
      await dbClient.query(
        `
        UPDATE check_cong_import_files
        SET is_active = FALSE
        WHERE period_month = $1
          AND is_active IS TRUE
        `,
        [file.month],
      )
      await dbClient.query(
        `
        INSERT INTO check_cong_import_files (
          period_month,
          original_file_name,
          original_file_type,
          sheet_name,
          s3_bucket,
          s3_key,
          file_size,
          record_count,
          content_sha256,
          uploaded_by_email,
          is_active,
          activated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, CURRENT_TIMESTAMP)
        `,
        [
          file.month,
          input.originalFileName,
          input.originalFileType,
          input.sheetName || null,
          file.bucket,
          file.key,
          file.size,
          file.recordCount,
          file.sha256,
          input.uploadedByEmail || null,
        ],
      )
    }
    await dbClient.query('COMMIT')
  } catch (error) {
    await dbClient.query('ROLLBACK')
    throw error
  } finally {
    dbClient.release()
  }

  cached = undefined
  adminBaseCache = undefined
  activeImportsCache = undefined
  storageCsvCache.clear()

  return {
    savedPath:
      uploadedFiles.length === 1
        ? uploadedFiles[0].storagePath
        : `s3://${STORAGE_BUCKET}/${STORAGE_PREFIX || ''}`,
    recordCount: uploadedFiles.reduce((sum, file) => sum + file.recordCount, 0),
    files: uploadedFiles.map((file) => ({
      month: file.month,
      recordCount: file.recordCount,
      storagePath: file.storagePath,
    })),
    sheetName: input.sheetName || undefined,
  }
}

export async function saveCheckCongImportCsv(input: {
  csvText: string
  originalFileName: string
  uploadedByEmail?: string | null
}): Promise<CheckCongImportResult> {
  const parsed = parseCheckCongCsvText(input.csvText, 'File CSV')
  return persistCheckCongImport({
    parsed,
    originalFileName: input.originalFileName,
    originalFileType: 'csv',
    uploadedByEmail: input.uploadedByEmail,
  })
}

export async function saveCheckCongImportWorkbook(input: {
  buffer: Buffer
  originalFileName: string
  uploadedByEmail?: string | null
}): Promise<CheckCongImportResult> {
  const workbook = workbookBufferToCsvText(input.buffer)
  const parsed = parseCheckCongCsvText(workbook.csvText, 'File Excel')
  return persistCheckCongImport({
    parsed,
    originalFileName: input.originalFileName,
    originalFileType: 'excel',
    sheetName: workbook.sheetName,
    uploadedByEmail: input.uploadedByEmail,
  })
}

export async function exportOriginalCheckCongRowsByKeys(
  checkKeys: string[],
): Promise<{ csv: string; count: number }> {
  const keys = new Set(checkKeys.filter(Boolean))
  if (keys.size === 0) return { csv: '', count: 0 }

  const activeFiles = await listActiveCheckCongImportFiles()
  const csvSources: string[] = []

  for (const file of activeFiles) {
    try {
      csvSources.push(await readStorageCsvText(file))
    } catch (error) {
      console.warn(
        `Không đọc được file check công khi export phản hồi (${file.periodMonth}):`,
        error,
      )
    }
  }

  try {
    csvSources.push(await fs.readFile(CSV_PATH, 'utf8'))
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error
  }

  let headers: string[] = []
  const matchedRows: string[][] = []
  const seenKeys = new Set<string>()

  for (const csvText of csvSources) {
    const rows = parseCSVRows(csvText)
    const sourceHeaders = rows[0] ?? []
    if (headers.length === 0 && sourceHeaders.length > 0) {
      headers = sourceHeaders
    }

    for (const values of rows.slice(1)) {
      const row: Record<string, string> = {}
      sourceHeaders.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      const record = rowToRecord(row)
      if (keys.has(record.checkKey) && !seenKeys.has(record.checkKey)) {
        const outputHeaders = headers.length > 0 ? headers : sourceHeaders
        matchedRows.push(outputHeaders.map((header) => row[header] || ''))
        seenKeys.add(record.checkKey)
      }
    }
  }

  const csvRows = [headers, ...matchedRows].map((row) =>
    row
      .map((value) => {
        const text = String(value ?? '')
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
      })
      .join(','),
  )

  const csv = csvRows.join('\r\n')
  return { csv: csv ? `\uFEFF${csv}` : csv, count: matchedRows.length }
}

function matchesAdminQuery(record: CheckCongRecord, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true

  const className = String(record.className ?? '').trim()
  const sessionTitle =
    className && !['undefined', 'null'].includes(className.toLowerCase())
      ? className
      : record.type === 'OFFICE_HOURS'
        ? 'trực trải nghiệm ca trực trải nghiệm'
        : ''

  return [
    sessionTitle,
    record.teacherName,
    record.username,
    record.workEmail,
    record.personalEmail,
    record.centre,
    record.className,
    record.course,
    record.courseLine,
    record.roleType,
    record.type,
  ]
    .map(normalizeSearchText)
    .join(' ')
    .includes(normalizedQuery)
}

function buildAdminMonthBase(
  allRecords: CheckCongRecord[],
  month: string,
): AdminMonthBase {
  const scoped = allRecords
    .filter((record) => sameMonth(record, month))
    .sort((a, b) => {
      const dateA = parseSlotDate(a.slotTime)?.getTime() ?? 0
      const dateB = parseSlotDate(b.slotTime)?.getTime() ?? 0
      return dateB - dateA
    })

  const teacherMap = new Map<
    string,
    {
      teacherName: string
      username: string
      workEmail: string
      checkedRecords: number
      totalRecords: number
      centres: Set<string>
    }
  >()

  for (const record of scoped) {
    const key =
      normalize(record.username) ||
      normalize(record.workEmail) ||
      normalize(record.teacherName)
    if (!key) continue

    const current =
      teacherMap.get(key) ||
      {
        teacherName: record.teacherName,
        username: record.username,
        workEmail: record.workEmail,
        checkedRecords: 0,
        totalRecords: 0,
        centres: new Set<string>(),
      }

    current.totalRecords += 1
    if (record.status === 'CHECKED') current.checkedRecords += 1
    if (record.centre) current.centres.add(record.centre)
    teacherMap.set(key, current)
  }

  const teacherRanking = Array.from(teacherMap.values())
    .map((teacher) => ({
      teacherName: teacher.teacherName,
      username: teacher.username,
      workEmail: teacher.workEmail,
      checkedRecords: teacher.checkedRecords,
      totalRecords: teacher.totalRecords,
      centres: Array.from(teacher.centres).sort(),
    }))
    .sort((a, b) => {
      if (b.checkedRecords !== a.checkedRecords) {
        return b.checkedRecords - a.checkedRecords
      }
      return a.teacherName.localeCompare(b.teacherName, 'vi')
    })

  const checkedByType = scoped.reduce<Record<string, number>>((acc, record) => {
    if (record.status !== 'CHECKED') return acc
    const key = record.type || 'UNKNOWN'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return {
    scoped,
    summary: buildSummary(scoped, month),
    analytics: {
      teacherCount: teacherMap.size,
      checkedByType,
      teacherRanking,
      topTeachers: teacherRanking.slice(0, 10),
      monthLabel: /^\d{4}-\d{2}$/.test(month) ? month : 'all',
    },
  }
}

export async function getAdminCheckCong(input: {
  month?: string
  page?: number
  limit?: number
  status?: string
  query?: string
}) {
  const month = input.month || 'all'
  const page = Math.max(1, Math.floor(input.page || 1))
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit || 20)))
  const status = normalize(input.status)
  const query = input.query || ''
  const checkCongData = await loadCheckCongData(month)
  const allRecords = checkCongData.records
  if (!adminBaseCache || adminBaseCache.cacheKey !== checkCongData.cacheKey) {
    adminBaseCache = {
      cacheKey: checkCongData.cacheKey,
      months: checkCongData.availableMonths,
      byMonth: new Map(),
    }
  }
  let base = adminBaseCache.byMonth.get(month)
  if (!base) {
    base = buildAdminMonthBase(allRecords, month)
    adminBaseCache.byMonth.set(month, base)
  }

  const filtered = base.scoped.filter((record) => {
    if (status && status !== 'all' && normalize(record.status) !== status) {
      return false
    }
    return matchesAdminQuery(record, query)
  })
  const offset = (page - 1) * limit
  const paginatedRecords = filtered.slice(offset, offset + limit)

  return {
    summary: base.summary,
    records: paginatedRecords,
    totalAvailableRecords: allRecords.length,
    availableMonths: adminBaseCache.months,
    pagination: {
      page,
      limit,
      totalRecords: filtered.length,
      returnedRecords: paginatedRecords.length,
      hasMore: offset + paginatedRecords.length < filtered.length,
    },
    analytics: base.analytics,
  }
}

export async function getTeacherCheckCong(input: {
  email: string
  personalEmail?: string
  username?: string
  code?: string
  month?: string
  hourlyRate?: number | null
}) {
  const month = input.month || 'all'
  const records = await loadCheckCongRecords(month)
  const lookup = new Set(
    [input.email, input.personalEmail, input.username, input.code]
      .map(normalize)
      .filter(Boolean),
  )

  const teacherRecords = records.filter((record) => {
    const candidates = [
      record.workEmail,
      record.personalEmail,
      record.username,
      record.username ? `${record.username}@mindx.net.vn` : '',
    ].map(normalize)
    return candidates.some((candidate) => lookup.has(candidate))
  })

  const scoped = teacherRecords
    .filter((record) => sameMonth(record, month))
    .map((record) => ({
      ...record,
      ...calculateSalary(record, input.hourlyRate ?? null),
    }))
    .sort((a, b) => {
      const dateA = parseSlotDate(a.slotTime)?.getTime() ?? 0
      const dateB = parseSlotDate(b.slotTime)?.getTime() ?? 0
      return dateB - dateA
    })

  return {
    summary: buildSummary(scoped, month),
    records: scoped,
    totalMatchedRecords: teacherRecords.length,
  }
}
