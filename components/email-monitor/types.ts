export type EmailHealthStatus = 'healthy' | 'warning' | 'critical' | 'no_data'
export type EmailDeliveryStatus = 'sent' | 'failed' | 'skipped'

export interface EmailSummary {
  attempts: number
  sent: number
  failed: number
  skipped: number
  messages: number
  recipients: number
  avgLatencyMs: number
  p95LatencyMs: number
  maxLatencyMs: number
}

export interface EmailSeriesPoint {
  bucket: string
  attempts: number
  sent: number
  failed: number
  skipped?: number
  recipients: number
  avgLatencyMs: number
}

export interface EmailDeliveryLog {
  id: number
  status: EmailDeliveryStatus
  sender_email: string | null
  to_recipients: string[]
  cc_recipients: string[]
  recipient_count: number
  subject: string
  email_type: string
  source: string
  duration_ms: number
  provider_message_id: string | null
  smtp_response: string | null
  error_code: string | null
  error_category: string | null
  error_message: string | null
  response_code: number | null
  retryable: boolean
  metadata: Record<string, unknown>
  created_at: string
  completed_at: string
}

export interface EmailMonitorSettings {
  dailyMessageLimit: number
  dailyRecipientLimit: number
  warningThresholdPercent: number
  latencyWarningMs: number
  failureRateWarningPercent: number
  retentionDays: number
  updatedAt?: string | null
  updatedByEmail?: string | null
}

export interface EmailSenderAccountItem {
  id: number
  accountKey: string
  email: string
  displayName: string
  source: 'database'
  isActive: boolean
  credentialConfigured: boolean
  configurationError: string | null
  cooldownUntil: string | null
  credentialSource: 'database' | null
  dailyToLimit: number
  dailyCcLimit: number
  sortOrder: number
  toUsed24h: number
  ccUsed24h: number
  lastSelectedAt: string | null
  lastVerifiedAt: string | null
  lastVerifyOk: boolean | null
  lastVerifyError: string | null
}

export interface EmailMonitorResponse {
  success: boolean
  generatedAt: string
  period: '24h' | '7d' | '30d'
  summary: EmailSummary
  quota24h: EmailSummary
  health: {
    status: EmailHealthStatus
    reasons: Array<{
      code: string
      severity: 'warning' | 'critical'
      message: string
    }>
    failureRatePercent: number
    messageUsagePercent: number
    recipientUsagePercent: number
  }
  settings: EmailMonitorSettings
  configuration: {
    configured: boolean
    userConfigured: boolean
    passwordConfigured: boolean
    senderEmail: string | null
    provider: string
    internalSecretConfigured: boolean
    databaseConnected: boolean
  }
  diagnostics: {
    consecutiveFailures: number
    peakHour: EmailSeriesPoint
    latestFailure: {
      status: string
      created_at: string
      error_category: string | null
      error_code: string | null
      error_message: string | null
    } | null
    latestAttempt: {
      status: string
      created_at: string
      error_category: string | null
      error_code: string | null
      error_message: string | null
    } | null
  }
  hourly: EmailSeriesPoint[]
  daily: EmailSeriesPoint[]
  breakdowns: {
    status: Array<{ name: string; count: number }>
    errors: Array<{
      category: string
      code: string
      count: number
      lastSeenAt: string
      sampleMessage: string | null
    }>
    emailTypes: Array<{ name: string; count: number; failed: number }>
    sources: Array<{ name: string; count: number; failed: number }>
    latency: Array<{ name: string; count: number }>
  }
  logs: EmailDeliveryLog[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  accounts: EmailSenderAccountItem[]
  credentialEncryptionConfigured: boolean
}
