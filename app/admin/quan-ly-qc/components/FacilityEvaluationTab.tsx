'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CenterCombobox } from '@/components/facility-evaluation/CenterCombobox'
import { Modal } from '@/components/ui/modal'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/app-toast'
import { authHeaders } from '@/lib/auth-headers'
import {
  FACILITY_EVALUATION_CRITERIA,
  FACILITY_EVALUATION_RECIPIENT_ROLE_CODES,
  FACILITY_EVALUATION_SCORE_VALUES,
  formatVietnamMonthLabel,
  getVietnamMonthKey,
} from '@/lib/facility-evaluation'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  Eye,
  ExternalLink,
  Link2,
  ListChecks,
  Loader2,
  Plus,
  RefreshCcw,
  Send,
  UserRoundCheck,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

type CenterOption = {
  id: number
  fullName: string
  displayName: string
  shortCode: string | null
  region: string | null
}

type RecipientOption = {
  id: string
  centerId: number
  fullName: string
  email: string | null
  roleCode: string
  roleName: string
  source: string
}

type LeaderOption = {
  id: string
  centerId: number
  code: string
  fullName: string
  email: string | null
  roleCode: string
  roleName: string
  areas: string[]
}

type FacilityEvaluationRecord = {
  id: number
  formMonth: string
  centerId: number | null
  centerName: string
  centerShortCode: string | null
  centerRegion: string | null
  recipientName: string
  recipientEmail: string | null
  recipientRoleCode: string
  recipientRoleName: string
  leaderName: string
  leaderEmail: string | null
  leaderRoleCode: string
  leaderRoleName: string
  scores: number[]
  rawScores: number[]
  totalScore: number
  improvementNote: string
  createdByEmail: string
  createdByName: string
  createdAt: string
}

type PublicFormOption = {
  id: number
  formMonth: string
  publicToken: string
  publicUrl: string
  createdByEmail: string
  createdAt: string
  isActive: boolean
}

type FacilityEvaluationPayload = {
  success?: boolean
  error?: string
  formMonth?: string
  centers?: CenterOption[]
  recipients?: RecipientOption[]
  leaders?: LeaderOption[]
  records?: FacilityEvaluationRecord[]
  publicForms?: PublicFormOption[]
  recipientDataReady?: boolean
}

const initialScores = () =>
  Object.fromEntries(
    FACILITY_EVALUATION_CRITERIA.map((criterion) => [criterion.key, 0]),
  ) as Record<string, number>

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatScore(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function cleanPersonName(value: unknown): string {
  let name = String(value ?? '').trim().replace(/\s+/g, ' ')
  for (let index = 0; index < 3; index += 1) {
    name = name
      .replace(/^(CM|CSL|CXL|CXO|CS)\s+/i, '')
      .replace(/\s+(CM|CSL|CXL|CXO|CS)$/i, '')
      .replace(/^I\d{3,8}\s+/i, '')
      .replace(/\s+I\d{3,8}$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return name || String(value ?? '').trim()
}

function ScoreRadio({
  criterionKey,
  value,
  checked,
  onChange,
}: {
  criterionKey: string
  value: number
  checked: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="grid cursor-pointer justify-items-center gap-1.5">
      <span className="text-xs font-bold text-gray-600">{value}</span>
      <span
        className={cn(
          'relative flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
          checked
            ? 'border-[#b00020] bg-[#b00020] shadow-sm'
            : 'border-gray-300 bg-white hover:border-[#b00020]/60 hover:bg-[#fff7f8]',
        )}
      >
        <input
          type="radio"
          name={`facility-score-${criterionKey}`}
          checked={checked}
          onChange={() => onChange(value)}
          className="sr-only"
          aria-label={`${value} điểm`}
        />
        {checked && (
          <span className="h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#b00020]" />
        )}
      </span>
    </label>
  )
}

export function FacilityEvaluationTab({ token }: { token: string | null }) {
  const currentMonthKey = getVietnamMonthKey()
  const [selectedMonth, setSelectedMonth] = useState('')
  const [historyMonth, setHistoryMonth] = useState(currentMonthKey)
  const [centers, setCenters] = useState<CenterOption[]>([])
  const [recipients, setRecipients] = useState<RecipientOption[]>([])
  const [leaders, setLeaders] = useState<LeaderOption[]>([])
  const [records, setRecords] = useState<FacilityEvaluationRecord[]>([])
  const [publicForms, setPublicForms] = useState<PublicFormOption[]>([])
  const [recipientDataReady, setRecipientDataReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creatingPublicForm, setCreatingPublicForm] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedDetailRecord, setSelectedDetailRecord] =
    useState<FacilityEvaluationRecord | null>(null)
  const [historyCenterId, setHistoryCenterId] = useState('')
  const [historyLeaderRole, setHistoryLeaderRole] = useState('all')
  const [historySearch, setHistorySearch] = useState('')

  const [selectedCenterId, setSelectedCenterId] = useState('')
  const [selectedRecipientId, setSelectedRecipientId] = useState('')
  const [manualRecipientName, setManualRecipientName] = useState('')
  const [manualRecipientRole, setManualRecipientRole] = useState('CSL')
  const [selectedLeaderId, setSelectedLeaderId] = useState('')
  const [scores, setScores] = useState<Record<string, number>>(initialScores)
  const [improvementNote, setImprovementNote] = useState('')

  const dataMonth = historyMonth || currentMonthKey
  const dataMonthLabel = formatVietnamMonthLabel(dataMonth)
  const selectedMonthLabel = selectedMonth ? formatVietnamMonthLabel(selectedMonth) : ''

  const selectedCenter = useMemo(
    () => centers.find((center) => String(center.id) === selectedCenterId) ?? null,
    [centers, selectedCenterId],
  )

  const filteredRecipients = useMemo(
    () =>
      recipients.filter(
        (recipient) => String(recipient.centerId) === selectedCenterId,
      ),
    [recipients, selectedCenterId],
  )

  const filteredLeaders = useMemo(
    () =>
      leaders.filter((leader) => String(leader.centerId) === selectedCenterId),
    [leaders, selectedCenterId],
  )

  const selectedRecipient = useMemo(
    () =>
      filteredRecipients.find((recipient) => recipient.id === selectedRecipientId) ??
      null,
    [filteredRecipients, selectedRecipientId],
  )

  const selectedLeader = useMemo(
    () => filteredLeaders.find((leader) => leader.id === selectedLeaderId) ?? null,
    [filteredLeaders, selectedLeaderId],
  )

  const scoreValues = FACILITY_EVALUATION_CRITERIA.map(
    (criterion) => Number(scores[criterion.key]) || 0,
  )
  const missingScoreCount = scoreValues.filter((score) => score < 1 || score > 5).length
  const usingManualRecipient = Boolean(selectedCenterId && filteredRecipients.length === 0)

  const canSubmit = Boolean(
    selectedCenter &&
      selectedLeader &&
      improvementNote.trim() &&
      missingScoreCount === 0 &&
      (selectedRecipient ||
        (usingManualRecipient && manualRecipientName.trim() && manualRecipientRole)),
  )

  const recipientLabel = useCallback((recipient: RecipientOption) => {
    return `${cleanPersonName(recipient.fullName)} - ${recipient.roleCode}`
  }, [])

  const hasHistoryFilters = Boolean(
    historyMonth !== currentMonthKey ||
      historyCenterId ||
      historyLeaderRole !== 'all' ||
      historySearch.trim(),
  )

  const resetHistoryFilters = useCallback(() => {
    setHistoryMonth(currentMonthKey)
    setHistoryCenterId('')
    setHistoryLeaderRole('all')
    setHistorySearch('')
  }, [currentMonthKey])

  const centerById = useMemo(() => {
    const nextCenterById = new Map<string, CenterOption>()
    centers.forEach((center) => {
      nextCenterById.set(String(center.id), center)
    })
    return nextCenterById
  }, [centers])

  const findRecordCenter = useCallback(
    (record: FacilityEvaluationRecord) => {
      if (record.centerId) {
        const center = centerById.get(String(record.centerId))
        if (center) return center
      }

      const recordKeys = [record.centerName, record.centerShortCode]
        .map(normalizeSearchText)
        .filter(Boolean)

      return (
        centers.find((center) => {
          const centerKeys = [
            center.fullName,
            center.displayName,
            center.shortCode,
          ]
            .map(normalizeSearchText)
            .filter(Boolean)

          return centerKeys.some((centerKey) => recordKeys.includes(centerKey))
        }) ?? null
      )
    },
    [centerById, centers],
  )

  const recordCenterName = useCallback(
    (record: FacilityEvaluationRecord) =>
      findRecordCenter(record)?.fullName ||
      record.centerName ||
      record.centerShortCode ||
      '-',
    [findRecordCenter],
  )

  const recordCenterMeta = useCallback(
    (record: FacilityEvaluationRecord) => {
      const center = findRecordCenter(record)
      return (
        [center?.shortCode || record.centerShortCode, center?.region || record.centerRegion]
          .filter(Boolean)
          .join(' · ') || '-'
      )
    },
    [findRecordCenter],
  )

  const filteredRecords = useMemo(() => {
    const keyword = normalizeSearchText(historySearch)
    return records.filter((record) => {
      if (historyCenterId) {
        const recordCenter = findRecordCenter(record)
        const centerMatches =
          String(record.centerId || '') === historyCenterId ||
          (recordCenter ? String(recordCenter.id) === historyCenterId : false)
        if (!centerMatches) return false
      }

      if (
        historyLeaderRole !== 'all' &&
        record.leaderRoleCode !== historyLeaderRole
      ) {
        return false
      }

      if (keyword) {
        const searchText = normalizeSearchText([
          record.recipientName,
          cleanPersonName(record.recipientName),
          record.leaderName,
          recordCenterName(record),
          recordCenterMeta(record),
          record.recipientEmail,
          record.leaderEmail,
        ].join(' '))
        if (!searchText.includes(keyword)) return false
      }

      return true
    })
  }, [
    findRecordCenter,
    historyCenterId,
    historyLeaderRole,
    historySearch,
    recordCenterMeta,
    recordCenterName,
    records,
  ])

  const resetEvaluationForm = useCallback(() => {
    setSelectedCenterId('')
    setSelectedRecipientId('')
    setManualRecipientName('')
    setManualRecipientRole('CSL')
    setSelectedLeaderId('')
    setScores(initialScores())
    setImprovementNote('')
  }, [])

  const loadData = useCallback(
    async (showToast = false) => {
      try {
        setRefreshing(true)
        const response = await fetch(
          `/api/admin/quan-ly-qc/facility-evaluations?month=${dataMonth}`,
          {
            headers: authHeaders(token),
          },
        )
        const data = (await response.json().catch(() => ({}))) as FacilityEvaluationPayload
        if (!response.ok || data.success === false) {
          throw new Error(data.error || 'Không thể tải dữ liệu đánh giá cơ sở')
        }

        const nextCenters = data.centers || []
        setCenters(nextCenters)
        setRecipients(data.recipients || [])
        setLeaders(data.leaders || [])
        setRecords(data.records || [])
        setPublicForms(data.publicForms || [])
        setRecipientDataReady(Boolean(data.recipientDataReady))
        setSelectedCenterId((current) =>
          nextCenters.some((center) => String(center.id) === current) ? current : '',
        )
        if (showToast) toast.success('Đã cập nhật dữ liệu đánh giá cơ sở')
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Không thể tải dữ liệu đánh giá cơ sở',
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [dataMonth, token],
  )

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (
      selectedRecipientId &&
      !filteredRecipients.some((recipient) => recipient.id === selectedRecipientId)
    ) {
      setSelectedRecipientId('')
    }
    if (
      selectedLeaderId &&
      !filteredLeaders.some((leader) => leader.id === selectedLeaderId)
    ) {
      setSelectedLeaderId('')
    }
  }, [filteredLeaders, filteredRecipients, selectedLeaderId, selectedRecipientId])

  async function createPublicFormLink() {
    if (!selectedMonth) {
      toast.error('Vui lòng chọn tháng trước khi tạo form')
      return null
    }

    setCreatingPublicForm(true)
    try {
      const response = await fetch('/api/admin/quan-ly-qc/facility-evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          action: 'create_public_form',
          formMonth: selectedMonth,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.success === false || !result.publicForm) {
        throw new Error(result.error || 'Không thể tạo link public')
      }
      setPublicForms((current) => {
        const next = current.filter(
          (form) => form.id !== result.publicForm.id,
        )
        return [result.publicForm as PublicFormOption, ...next]
      })
      toast.success('Đã sẵn sàng link public của form')
      return result.publicForm as PublicFormOption
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo link public')
      return null
    } finally {
      setCreatingPublicForm(false)
    }
  }

  async function copyPublicLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Đã copy link public')
    } catch {
      toast.error('Không thể copy tự động, bạn vui lòng bôi đen link để copy')
    }
  }

  async function openForm() {
    const publicForm = await createPublicFormLink()
    if (!publicForm) return
    setIsFormOpen(true)
    resetEvaluationForm()
  }

  async function submitEvaluation() {
    if (!canSubmit) {
      toast.error('Vui lòng nhập đủ thông tin trước khi gửi form')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/quan-ly-qc/facility-evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          formMonth: selectedMonth || dataMonth,
          centerId: selectedCenter?.id,
          recipientId: selectedRecipient?.id || '',
          manualRecipientName: usingManualRecipient ? manualRecipientName : '',
          manualRecipientRole: usingManualRecipient ? manualRecipientRole : '',
          leaderId: selectedLeader?.id,
          scores,
          improvementNote,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Không thể lưu điểm đánh giá cơ sở')
      }

      toast.success('Đã lưu điểm đánh giá cơ sở. Form đã được làm mới để gửi tiếp.')
      resetEvaluationForm()
      await loadData()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Không thể lưu điểm đánh giá cơ sở',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-950">
              Quản lý điểm đánh giá cơ sở
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Tạo link public để CM/CSL gửi đánh giá leader theo cơ sở và khu vực.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
              aria-label="Chọn tháng tạo form"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="border-[#a1001f]/30 text-[#a1001f] hover:bg-[#a1001f]/5"
            >
              <RefreshCcw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              Làm mới
            </Button>
            <Button
              type="button"
              variant="mindx"
              size="sm"
              onClick={openForm}
              disabled={creatingPublicForm}
            >
              {creatingPublicForm ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {creatingPublicForm ? 'Đang tạo...' : 'Tạo form'}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Cơ sở có thể chọn
              </span>
              <Building2 className="h-4 w-4 text-[#a1001f]" />
            </div>
            <p className="mt-1 text-2xl font-black text-gray-950">{centers.length}</p>
            <p className="text-[11px] text-gray-500">Theo phân quyền cơ sở hiện tại</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Leader theo khu vực
              </span>
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-1 text-2xl font-black text-gray-950">{leaders.length}</p>
            <p className="text-[11px] text-gray-500">RL / CL / AL / TC / TE khớp khu vực cơ sở</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Phiếu đã lưu
              </span>
              <Database className="h-4 w-4 text-sky-600" />
            </div>
            <p className="mt-1 text-2xl font-black text-gray-950">{records.length}</p>
            <p className="text-[11px] text-gray-500">Theo tháng đang xem</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-[#a1001f]" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-950">
              Link form đã tạo
            </h3>
          </div>
          <span className="text-xs text-gray-500">{publicForms.length} form</span>
        </div>

        {publicForms.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tháng</TableHead>
                <TableHead>Link public</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {publicForms.map((form) => (
                <TableRow key={form.id}>
                  <TableCell className="text-sm font-bold text-gray-950">
                    {formatVietnamMonthLabel(form.formMonth)}
                  </TableCell>
                  <TableCell>
                    <input
                      value={form.publicUrl}
                      readOnly
                      className="h-9 w-full min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-700 outline-none"
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">
                    {formatDateTime(form.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyPublicLink(form.publicUrl)}
                        className="h-9 border-[#a1001f]/30 text-[#a1001f] hover:bg-[#a1001f]/5"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                      <a
                        href={form.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#a1001f] px-3 text-sm font-bold text-white transition-colors hover:bg-[#870019]"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Mở
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-6 text-center text-sm text-gray-500">
            Chưa có link form public nào được tạo.
          </div>
        )}
      </div>

      {!recipientDataReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-bold">Chưa tìm thấy dữ liệu CM/CSL.</p>
              <p className="mt-0.5 text-xs leading-relaxed">
                Dropdown người nhận đang đọc từ LMS theo cơ sở đã chọn.
                Trong lúc chờ dữ liệu CM/CSL, form cho phép nhập người nhận tạm thời để test luồng.
              </p>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 rounded-t-xl border-b border-gray-100 bg-[#fff7f8] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-[#a1001f]" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-950">
                  Form đánh giá leader cơ sở
                </h3>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                Form này được ghi nhận cho {selectedMonthLabel || dataMonthLabel}; mỗi lần gửi chỉ chọn một leader.
              </p>
            </div>
            <Badge variant="slate" shape="pill">
              {selectedMonthLabel || dataMonthLabel}
            </Badge>
          </div>

          <div className="space-y-4 p-4">
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-950">
                <Building2 className="h-4 w-4 text-[#a1001f]" />
                Thông tin cơ sở
              </div>

              <div className="mt-3 space-y-3">
                <div className="max-w-xl">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Cơ sở trực thuộc
                  </label>
                  <CenterCombobox
                    centers={centers}
                    selectedCenterId={selectedCenterId}
                    onChange={setSelectedCenterId}
                  />
                </div>

                <div className="max-w-xl">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      Tên CM/CSL
                    </label>
                    {filteredRecipients.length > 0 ? (
                      <select
                        value={selectedRecipientId}
                        onChange={(event) => setSelectedRecipientId(event.target.value)}
                        disabled={!selectedCenterId}
                        className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        <option value="">Chọn CM/CSL</option>
                        {filteredRecipients.map((recipient) => (
                          <option key={recipient.id} value={recipient.id}>
                            {recipientLabel(recipient)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-1 space-y-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/70 p-3">
                        <p className="text-xs font-semibold text-amber-900">
                          {selectedCenterId
                            ? 'Cơ sở này chưa có CM/CSL trong dữ liệu.'
                            : 'Vui lòng chọn cơ sở trước.'}
                        </p>
                        {selectedCenterId && (
                          <>
                            <input
                              value={manualRecipientName}
                              onChange={(event) => setManualRecipientName(event.target.value)}
                              placeholder="Nhập tên người nhận tạm thời"
                              className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                            />
                            <select
                              value={manualRecipientRole}
                              onChange={(event) => setManualRecipientRole(event.target.value)}
                              className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                            >
                              {FACILITY_EVALUATION_RECIPIENT_ROLE_CODES.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="max-w-xl">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Leader khu vực
                  </label>
                  <select
                    value={selectedLeaderId}
                    onChange={(event) => setSelectedLeaderId(event.target.value)}
                    disabled={!selectedCenterId}
                    className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">
                      {selectedCenterId ? 'Chọn một leader' : 'Chọn cơ sở trước'}
                    </option>
                    {filteredLeaders.map((leader) => (
                      <option key={leader.id} value={leader.id}>
                        {leader.fullName} · {leader.roleCode}
                      </option>
                    ))}
                  </select>
                  {selectedCenter && filteredLeaders.length === 0 && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      Chưa tìm thấy RL/CL/AL/TC thuộc khu vực của cơ sở này.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="rounded-xl border border-gray-200 bg-white">
                <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-[#a1001f]" />
                    <span className="text-sm font-bold uppercase tracking-wide text-gray-950">
                      Tiêu chí đánh giá
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-gray-500">
                    Chọn một mức điểm từ 1 đến 5
                  </span>
                </div>

                <div className="space-y-2.5 p-3 sm:p-4">
                  {FACILITY_EVALUATION_CRITERIA.map((criterion, index) => {
                    const selected = Number(scores[criterion.key]) || 0
                    return (
                      <div
                        key={criterion.key}
                        className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-[#f0c3ca] lg:grid-cols-[minmax(0,1fr)_280px]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#a1001f] text-xs font-black text-white">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-bold leading-snug text-gray-950">
                                {criterion.label}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {selected ? `Đã chọn mức ${selected}` : 'Chưa chọn điểm'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div
                          className="grid grid-cols-5 gap-2"
                          role="radiogroup"
                          aria-label={`Điểm ${criterion.label}`}
                        >
                          {FACILITY_EVALUATION_SCORE_VALUES.map((value) => (
                            <ScoreRadio
                              key={value}
                              criterionKey={criterion.key}
                              value={value}
                              checked={selected === value}
                              onChange={(nextValue) =>
                                setScores((current) => ({
                                  ...current,
                                  [criterion.key]: nextValue,
                                }))
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <label className="text-sm font-bold text-gray-950">
                  6. Điều bạn muốn leader thay đổi sớm nhất
                </label>
                <Textarea
                  value={improvementNote}
                  onChange={(event) => setImprovementNote(event.target.value)}
                  placeholder="Nhập góp ý cụ thể để leader có thể cải thiện trong thời gian tới..."
                  className="mt-2 min-h-28"
                />
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <CheckCircle2 className="h-4 w-4 text-[#a1001f]" />
              {missingScoreCount > 0
                ? `${missingScoreCount} tiêu chí chưa chọn`
                : 'Đã chọn đủ 5 tiêu chí'}
            </div>
            <Button
              type="button"
              variant="mindx"
              onClick={submitEvaluation}
              disabled={!canSubmit || saving}
              className="h-10 px-5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {saving ? 'Đang lưu...' : 'Gửi form'}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 rounded-t-xl border-b border-gray-100 bg-gray-50/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <UserRoundCheck className="h-4 w-4 text-[#a1001f]" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-950">
              Lịch sử điểm đánh giá cơ sở
            </h3>
          </div>
          <div className="grid gap-2 md:grid-cols-[180px_minmax(220px,320px)_140px_minmax(220px,1fr)_auto]">
            <input
              type="month"
              value={historyMonth}
              onChange={(event) => setHistoryMonth(event.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
              aria-label="Lọc lịch sử theo tháng"
            />
            <div className="min-w-0">
              <CenterCombobox
                centers={centers}
                selectedCenterId={historyCenterId}
                onChange={setHistoryCenterId}
                placeholder="Tất cả cơ sở"
                className="mt-0"
              />
            </div>
            <select
              value={historyLeaderRole}
              onChange={(event) => setHistoryLeaderRole(event.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
              aria-label="Lọc theo chức vụ leader"
            >
              <option value="all">Tất cả chức vụ</option>
              {['CL', 'AL', 'RL', 'TE', 'TC'].map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <input
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder="Tìm theo tên CM/CSL, leader..."
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
              aria-label="Tìm kiếm theo tên"
            />
            <div className="flex items-center justify-end gap-2">
              {hasHistoryFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetHistoryFilters}
                  className="h-9"
                >
                  Xóa bộ lọc
                </Button>
              )}
              <span className="whitespace-nowrap text-xs text-gray-500">
                {filteredRecords.length}/{records.length} phiếu
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Cơ sở</TableHead>
                  <TableHead>Người tạo</TableHead>
                  <TableHead>Leader</TableHead>
                  <TableHead className="text-right">Điểm TB</TableHead>
                  <TableHead className="text-right">Chi tiết</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-xs text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                          {formatDateTime(record.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-bold text-gray-950">
                          {recordCenterName(record)}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {recordCenterMeta(record)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-semibold text-gray-900">
                          {cleanPersonName(record.recipientName)}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {record.recipientRoleCode}
                          {record.recipientEmail ? ` · ${record.recipientEmail}` : ''}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-semibold text-gray-900">
                          {record.leaderName}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {record.leaderRoleCode} · {record.leaderEmail || record.leaderRoleName}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-black text-gray-950">
                          {formatScore(record.totalScore)}
                        </span>{' '}
                        <span className="text-xs text-gray-400">/10</span>
                        <p className="text-[10px] text-gray-500">
                          {record.rawScores.join(' · ')} trên thang 5
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDetailRecord(record)}
                          className="h-8 border-[#a1001f]/30 text-[#a1001f] hover:bg-[#a1001f]/5"
                        >
                          <Eye className="h-4 w-4" />
                          Xem
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            {filteredRecords.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">
                Chưa có phiếu đánh giá cơ sở nào phù hợp trong {dataMonthLabel}.
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={!!selectedDetailRecord}
        onClose={() => setSelectedDetailRecord(null)}
        title="Chi tiết điểm đánh giá cơ sở"
        subtitle={
          selectedDetailRecord
            ? `${recordCenterName(selectedDetailRecord)} · ${formatDateTime(selectedDetailRecord.createdAt)}`
            : undefined
        }
        maxWidth="4xl"
        footer={
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedDetailRecord(null)}
            >
              Đóng
            </Button>
          </div>
        }
      >
        {selectedDetailRecord && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Cơ sở
                </p>
                <p className="mt-1 text-sm font-black text-gray-950">
                  {recordCenterName(selectedDetailRecord)}
                </p>
                <p className="text-xs text-gray-500">
                  {recordCenterMeta(selectedDetailRecord)}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Người tạo
                </p>
                <p className="mt-1 text-sm font-black text-gray-950">
                  {cleanPersonName(selectedDetailRecord.recipientName)} - {selectedDetailRecord.recipientRoleCode}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedDetailRecord.recipientEmail || selectedDetailRecord.recipientRoleName}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Leader được đánh giá
                </p>
                <p className="mt-1 text-sm font-black text-gray-950">
                  {selectedDetailRecord.leaderName}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedDetailRecord.leaderRoleCode} ·{' '}
                  {selectedDetailRecord.leaderEmail || selectedDetailRecord.leaderRoleName}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Kết quả
                </p>
                <p className="mt-1 text-sm font-black text-gray-950">
                  {formatScore(selectedDetailRecord.totalScore)} / 10
                </p>
                <p className="text-xs text-gray-500">
                  {formatVietnamMonthLabel(selectedDetailRecord.formMonth)}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-sm font-bold uppercase tracking-wide text-gray-950">
                  Tiêu chí đánh giá
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {FACILITY_EVALUATION_CRITERIA.map((criterion, index) => (
                  <div
                    key={criterion.key}
                    className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_120px]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-950">
                        {index + 1}. {criterion.label}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      Mức {selectedDetailRecord.rawScores[index] || '-'}
                    </p>
                    <p className="text-sm font-black text-[#a1001f]">
                      {formatScore(selectedDetailRecord.scores[index] || 0)} / 10
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-sm font-bold text-amber-950">
                Note leader cần thay đổi
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-950">
                {selectedDetailRecord.improvementNote || '-'}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
