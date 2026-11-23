import type { PoolClient } from 'pg'

import pool from '@/lib/db'
import { decryptEmailCredential, encryptEmailCredential } from '@/lib/email-account-crypto'
import { chooseNextEmailAccountId } from '@/lib/email-account-router'

export type EmailAccountSource = 'database'

export interface EmailSenderAccount {
  id: number
  accountKey: string
  email: string
  displayName: string
  source: EmailAccountSource
  encryptedAppPassword: string | null
  isActive: boolean
  dailyToLimit: number
  dailyCcLimit: number
  sortOrder: number
}

export interface ResolvedEmailSenderAccount extends EmailSenderAccount {
  appPassword: string
}

type AccountRow = {
  id: unknown
  account_key: unknown
  email: unknown
  display_name: unknown
  source: unknown
  encrypted_app_password: unknown
  is_active: unknown
  daily_to_limit: unknown
  daily_cc_limit: unknown
  sort_order: unknown
}

function getEncryptionSecret(): string {
  const secret = process.env.EMAIL_CREDENTIAL_ENCRYPTION_KEY?.trim()
  if (!secret) {
    throw new Error('EMAIL_CREDENTIAL_ENCRYPTION_KEY chưa được cấu hình.')
  }
  return secret
}

function mapAccountRow(row: AccountRow): EmailSenderAccount {
  return {
    id: Number(row.id),
    accountKey: String(row.account_key),
    email: String(row.email),
    displayName: String(row.display_name || 'TPS Teaching'),
    source: 'database',
    encryptedAppPassword: row.encrypted_app_password
      ? String(row.encrypted_app_password)
      : null,
    isActive: Boolean(row.is_active),
    dailyToLimit: Number(row.daily_to_limit || 2000),
    dailyCcLimit: Number(row.daily_cc_limit || 2000),
    sortOrder: Number(row.sort_order || 0),
  }
}

function resolveCredential(account: EmailSenderAccount): string {
  if (!account.encryptedAppPassword) {
    throw new Error(`Tài khoản ${account.email} chưa có App Password trong database. Chọn Sửa để thiết lập.`)
  }
  const password = decryptEmailCredential(account.encryptedAppPassword, getEncryptionSecret()).replace(/\s+/g, '')
  if (!password) throw new Error('App Password được lưu đang trống.')
  return password
}

async function getAccountRows(
  client: PoolClient,
  whereSql: string,
  values: unknown[] = [],
): Promise<EmailSenderAccount[]> {
  const result = await client.query<AccountRow>(
    `SELECT
       id, account_key, email, display_name, source,
       encrypted_app_password, is_active,
       daily_to_limit, daily_cc_limit, sort_order
     FROM email_sender_accounts
     WHERE ${whereSql}
     ORDER BY sort_order, id`,
    values,
  )
  return result.rows.map(mapAccountRow)
}

export async function getEmailSenderAccount(
  accountId: number,
): Promise<ResolvedEmailSenderAccount | null> {
  const client = await pool.connect()
  try {
    const accounts = await getAccountRows(client, 'id = $1', [accountId])
    const account = accounts[0]
    return account
      ? { ...account, appPassword: resolveCredential(account) }
      : null
  } finally {
    client.release()
  }
}

export async function getFirstActiveEmailSenderAccount(): Promise<
  ResolvedEmailSenderAccount | null
> {
  const client = await pool.connect()
  try {
    const accounts = await getAccountRows(client, 'is_active = TRUE')
    for (const account of accounts) {
      try { return { ...account, appPassword: resolveCredential(account) } }
      catch { /* A broken credential must not hide another configured account. */ }
    }
    return null
  } finally {
    client.release()
  }
}

export async function selectNextEmailSenderAccount(excludedIds: number[] = []): Promise<
  ResolvedEmailSenderAccount | null
> {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO email_sender_routing_state (id)
       VALUES (1)
       ON CONFLICT (id) DO NOTHING`,
    )
    const stateResult = await client.query(
      `SELECT last_account_id
       FROM email_sender_routing_state
       WHERE id = 1
       FOR UPDATE`,
    )
    const candidates = await getAccountRows(client, `is_active = TRUE AND (
      last_verify_ok IS DISTINCT FROM FALSE OR last_verified_at IS NULL
      OR last_verified_at <= NOW() - INTERVAL '2 minutes'
    )`)
    const credentials = new Map<number, string>()
    const accounts = candidates.filter(account => {
      if (excludedIds.includes(account.id)) return false
      try { credentials.set(account.id, resolveCredential(account)); return true }
      catch { return false }
    })
    const nextId = chooseNextEmailAccountId(
      accounts.map((account) => account.id),
      stateResult.rows[0]?.last_account_id
        ? Number(stateResult.rows[0].last_account_id)
        : null,
    )

    if (nextId === null) {
      await client.query('COMMIT')
      return null
    }

    const selected = accounts.find((account) => account.id === nextId)
    if (!selected) {
      throw new Error('Không tìm thấy tài khoản email đã được chọn.')
    }

    const resolved = {
      ...selected,
      appPassword: credentials.get(selected.id)!,
    }
    await client.query(
      `UPDATE email_sender_routing_state
       SET last_account_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [selected.id],
    )
    await client.query(
      `UPDATE email_sender_accounts
       SET last_selected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [selected.id],
    )
    await client.query('COMMIT')
    return resolved
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getEmailAccountConfigurationSummary(): Promise<{
  configured: boolean
  activeAccountCount: number
  totalAccountCount: number
  senderEmail: string | null
}> {
  const accounts = await listEmailSenderAccountsWithQuota()
  const ready = accounts.filter(account => account.isActive && account.credentialConfigured)
  return {
    configured: ready.length > 0,
    activeAccountCount: ready.length,
    totalAccountCount: accounts.length,
    senderEmail: ready[0]?.email || null,
  }
}

export async function recordEmailAccountVerification(
  accountId: number,
  ok: boolean,
  error?: string,
): Promise<void> {
  await pool.query(
    `UPDATE email_sender_accounts
     SET
       last_verified_at = CURRENT_TIMESTAMP,
       last_verify_ok = $2,
       last_verify_error = $3,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [accountId, ok, error?.slice(0, 2000) || null],
  )
}

export function isEmailCredentialEncryptionConfigured(): boolean {
  return Boolean(process.env.EMAIL_CREDENTIAL_ENCRYPTION_KEY?.trim())
}

export interface EmailSenderAccountListItem {
  id: number
  accountKey: string
  email: string
  displayName: string
  source: EmailAccountSource
  isActive: boolean
  dailyToLimit: number
  dailyCcLimit: number
  sortOrder: number
  toUsed24h: number
  ccUsed24h: number
  lastSelectedAt: string | null
  lastVerifiedAt: string | null
  lastVerifyOk: boolean | null
  lastVerifyError: string | null
  credentialConfigured: boolean
  configurationError: string | null
  cooldownUntil: string | null
  credentialSource: EmailAccountSource | null
}

type AccountQuotaRow = AccountRow & {
  to_used_24h: unknown
  cc_used_24h: unknown
  last_selected_at: unknown
  last_verified_at: unknown
  last_verify_ok: unknown
  last_verify_error: unknown
}

function mapAccountListRow(row: AccountQuotaRow): EmailSenderAccountListItem {
  const account = mapAccountRow(row)
  let credentialConfigured = false
  let configurationError: string | null = null
  try { credentialConfigured = Boolean(resolveCredential(account)) }
  catch { configurationError = account.encryptedAppPassword
    ? 'Không giải mã được App Password. Kiểm tra khóa mã hóa hoặc lưu lại mật khẩu.'
    : 'Thiếu App Password ở môi trường đang chạy. Lưu App Password trong TPS hoặc bổ sung cấu hình máy chủ.' }
  return {
    id: account.id,
    accountKey: account.accountKey,
    email: account.email,
    displayName: account.displayName,
    source: account.source,
    isActive: account.isActive,
    dailyToLimit: account.dailyToLimit,
    dailyCcLimit: account.dailyCcLimit,
    sortOrder: account.sortOrder,
    credentialConfigured,
    credentialSource: credentialConfigured ? 'database' : null,
    configurationError,
    cooldownUntil: row.last_verify_ok === false && row.last_verified_at
      ? new Date(new Date(String(row.last_verified_at)).getTime() + 120_000).toISOString()
      : null,
    toUsed24h: Number(row.to_used_24h || 0),
    ccUsed24h: Number(row.cc_used_24h || 0),
    lastSelectedAt: row.last_selected_at
      ? String(row.last_selected_at)
      : null,
    lastVerifiedAt: row.last_verified_at
      ? String(row.last_verified_at)
      : null,
    lastVerifyOk:
      row.last_verify_ok === null || row.last_verify_ok === undefined
        ? null
        : Boolean(row.last_verify_ok),
    lastVerifyError: row.last_verify_error
      ? String(row.last_verify_error)
      : null,
  }
}

export async function listEmailSenderAccountsWithQuota(): Promise<
  EmailSenderAccountListItem[]
> {
  const result = await pool.query<AccountQuotaRow>(
    `SELECT
       a.id, a.account_key, a.email, a.display_name, a.source,
       a.encrypted_app_password, a.is_active,
       a.daily_to_limit, a.daily_cc_limit, a.sort_order,
       a.last_selected_at, a.last_verified_at, a.last_verify_ok,
       a.last_verify_error,
       COALESCE(q.to_used_24h, 0)::int AS to_used_24h,
       COALESCE(q.cc_used_24h, 0)::int AS cc_used_24h
     FROM email_sender_accounts a
     LEFT JOIN (
       SELECT
         sender_account_id,
         COALESCE(SUM(to_recipient_count) FILTER (WHERE status = 'sent'), 0)::int AS to_used_24h,
         COALESCE(SUM(cc_recipient_count) FILTER (WHERE status = 'sent'), 0)::int AS cc_used_24h
       FROM email_delivery_logs
       WHERE created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY sender_account_id
     ) q ON q.sender_account_id = a.id
     ORDER BY a.sort_order, a.id`,
  )
  return result.rows.map(mapAccountListRow)
}

function slugifyAccountKey(email: string): string {
  const base = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `db-${base || 'account'}`
}

export async function createDatabaseEmailSenderAccount(input: {
  email: string
  displayName: string
  appPassword: string
  dailyToLimit?: number
  dailyCcLimit?: number
  createdByEmail?: string
}): Promise<EmailSenderAccountListItem> {
  if (!isEmailCredentialEncryptionConfigured()) {
    throw new Error(
      'EMAIL_CREDENTIAL_ENCRYPTION_KEY chưa được cấu hình — không thể lưu tài khoản mới.',
    )
  }

  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email không hợp lệ.')
  }

  const appPassword = input.appPassword.replace(/\s+/g, '').trim()
  if (!appPassword) {
    throw new Error('App Password không được để trống.')
  }

  const existingEmail = await pool.query(
    'SELECT id FROM email_sender_accounts WHERE LOWER(email) = $1 LIMIT 1',
    [email],
  )
  if (existingEmail.rows.length > 0) {
    throw new Error('Email này đã có trong danh sách. Chọn Sửa để cập nhật App Password hoặc bật lại tài khoản.')
  }
  const settingsResult = await pool.query(
    `SELECT default_to_limit, default_cc_limit
     FROM email_monitor_settings WHERE id = 1`,
  )
  const dailyToLimit = Math.max(
    1,
    input.dailyToLimit ??
      Number(settingsResult.rows[0]?.default_to_limit || 2000),
  )
  const dailyCcLimit = Math.max(
    1,
    input.dailyCcLimit ??
      Number(settingsResult.rows[0]?.default_cc_limit || 2000),
  )
  const displayName = input.displayName.trim() || 'TPS Teaching'
  const encrypted = encryptEmailCredential(
    appPassword,
    getEncryptionSecret(),
  )

  const sortResult = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order
     FROM email_sender_accounts`,
  )
  const sortOrder = Number(sortResult.rows[0]?.next_order || 30)
  let accountKey = slugifyAccountKey(email)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const insertResult = await pool.query(
        `INSERT INTO email_sender_accounts (
          account_key, email, display_name, source, encrypted_app_password,
          is_active, daily_to_limit, daily_cc_limit, sort_order,
          created_by_email, updated_at
        ) VALUES ($1, $2, $3, 'database', $4, TRUE, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING id`,
        [
          accountKey,
          email,
          displayName,
          encrypted,
          dailyToLimit,
          dailyCcLimit,
          sortOrder,
          input.createdByEmail || null,
        ],
      )
      const accountId = Number(insertResult.rows[0]?.id)
      const accounts = await listEmailSenderAccountsWithQuota()
      const created = accounts.find((item) => item.id === accountId)
      if (!created) {
        throw new Error('Không tải được tài khoản vừa tạo.')
      }
      return created
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : ''
      if (code === '23505') {
        if (error && typeof error === 'object' && 'constraint' in error && error.constraint === 'uq_email_sender_accounts_email') {
          throw new Error('Email này đã có trong danh sách. Chọn Sửa để cập nhật tài khoản.')
        }
        accountKey = `${slugifyAccountKey(email)}-${attempt + 2}`
        continue
      }
      throw error
    }
  }

  throw new Error('Không tạo được tài khoản email.')
}

export async function updateEmailSenderAccount(input: {
  accountId: number
  isActive?: boolean
  displayName?: string
  dailyToLimit?: number
  dailyCcLimit?: number
  appPassword?: string
}): Promise<EmailSenderAccountListItem | null> {
  const existing = await pool.query<AccountRow>(
    `SELECT
       id, account_key, email, display_name, source,
       encrypted_app_password, is_active,
       daily_to_limit, daily_cc_limit, sort_order
     FROM email_sender_accounts
     WHERE id = $1`,
    [input.accountId],
  )
  const account = existing.rows[0]
  if (!account) return null

  const updates: string[] = []
  const values: unknown[] = []

  if (typeof input.isActive === 'boolean') {
    values.push(input.isActive)
    updates.push(`is_active = $${values.length}`)
  }
  if (input.displayName !== undefined) {
    values.push(input.displayName.trim() || 'TPS Teaching')
    updates.push(`display_name = $${values.length}`)
  }
  if (input.dailyToLimit !== undefined) {
    values.push(Math.max(1, input.dailyToLimit))
    updates.push(`daily_to_limit = $${values.length}`)
  }
  if (input.dailyCcLimit !== undefined) {
    values.push(Math.max(1, input.dailyCcLimit))
    updates.push(`daily_cc_limit = $${values.length}`)
  }
  if (input.appPassword !== undefined) {
    if (!isEmailCredentialEncryptionConfigured()) {
      throw new Error('EMAIL_CREDENTIAL_ENCRYPTION_KEY chưa được cấu hình.')
    }
    const normalized = input.appPassword.replace(/\s+/g, '').trim()
    if (!normalized) {
      throw new Error('App Password không được để trống.')
    }
    values.push(
      encryptEmailCredential(normalized, getEncryptionSecret()),
    )
    updates.push(`encrypted_app_password = $${values.length}`)
    updates.push('last_verify_ok = NULL', 'last_verify_error = NULL')
  }

  if (updates.length === 0) {
    const accounts = await listEmailSenderAccountsWithQuota()
    return accounts.find((item) => item.id === input.accountId) || null
  }

  values.push(input.accountId)
  await pool.query(
    `UPDATE email_sender_accounts
     SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length}`,
    values,
  )

  const accounts = await listEmailSenderAccountsWithQuota()
  return accounts.find((item) => item.id === input.accountId) || null
}

export async function deleteDatabaseEmailSenderAccount(
  accountId: number,
): Promise<{ deleted: boolean; reason?: string }> {
  const existing = await pool.query(
    `SELECT id, source FROM email_sender_accounts WHERE id = $1`,
    [accountId],
  )
  const account = existing.rows[0]
  if (!account) {
    return { deleted: false, reason: 'NOT_FOUND' }
  }

  await pool.query(`DELETE FROM email_sender_accounts WHERE id = $1`, [
    accountId,
  ])
  return { deleted: true }
}
