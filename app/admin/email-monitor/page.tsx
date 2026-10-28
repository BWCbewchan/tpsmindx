'use client'
import { useQueryState, isQueryUserEdit, resetQueryPage } from '@/lib/use-query-state'


import { PageContainer } from '@/components/PageContainer'
import { EmailLoadChart } from '@/components/email-monitor/EmailLoadChart'
import { EmailStatusDonut } from '@/components/email-monitor/EmailStatusDonut'
import type {
  EmailDeliveryLog,
  EmailHealthStatus,
  EmailMonitorResponse,
  EmailMonitorSettings,
  EmailSenderAccountItem,
} from '@/components/email-monitor/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { toast } from '@/lib/app-toast'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Clock3,
  Database,
  Eraser,
  ExternalLink,
  Gauge,
  Inbox,
  MailCheck,
  MailWarning,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Send,
  ServerCog,
  Settings2,
  ShieldCheck,
  Timer,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SOURCE_LABELS: Record<string, string> = {
  env: 'Biến môi trường',
  database: 'Thêm từ UI',
}

const GOOGLE_APP_PASSWORDS_URL = 'https://myaccount.google.com/apppasswords'

function openGoogleAppPasswords() {
  window.open(GOOGLE_APP_PASSWORDS_URL, '_blank', 'noopener,noreferrer')
}

function AppPasswordFieldHeader({
  htmlFor,
  label,
}: {
  htmlFor: string
  label: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 shrink-0 px-2.5 text-xs"
        onClick={openGoogleAppPasswords}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Lấy App Password
      </Button>
    </div>
  )
}
const HEALTH_META: Record<
  EmailHealthStatus,
  { label: string; className: string; dot: string }
> = {
  healthy: {
    label: 'Hệ thống tốt',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  warning: {
    label: 'Cần theo dõi',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    dot: 'bg-amber-500',
  },
  critical: {
    label: 'Có sự cố',
    className: 'border-red-200 bg-red-50 text-red-800',
    dot: 'bg-red-500',
  },
  no_data: {
    label: 'Chưa có dữ liệu',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    dot: 'bg-slate-400',
  },
}

const STATUS_LABELS: Record<string, string> = {
  sent: 'Thành công',
  failed: 'Thất bại',
  skipped: 'Bỏ qua',
}

const CATEGORY_LABELS: Record<string, string> = {
  authentication: 'Xác thực',
  configuration: 'Cấu hình',
  network: 'Mạng',
  provider: 'Nhà cung cấp',
  quota: 'Quota',
  recipient: 'Người nhận',
  unknown: 'Không xác định',
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('vi-VN')
}

function formatDuration(value: number) {
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} giây`
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

function statusClass(status: string) {
  if (status === 'sent') return 'bg-emerald-100 text-emerald-800'
  if (status === 'failed') return 'bg-red-100 text-red-800'
  return 'bg-amber-100 text-amber-800'
}

function quotaTone(percent: number) {
  if (percent >= 100) return 'bg-red-500'
  if (percent >= 80) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function QuotaBar({
  label,
  value,
  limit,
  percent,
  hint,
}: {
  label: string
  value: number
  limit: number
  percent: number
  hint: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <p className="font-mono text-sm font-bold text-slate-900">
          {formatNumber(value)} / {formatNumber(limit)}
        </p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${quotaTone(percent)}`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{percent.toFixed(1)}% đã dùng</span>
        <span>Còn khoảng {formatNumber(Math.max(0, limit - value))}</span>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'slate',
}: {
  label: string
  value: string
  helper: string
  icon: typeof Activity
  tone?: 'slate' | 'green' | 'red' | 'amber' | 'teal'
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    teal: 'bg-teal-100 text-teal-700',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`inline-flex rounded-xl p-2 ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  )
}

export default function EmailMonitorPage() {
  const { user, token, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<EmailMonitorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [period, setPeriod] = useQueryState<'24h' | '7d' | '30d'>('period', '24h', { values: ["24h","7d","30d"] })
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [page, setPage] = useQueryState<number>('page', 1)
  const [search, setSearch] = useQueryState<string>('search', '')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useQueryState<string>('status', '')
  const [category, setCategory] = useQueryState<string>('category', '')
  const [emailType, setEmailType] = useQueryState<string>('emailType', '')
  const [selectedLog, setSelectedLog] = useState<EmailDeliveryLog | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState<EmailMonitorSettings | null>(null)
  const [testing, setTesting] = useState<'verify' | 'send' | ''>('')
  const [testRecipient, setTestRecipient] = useState('')
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<EmailSenderAccountItem | null>(null)
  const [accountBusyId, setAccountBusyId] = useState<number | 'add' | null>(null)
  const [accountTestRecipients, setAccountTestRecipients] = useState<Record<number, string>>({})
  const [accountTestSendingId, setAccountTestSendingId] = useState<number | null>(null)
  const [addAccountForm, setAddAccountForm] = useState({
    email: '',
    displayName: 'TPS Teaching',
    appPassword: '',
    dailyToLimit: '2000',
    dailyCcLimit: '2000',
  })
  const [editAccountForm, setEditAccountForm] = useState({
    displayName: '',
    dailyToLimit: '',
    dailyCcLimit: '',
    appPassword: '',
  })
  const activeRequestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!authLoading && user?.role !== 'super_admin') {
      router.replace('/admin/dashboard')
    }
  }, [authLoading, router, user?.role])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      void (isQueryUserEdit() && resetQueryPage(setPage))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [search])

  const loadData = useCallback(
    async (silent = false) => {
      if (user?.role !== 'super_admin') return
      if (silent && activeRequestRef.current) return

      activeRequestRef.current?.abort()
      const controller = new AbortController()
      activeRequestRef.current = controller
      const timeout = window.setTimeout(() => controller.abort(), 12_000)

      if (silent) setRefreshing(true)
      else setLoading(true)
      try {
        const params = new URLSearchParams({
          period,
          page: String(page),
          pageSize: '25',
        })
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (status) params.set('status', status)
        if (category) params.set('category', category)
        if (emailType) params.set('emailType', emailType)

        const response = await fetch(`/api/admin/email-monitor?${params}`, {
          cache: 'no-store',
          headers: authHeaders(token),
          signal: controller.signal,
        })
        const payload = await response.json()
        if (!response.ok || payload.success !== true) {
          throw new Error(payload.error || 'Không tải được dữ liệu email')
        }
        setData(payload)
        setSettingsForm(payload.settings)
        setError('')
      } catch (loadError) {
        setError(
          loadError instanceof DOMException && loadError.name === 'AbortError'
            ? 'Máy chủ phản hồi quá 12 giây. Vui lòng kiểm tra kết nối database hoặc thử Làm mới.'
            : loadError instanceof Error
              ? loadError.message
              : 'Không tải được dữ liệu email',
        )
      } finally {
        window.clearTimeout(timeout)
        if (activeRequestRef.current === controller) {
          activeRequestRef.current = null
        }
        setLoading(false)
        setRefreshing(false)
      }
    },
    [category, debouncedSearch, emailType, page, period, status, token, user?.role],
  )

  useEffect(() => {
    void loadData()
    return () => activeRequestRef.current?.abort()
  }, [loadData])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(() => void loadData(true), 15_000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, loadData])

  const mutate = async (
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: Record<string, unknown>,
  ) => {
    const response = await fetch('/api/admin/email-monitor', {
      method,
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const payload = await response.json()
    if (!response.ok || payload.success !== true) {
      throw new Error(
        payload.error ||
          payload.result?.error ||
          payload.result?.warning ||
          'Thao tác thất bại',
      )
    }
    return payload
  }

  const saveSettings = async () => {
    if (!settingsForm) return
    setSavingSettings(true)
    try {
      await mutate('PATCH', { ...settingsForm })
      toast.success('Đã lưu ngưỡng giám sát email')
      setSettingsOpen(false)
      await loadData(true)
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Không lưu được cấu hình')
    } finally {
      setSavingSettings(false)
    }
  }

  const verifyConnection = async () => {
    setTesting('verify')
    try {
      const result = await mutate('POST', { action: 'verify' })
      toast.success(`Kết nối Gmail hoạt động (${formatDuration(result.result.durationMs)})`)
      await loadData(true)
    } catch (verifyError) {
      toast.error(verifyError instanceof Error ? verifyError.message : 'Kết nối Gmail thất bại')
    } finally {
      setTesting('')
    }
  }

  const sendTestEmail = async () => {
    setTesting('send')
    try {
      const result = await mutate('POST', {
        action: 'test_send',
        recipient: testRecipient || user?.email,
      })
      toast.success(`Đã gửi mail thử trong ${formatDuration(result.result.durationMs)}`)
      await loadData(true)
    } catch (sendError) {
      toast.error(sendError instanceof Error ? sendError.message : 'Gửi mail thử thất bại')
    } finally {
      setTesting('')
    }
  }

  const verifyAccount = async (accountId: number) => {
    setAccountBusyId(accountId)
    try {
      const result = await mutate('POST', {
        action: 'verify_account',
        accountId,
      })
      toast.success(`Kết nối OK (${formatDuration(result.result.durationMs)})`)
      await loadData(true)
    } catch (verifyError) {
      toast.error(verifyError instanceof Error ? verifyError.message : 'Kiểm tra thất bại')
    } finally {
      setAccountBusyId(null)
    }
  }

  const sendAccountTestEmail = async (account: EmailSenderAccountItem) => {
    const recipient = (
      accountTestRecipients[account.id] ||
      testRecipient ||
      user?.email ||
      ''
    ).trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      toast.error('Nhập email người nhận hợp lệ')
      return
    }

    setAccountTestSendingId(account.id)
    try {
      const result = await mutate('POST', {
        action: 'test_send',
        accountId: account.id,
        recipient,
      })
      const sender = result.result?.senderEmail || account.email
      toast.success(`Đã gửi từ ${sender} trong ${formatDuration(result.result.durationMs)}`)
      await loadData(true)
    } catch (sendError) {
      toast.error(sendError instanceof Error ? sendError.message : 'Gửi mail thử thất bại')
    } finally {
      setAccountTestSendingId(null)
    }
  }

  const toggleAccountActive = async (account: EmailSenderAccountItem) => {
    setAccountBusyId(account.id)
    try {
      await mutate('PATCH', {
        accountId: account.id,
        isActive: !account.isActive,
      })
      toast.success(account.isActive ? 'Đã tắt tài khoản' : 'Đã bật tài khoản')
      await loadData(true)
    } catch (toggleError) {
      toast.error(toggleError instanceof Error ? toggleError.message : 'Không cập nhật được trạng thái')
    } finally {
      setAccountBusyId(null)
    }
  }

  const deleteAccount = async (account: EmailSenderAccountItem) => {
    if (
      !window.confirm(
        `Xóa tài khoản ${account.email}? Hành động này không thể hoàn tác.`,
      )
    ) {
      return
    }
    setAccountBusyId(account.id)
    try {
      const response = await fetch(
        `/api/admin/email-monitor?accountId=${account.id}`,
        {
          method: 'DELETE',
          headers: authHeaders(token),
        },
      )
      const payload = await response.json()
      if (!response.ok || payload.success !== true) {
        throw new Error(payload.error || 'Không xóa được tài khoản')
      }
      toast.success('Đã xóa tài khoản email')
      await loadData(true)
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Không xóa được tài khoản')
    } finally {
      setAccountBusyId(null)
    }
  }

  const openEditAccount = (account: EmailSenderAccountItem) => {
    setEditAccount(account)
    setEditAccountForm({
      displayName: account.displayName,
      dailyToLimit: String(account.dailyToLimit),
      dailyCcLimit: String(account.dailyCcLimit),
      appPassword: '',
    })
  }

  const saveAccountEdit = async () => {
    if (!editAccount) return
    setAccountBusyId(editAccount.id)
    try {
      await mutate('PATCH', {
        accountId: editAccount.id,
        displayName: editAccountForm.displayName,
        dailyToLimit: Number(editAccountForm.dailyToLimit),
        dailyCcLimit: Number(editAccountForm.dailyCcLimit),
        ...(editAccountForm.appPassword.trim()
          ? { appPassword: editAccountForm.appPassword.replace(/\s+/g, '') }
          : {}),
      })
      toast.success('Đã lưu tài khoản email')
      setEditAccount(null)
      await loadData(true)
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Không lưu được tài khoản')
    } finally {
      setAccountBusyId(null)
    }
  }

  const createAccount = async () => {
    setAccountBusyId('add')
    try {
      await mutate('POST', {
        action: 'create_account',
        email: addAccountForm.email.trim(),
        displayName: addAccountForm.displayName.trim() || 'TPS Teaching',
        appPassword: addAccountForm.appPassword.replace(/\s+/g, ''),
        dailyToLimit: Number(addAccountForm.dailyToLimit),
        dailyCcLimit: Number(addAccountForm.dailyCcLimit),
      })
      toast.success('Đã thêm tài khoản email')
      setAddAccountOpen(false)
      setAddAccountForm({
        email: '',
        displayName: 'TPS Teaching',
        appPassword: '',
        dailyToLimit: '2000',
        dailyCcLimit: '2000',
      })
      await loadData(true)
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : 'Không thêm được tài khoản')
    } finally {
      setAccountBusyId(null)
    }
  }

  const cleanupLogs = async () => {
    if (!window.confirm(`Xóa log cũ hơn ${data?.settings.retentionDays || 90} ngày?`)) return
    try {
      const result = await mutate('DELETE')
      toast.success(`Đã xóa ${formatNumber(result.deleted)} log cũ`)
      await loadData(true)
    } catch (cleanupError) {
      toast.error(cleanupError instanceof Error ? cleanupError.message : 'Không dọn được log')
    }
  }

  const emailTypes = useMemo(
    () => data?.breakdowns.emailTypes.map((item) => item.name) || [],
    [data?.breakdowns.emailTypes],
  )
  const healthMeta = HEALTH_META[data?.health.status || 'no_data']

  if (authLoading || user?.role !== 'super_admin') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <RefreshCw className="h-7 w-7 animate-spin text-[#a1001f]" />
      </div>
    )
  }

  return (
    <PageContainer
      title="Giám sát Email"
      description="Theo dõi sức tải, quota vận hành, độ trễ và lỗi SMTP theo thời gian thực."
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="accent-[#a1001f]"
            />
            Tự cập nhật 15 giây
          </label>
          <button
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-[#a1001f] hover:text-[#a1001f] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#a1001f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#85001a]"
          >
            <Settings2 className="h-4 w-4" />
            Cấu hình
          </button>
        </div>
      }
    >
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Không tải được dashboard</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <RefreshCw className="h-8 w-8 animate-spin text-[#a1001f]" />
        </div>
      ) : data ? (
        <>
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-xl">
            <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_.7fr] lg:p-8">
              <div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${healthMeta.className}`}>
                  <span className={`h-2 w-2 rounded-full ${healthMeta.dot}`} />
                  {healthMeta.label}
                </div>
                <h2 className="mt-5 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
                  {data.health.status === 'healthy'
                    ? 'Luồng email đang vận hành ổn định.'
                    : data.health.status === 'no_data'
                      ? 'Chưa có lần gửi nào trong 24 giờ gần nhất.'
                      : 'Dashboard đã phát hiện tín hiệu cần xử lý.'}
                </h2>
                <div className="mt-4 space-y-2">
                  {data.health.reasons.length > 0 ? (
                    data.health.reasons.map((reason) => (
                      <div key={reason.code} className="flex items-start gap-2 text-sm text-slate-300">
                        {reason.severity === 'critical' ? (
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        )}
                        <span>{reason.message}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-300">
                      Không có lỗi cấu hình, tỷ lệ lỗi hoặc độ trễ vượt ngưỡng.
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Lỗi liên tiếp</p>
                  <p className="mt-2 text-3xl font-black">{data.diagnostics.consecutiveFailures}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Đỉnh theo giờ</p>
                  <p className="mt-2 text-3xl font-black">{formatNumber(data.diagnostics.peakHour?.attempts || 0)}</p>
                </div>
                <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Cập nhật gần nhất</p>
                  <p className="mt-2 font-mono text-sm text-slate-200">{formatDateTime(data.generatedAt)}</p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-xl border border-slate-200 bg-white p-1">
              {([
                ['24h', '24 giờ'],
                ['7d', '7 ngày'],
                ['30d', '30 ngày'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => {
                    setPeriod(value)
                    setPage(1)
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    period === value ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Quota luôn tính theo cửa sổ 24 giờ trượt; biểu đồ và bảng theo khoảng đã chọn.
            </p>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Lần gửi" value={formatNumber(data.summary.attempts)} helper={`${formatNumber(data.summary.sent)} thành công`} icon={Send} />
            <MetricCard label="Người nhận" value={formatNumber(data.summary.recipients)} helper="To và CC đã gửi" icon={Users} tone="teal" />
            <MetricCard label="Thành công" value={`${Math.max(0, 100 - data.health.failureRatePercent).toFixed(1)}%`} helper={`${formatNumber(data.summary.failed)} lần lỗi`} icon={MailCheck} tone="green" />
            <MetricCard label="Độ trễ TB" value={formatDuration(data.summary.avgLatencyMs)} helper={`P95: ${formatDuration(data.summary.p95LatencyMs)}`} icon={Timer} tone="amber" />
            <MetricCard label="Độ trễ cao nhất" value={formatDuration(data.summary.maxLatencyMs)} helper="Trong khoảng đang xem" icon={Zap} tone="amber" />
            <MetricCard label="Bỏ qua" value={formatNumber(data.summary.skipped)} helper="Thường do thiếu cấu hình" icon={MailWarning} tone={data.summary.skipped > 0 ? 'red' : 'slate'} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <QuotaBar
              label="Quota thư trong 24 giờ"
              value={data.quota24h.messages}
              limit={data.settings.dailyMessageLimit}
              percent={data.health.messageUsagePercent}
              hint="Một lần gửi được tính là một thư."
            />
            <QuotaBar
              label="Quota lượt người nhận trong 24 giờ"
              value={data.quota24h.recipients}
              limit={data.settings.dailyRecipientLimit}
              percent={data.health.recipientUsagePercent}
              hint="Mỗi địa chỉ To hoặc CC được tính một lượt."
            />
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">Quản lý tài khoản gửi mail</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Round-robin giữa các tài khoản active. Quota To/CC tính riêng trong 24 giờ.
                </p>
              </div>
              <Button
                onClick={() => setAddAccountOpen(true)}
                disabled={!data.credentialEncryptionConfigured}
                className="bg-[#a1001f] hover:bg-[#85001a]"
              >
                <Plus className="h-4 w-4" />
                Thêm tài khoản
              </Button>
            </div>

            {!data.credentialEncryptionConfigured && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Chưa cấu hình <code className="font-mono">EMAIL_CREDENTIAL_ENCRYPTION_KEY</code> — chỉ dùng được tài khoản từ env, không thêm mới từ UI.
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              {(data.accounts || []).map((account) => {
                const toPercent = account.dailyToLimit
                  ? (account.toUsed24h / account.dailyToLimit) * 100
                  : 0
                const ccPercent = account.dailyCcLimit
                  ? (account.ccUsed24h / account.dailyCcLimit) * 100
                  : 0
                const busy = accountBusyId === account.id
                const testSending = accountTestSendingId === account.id

                return (
                  <Card key={account.id} className={!account.isActive ? 'opacity-70' : ''}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">{account.displayName}</CardTitle>
                          <CardDescription className="mt-1 break-all font-mono text-xs">
                            {account.email}
                          </CardDescription>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                          <Badge variant={account.isActive ? 'success' : 'default'}>
                            {account.isActive ? 'Đang bật' : 'Đã tắt'}
                          </Badge>
                          <Badge variant="info">{SOURCE_LABELS[account.source] || account.source}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <QuotaBar
                        label="Quota To (24h)"
                        value={account.toUsed24h}
                        limit={account.dailyToLimit}
                        percent={toPercent}
                        hint="Số địa chỉ người nhận To đã gửi."
                      />
                      <QuotaBar
                        label="Quota CC (24h)"
                        value={account.ccUsed24h}
                        limit={account.dailyCcLimit}
                        percent={ccPercent}
                        hint="Số địa chỉ CC đã gửi."
                      />
                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
                        <div>
                          <p className="font-semibold uppercase tracking-wide">Kiểm tra gần nhất</p>
                          <p className="mt-1 text-slate-800">
                            {account.lastVerifiedAt
                              ? formatDateTime(account.lastVerifiedAt)
                              : '—'}
                          </p>
                          {account.lastVerifyOk === false && (
                            <p className="mt-1 line-clamp-2 text-red-600">{account.lastVerifyError}</p>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold uppercase tracking-wide">Dùng gần nhất</p>
                          <p className="mt-1 text-slate-800">
                            {account.lastSelectedAt
                              ? formatDateTime(account.lastSelectedAt)
                              : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-600">Gửi mail thử từ tài khoản này</p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <Input
                            type="email"
                            value={accountTestRecipients[account.id] ?? ''}
                            onChange={(event) =>
                              setAccountTestRecipients((current) => ({
                                ...current,
                                [account.id]: event.target.value,
                              }))
                            }
                            placeholder={user?.email || 'Email người nhận...'}
                            className="bg-white sm:flex-1"
                          />
                          <Button
                            size="sm"
                            disabled={testSending || busy}
                            onClick={() => void sendAccountTestEmail(account)}
                            className="shrink-0 bg-slate-950 hover:bg-slate-800"
                          >
                            <Send className={`h-4 w-4 ${testSending ? 'animate-pulse' : ''}`} />
                            Gửi mail thử
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || testSending}
                        onClick={() => void verifyAccount(account.id)}
                      >
                        <CircleGauge className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                        Kiểm tra
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || testSending}
                        onClick={() => openEditAccount(account)}
                      >
                        <Pencil className="h-4 w-4" />
                        Sửa
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || testSending}
                        onClick={() => void toggleAccountActive(account)}
                      >
                        <Power className="h-4 w-4" />
                        {account.isActive ? 'Tắt' : 'Bật'}
                      </Button>
                      {account.source === 'database' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy || testSending}
                          onClick={() => void deleteAccount(account)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Xóa
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                )
              })}
            </div>

            {(data.accounts || []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
                Chưa có tài khoản email nào. Thêm tài khoản hoặc cấu hình biến môi trường Gmail.
              </div>
            )}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.5fr_.5fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">Tải email 24 giờ</h3>
                  <p className="mt-1 text-xs text-slate-500">Số thư, lỗi và độ trễ trung bình theo giờ.</p>
                </div>
                <Activity className="h-5 w-5 text-[#a1001f]" />
              </div>
              <EmailLoadChart data={data.hourly} mode="hour" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-slate-900">Trạng thái lần gửi</h3>
              <EmailStatusDonut data={data.breakdowns.status} />
              <div className="space-y-2">
                {data.breakdowns.status.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{STATUS_LABELS[item.name] || item.name}</span>
                    <span className="font-mono font-bold text-slate-900">{formatNumber(item.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-slate-900">Xu hướng 14 ngày</h3>
              <p className="mt-1 text-xs text-slate-500">Dùng để nhận ra tăng tải hoặc suy giảm hiệu năng dài hạn.</p>
              <EmailLoadChart data={data.daily} mode="day" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">Kiểm tra cấu hình</h3>
                  <p className="mt-1 text-xs text-slate-500">Không hiển thị mật khẩu hoặc secret.</p>
                </div>
                <ServerCog className="h-5 w-5 text-slate-500" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ['Tài khoản Gmail', data.configuration.userConfigured, data.configuration.senderEmail || 'Chưa cấu hình', Inbox],
                  ['Mật khẩu ứng dụng', data.configuration.passwordConfigured, data.configuration.passwordConfigured ? 'Đã cấu hình' : 'Chưa cấu hình', ShieldCheck],
                  ['Internal API Secret', data.configuration.internalSecretConfigured, data.configuration.internalSecretConfigured ? 'Đã cấu hình' : 'Chưa cấu hình', ServerCog],
                  ['Database logging', data.configuration.databaseConnected, data.configuration.databaseConnected ? 'Đang kết nối' : 'Mất kết nối', Database],
                ].map(([label, ok, detail, Icon]) => {
                  const StatusIcon = Icon as typeof Inbox
                  return (
                    <div key={String(label)} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-4 w-4 text-slate-500" />
                        <p className="text-xs font-semibold text-slate-600">{String(label)}</p>
                        {ok ? <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" /> : <AlertCircle className="ml-auto h-4 w-4 text-red-600" />}
                      </div>
                      <p className="mt-2 break-all text-xs font-medium text-slate-900">{String(detail)}</p>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => void verifyConnection()}
                  disabled={Boolean(testing)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-[#a1001f] disabled:opacity-50"
                >
                  <CircleGauge className={`h-4 w-4 ${testing === 'verify' ? 'animate-spin' : ''}`} />
                  Kiểm tra kết nối
                </button>
                <button
                  onClick={() => void sendTestEmail()}
                  disabled={Boolean(testing)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Send className={`h-4 w-4 ${testing === 'send' ? 'animate-pulse' : ''}`} />
                  Gửi mail thử
                </button>
              </div>
              <input
                type="email"
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
                placeholder={`Mặc định gửi tới ${user.email}`}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-red-100"
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h3 className="font-bold text-slate-900">Lỗi cần xử lý</h3>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                {data.breakdowns.errors.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">Không có lỗi trong khoảng đang xem.</div>
                ) : (
                  data.breakdowns.errors.slice(0, 8).map((item) => (
                    <div key={`${item.category}-${item.code}`} className="border-b border-slate-100 p-4 last:border-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                          {CATEGORY_LABELS[item.category] || item.category}
                        </span>
                        <code className="text-xs font-semibold text-slate-700">{item.code}</code>
                        <span className="ml-auto font-mono text-sm font-bold text-slate-900">×{item.count}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.sampleMessage || 'Không có thông báo lỗi'}</p>
                      <p className="mt-1 text-xs text-slate-400">Lần cuối: {formatDateTime(item.lastSeenAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-slate-900">Phân bổ độ trễ</h3>
              <div className="mt-5 space-y-4">
                {data.breakdowns.latency.map((item) => {
                  const max = Math.max(...data.breakdowns.latency.map((entry) => entry.count), 1)
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-600">{item.name}</span>
                        <span className="font-mono font-bold text-slate-900">{item.count}</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-teal-600" style={{ width: `${(item.count / max) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">Nhật ký gửi email</h3>
                  <p className="mt-1 text-xs text-slate-500">{formatNumber(data.pagination.total)} bản ghi phù hợp.</p>
                </div>
                <button
                  onClick={() => void cleanupLogs()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-red-300 hover:text-red-700"
                >
                  <Eraser className="h-4 w-4" />
                  Dọn log quá hạn
                </button>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_150px_170px_200px]">
                <label className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm tiêu đề, người nhận, lỗi, message ID..."
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#a1001f]"
                  />
                </label>
                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Mọi trạng thái</option>
                  <option value="sent">Thành công</option>
                  <option value="failed">Thất bại</option>
                  <option value="skipped">Bỏ qua</option>
                </select>
                <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Mọi nhóm lỗi</option>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select value={emailType} onChange={(event) => { setEmailType(event.target.value); setPage(1) }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Mọi loại email</option>
                  {emailTypes.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Trạng thái</th>
                    <th className="px-5 py-3">Thời điểm</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Người nhận</th>
                    <th className="px-5 py-3">Độ trễ</th>
                    <th className="px-5 py-3">Lỗi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.logs.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Không có log phù hợp.</td></tr>
                  ) : data.logs.map((log) => (
                    <tr key={log.id} onClick={() => setSelectedLog(log)} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(log.status)}`}>
                          {STATUS_LABELS[log.status] || log.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">{formatDateTime(log.created_at)}</td>
                      <td className="max-w-[340px] px-5 py-4">
                        <p className="truncate font-semibold text-slate-900">{log.subject || '(Không có tiêu đề)'}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{log.email_type}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">{log.recipient_count}</p>
                        <p className="max-w-[220px] truncate text-xs text-slate-500">{log.to_recipients.join(', ')}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">{formatDuration(log.duration_ms)}</td>
                      <td className="max-w-[260px] px-5 py-4">
                        {log.error_code ? (
                          <>
                            <p className="font-mono text-xs font-bold text-red-700">{log.error_code}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{log.error_message}</p>
                          </>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
              <p className="text-xs text-slate-500">Trang {data.pagination.page} / {data.pagination.totalPages}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <button disabled={page >= data.pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm tài khoản Gmail</DialogTitle>
            <DialogDescription>
              App Password được mã hóa trong database. Không hiển thị lại sau khi lưu.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                value={addAccountForm.email}
                onChange={(event) =>
                  setAddAccountForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="hr-teaching@mindx.edu.vn"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-name">Tên hiển thị</Label>
              <Input
                id="add-name"
                value={addAccountForm.displayName}
                onChange={(event) =>
                  setAddAccountForm((current) => ({ ...current, displayName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <AppPasswordFieldHeader htmlFor="add-password" label="App Password" />
              <Input
                id="add-password"
                type="password"
                value={addAccountForm.appPassword}
                onChange={(event) =>
                  setAddAccountForm((current) => ({ ...current, appPassword: event.target.value }))
                }
                placeholder="xxxx xxxx xxxx xxxx"
              />
              <p className="text-xs text-muted-foreground">
                Tài khoản Google cần bật xác minh 2 bước. Bấm &quot;Lấy App Password&quot; để tạo mật khẩu ứng dụng.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-to-limit">Quota To / 24h</Label>
                <Input
                  id="add-to-limit"
                  type="number"
                  min="1"
                  value={addAccountForm.dailyToLimit}
                  onChange={(event) =>
                    setAddAccountForm((current) => ({ ...current, dailyToLimit: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-cc-limit">Quota CC / 24h</Label>
                <Input
                  id="add-cc-limit"
                  type="number"
                  min="1"
                  value={addAccountForm.dailyCcLimit}
                  onChange={(event) =>
                    setAddAccountForm((current) => ({ ...current, dailyCcLimit: event.target.value }))
                  }
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAccountOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => void createAccount()}
              disabled={accountBusyId === 'add'}
              className="bg-[#a1001f] hover:bg-[#85001a]"
            >
              {accountBusyId === 'add' && <RefreshCw className="h-4 w-4 animate-spin" />}
              Lưu tài khoản
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editAccount)} onOpenChange={(open) => !open && setEditAccount(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sửa tài khoản</DialogTitle>
            <DialogDescription>{editAccount?.email}</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Tên hiển thị</Label>
              <Input
                id="edit-name"
                value={editAccountForm.displayName}
                onChange={(event) =>
                  setEditAccountForm((current) => ({ ...current, displayName: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-to-limit">Quota To / 24h</Label>
                <Input
                  id="edit-to-limit"
                  type="number"
                  min="1"
                  value={editAccountForm.dailyToLimit}
                  onChange={(event) =>
                    setEditAccountForm((current) => ({ ...current, dailyToLimit: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cc-limit">Quota CC / 24h</Label>
                <Input
                  id="edit-cc-limit"
                  type="number"
                  min="1"
                  value={editAccountForm.dailyCcLimit}
                  onChange={(event) =>
                    setEditAccountForm((current) => ({ ...current, dailyCcLimit: event.target.value }))
                  }
                />
              </div>
            </div>
            {editAccount?.source === 'database' && (
              <div className="space-y-2">
                <AppPasswordFieldHeader
                  htmlFor="edit-password"
                  label="App Password mới (tùy chọn)"
                />
                <Input
                  id="edit-password"
                  type="password"
                  value={editAccountForm.appPassword}
                  onChange={(event) =>
                    setEditAccountForm((current) => ({ ...current, appPassword: event.target.value }))
                  }
                  placeholder="Để trống nếu không đổi"
                />
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAccount(null)}>
              Hủy
            </Button>
            <Button
              onClick={() => void saveAccountEdit()}
              disabled={accountBusyId === editAccount?.id}
              className="bg-[#a1001f] hover:bg-[#85001a]"
            >
              {accountBusyId === editAccount?.id && <RefreshCw className="h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {settingsOpen && settingsForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setSettingsOpen(false)}>
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h3 className="text-lg font-black text-slate-950">Ngưỡng giám sát</h3>
                <p className="mt-1 text-xs text-slate-500">Các ngưỡng này dùng để cảnh báo, không tự chặn gửi email.</p>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {[
                ['dailyMessageLimit', 'Hạn mức thư / 24 giờ', '2000'],
                ['dailyRecipientLimit', 'Hạn mức người nhận / 24 giờ', '10000'],
                ['warningThresholdPercent', 'Cảnh báo quota (%)', '80'],
                ['latencyWarningMs', 'Cảnh báo độ trễ P95 (ms)', '5000'],
                ['failureRateWarningPercent', 'Cảnh báo tỷ lệ lỗi (%)', '5'],
                ['retentionDays', 'Lưu log (ngày)', '90'],
              ].map(([key, label, placeholder]) => (
                <label key={key} className="text-sm font-semibold text-slate-700">
                  {label}
                  <input
                    type="number"
                    min="1"
                    value={String(settingsForm[key as keyof EmailMonitorSettings] ?? '')}
                    placeholder={placeholder}
                    onChange={(event) => setSettingsForm((current) => current ? { ...current, [key]: Number(event.target.value) } : current)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-red-100"
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <button onClick={() => setSettingsOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">Hủy</button>
              <button onClick={() => void saveSettings()} disabled={savingSettings} className="inline-flex items-center gap-2 rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {savingSettings && <RefreshCw className="h-4 w-4 animate-spin" />}
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/55" onClick={() => setSelectedLog(null)}>
          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(selectedLog.status)}`}>{STATUS_LABELS[selectedLog.status]}</span>
                  <code className="text-xs text-slate-500">#{selectedLog.id}</code>
                </div>
                <h3 className="mt-2 font-bold text-slate-950">Chi tiết lần gửi</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-5 p-5">
              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Tiêu đề</p>
                <p className="mt-2 font-semibold">{selectedLog.subject || '(Không có tiêu đề)'}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-slate-400">Độ trễ</p><p className="mt-1 font-mono">{formatDuration(selectedLog.duration_ms)}</p></div>
                  <div><p className="text-xs text-slate-400">Thời điểm</p><p className="mt-1 text-xs">{formatDateTime(selectedLog.created_at)}</p></div>
                </div>
              </div>
              {[
                ['Người gửi', selectedLog.sender_email || '—'],
                ['To', selectedLog.to_recipients.join(', ') || '—'],
                ['CC', selectedLog.cc_recipients.join(', ') || '—'],
                ['Loại email', selectedLog.email_type],
                ['Nguồn gọi', selectedLog.source],
                ['Message ID', selectedLog.provider_message_id || '—'],
                ['SMTP response', selectedLog.smtp_response || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
                  <p className="mt-1 break-all rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">{value}</p>
                </div>
              ))}
              {selectedLog.error_code && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <code className="font-bold text-red-800">{selectedLog.error_code}</code>
                    <span className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                      {CATEGORY_LABELS[selectedLog.error_category || 'unknown']}
                    </span>
                    {selectedLog.retryable && <span className="text-xs font-semibold text-amber-700">Có thể thử lại</span>}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-red-800">{selectedLog.error_message}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Metadata kỹ thuật</p>
                <pre className="mt-1 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-emerald-300">{JSON.stringify(selectedLog.metadata || {}, null, 2)}</pre>
              </div>
            </div>
          </aside>
        </div>
      )}
    </PageContainer>
  )
}
