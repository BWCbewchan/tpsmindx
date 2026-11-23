'use client'

import { PageHeader } from '@/components/PageHeader'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import {
  Award,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type PortfolioStatus = 'published' | 'revoked'

type PortfolioRow = {
  id: string
  teacherCode: string
  teacherName: string
  centerName: string | null
  courseLine: string | null
  status: PortfolioStatus
  sharePath: string | null
  createdAt: string | null
  updatedAt: string | null
}

type PortfolioResponse = {
  rows: PortfolioRow[]
  page: number
  limit: number
  total: number
  totalPages: number
  summary: {
    total: number
    published: number
    revoked: number
  }
}

const EMPTY_DATA: PortfolioResponse = {
  rows: [],
  page: 1,
  limit: 24,
  total: 0,
  totalPages: 1,
  summary: { total: 0, published: 0, revoked: 0 },
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function StatusBadge({ status }: { status: PortfolioStatus }) {
  const published = status === 'published'
  return (
    <span
      className={
        published
          ? 'inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700'
          : 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600'
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${published ? 'bg-emerald-500' : 'bg-slate-400'}`}
      />
      {published ? 'Đang công khai' : 'Đã thu hồi'}
    </span>
  )
}

function ViewPortfolioLink({ row }: { row: PortfolioRow }) {
  if (!row.sharePath) {
    return (
      <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-400">
        <Eye className="h-3.5 w-3.5" />
        Không khả dụng
      </span>
    )
  }

  return (
    <Link
      href={row.sharePath}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#b00020] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#92001a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b00020] focus-visible:ring-offset-2"
      aria-label={`Xem Portfolio của ${row.teacherName}`}
    >
      <Eye className="h-3.5 w-3.5" />
      Xem Portfolio
      <ExternalLink className="h-3 w-3 opacity-75" />
    </Link>
  )
}

export function TeacherPortfolioManagementClient() {
  const { token, isLoading: authLoading } = useAuth()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [status, setStatus] = useState('published')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PortfolioResponse>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshSignal, setRefreshSignal] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setDebouncedQuery(query.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: '24',
    })
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (status) params.set('status', status)
    return params.toString()
  }, [debouncedQuery, page, status])

  useEffect(() => {
    if (authLoading) return
    const controller = new AbortController()
    setLoading(true)
    setError('')

    fetch(`/api/admin/teacher-portfolios?${queryString}`, {
      cache: 'no-store',
      headers: authHeaders(token),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || payload.success !== true) {
          throw new Error(payload.error || 'Không thể tải danh sách Portfolio.')
        }
        return payload.data as PortfolioResponse
      })
      .then(setData)
      .catch((fetchError) => {
        if (controller.signal.aborted) return
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Không thể tải danh sách Portfolio.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [authLoading, queryString, refreshSignal, token])

  const firstResult = data.total === 0 ? 0 : (page - 1) * data.limit + 1
  const lastResult = Math.min(page * data.limit, data.total)

  return (
    <PageLayout
      background="white"
      maxWidth="full"
      padding="responsive"
      className="px-4 sm:px-6 lg:px-8"
    >
      <PageLayoutContent spacing="xl" className="min-w-0 pb-24">
        <PageHeader
          title="Quản Lý Portfolio Giáo Viên"
          description="Tra cứu các Portfolio giáo viên đã tạo và mở đường dẫn công khai ở chế độ chỉ xem."
          actions={
            <button
              type="button"
              onClick={() => setRefreshSignal((value) => value + 1)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <RefreshCcw className={`h-4 w-4 text-[#b00020] ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          }
        />

        <section className="relative overflow-hidden rounded-2xl border border-rose-100 bg-[#fff8f8] px-5 py-4">
          <div className="absolute inset-y-0 left-0 w-1 bg-[#b00020]" />
          <div className="flex items-start gap-3 pl-1">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#b00020]" />
            <div>
              <p className="text-sm font-bold text-slate-900">Quyền xem dành cho HC</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Nút “Xem Portfolio” mở trang chia sẻ công khai trong tab mới. HC không cần đăng nhập vào tài khoản giáo viên và không thể chỉnh sửa Portfolio tại màn này.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: 'Tổng Portfolio',
              value: data.summary.total,
              icon: UsersRound,
              tone: 'bg-slate-900 text-white',
              iconTone: 'bg-white/10 text-white',
            },
            {
              label: 'Đang công khai',
              value: data.summary.published,
              icon: BookOpenCheck,
              tone: 'border border-emerald-200 bg-emerald-50 text-emerald-950',
              iconTone: 'bg-emerald-100 text-emerald-700',
            },
            {
              label: 'Đã thu hồi',
              value: data.summary.revoked,
              icon: Award,
              tone: 'border border-slate-200 bg-slate-50 text-slate-900',
              iconTone: 'bg-slate-200 text-slate-600',
            },
          ].map((item) => (
            <article key={item.label} className={`rounded-2xl p-5 ${item.tone}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] opacity-70">{item.label}</p>
                  <p className="mt-2 text-3xl font-black tracking-tight">{item.value.toLocaleString('vi-VN')}</p>
                </div>
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.iconTone}`}>
                  <item.icon className="h-5 w-5" />
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <span className="sr-only">Tìm giáo viên</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên, mã LMS hoặc cơ sở..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#b00020] focus:bg-white focus:ring-4 focus:ring-[#b00020]/10"
              />
            </label>
            <label>
              <span className="sr-only">Lọc trạng thái Portfolio</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value)
                  setPage(1)
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-[#b00020] focus:ring-4 focus:ring-[#b00020]/10"
              >
                <option value="published">Đang công khai</option>
                <option value="revoked">Đã thu hồi</option>
                <option value="">Tất cả trạng thái</option>
              </select>
            </label>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-[#b00020]" />
              <div>
                <h2 className="font-bold text-slate-900">Danh sách Portfolio giáo viên</h2>
                <p className="text-xs text-slate-500">{data.total.toLocaleString('vi-VN')} kết quả phù hợp</p>
              </div>
            </div>
            {!loading && !error && data.total > 0 ? (
              <p className="text-xs font-semibold text-slate-500">
                Hiển thị {firstResult}–{lastResult} / {data.total.toLocaleString('vi-VN')}
              </p>
            ) : null}
          </div>

          {loading ? (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-[#b00020]" />
              <p className="text-sm font-semibold">Đang tải Portfolio giáo viên...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-80 flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-[#b00020]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Không thể tải dữ liệu</p>
                <p className="mt-1 text-sm text-slate-500">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => setRefreshSignal((value) => value + 1)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
              >
                Thử lại
              </button>
            </div>
          ) : data.rows.length === 0 ? (
            <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <UserRound className="h-6 w-6" />
              </div>
              <p className="font-bold text-slate-900">Chưa có Portfolio phù hợp</p>
              <p className="mt-1 max-w-md text-sm text-slate-500">Thử thay đổi từ khóa hoặc trạng thái đang lọc.</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[1040px] w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-[0.05em] text-slate-600">
                      <th className="px-4 py-4 font-bold">STT</th>
                      <th className="px-4 py-4 font-bold">Giáo viên</th>
                      <th className="px-4 py-4 font-bold">Cơ sở</th>
                      <th className="px-4 py-4 font-bold">Bộ môn</th>
                      <th className="px-4 py-4 font-bold">Cập nhật</th>
                      <th className="px-4 py-4 font-bold">Trạng thái</th>
                      <th className="px-4 py-4 text-right font-bold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, index) => (
                      <tr key={row.id} className="border-b border-slate-100 align-middle transition last:border-0 hover:bg-slate-50/80">
                        <td className="px-4 py-4 font-semibold text-slate-400">{(page - 1) * data.limit + index + 1}</td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-900">{row.teacherName}</p>
                          <p className="mt-1 font-mono text-xs text-slate-500">{row.teacherCode}</p>
                        </td>
                        <td className="max-w-[260px] px-4 py-4 text-slate-700">
                          <span className="inline-flex items-start gap-1.5">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            {row.centerName || 'Chưa cập nhật'}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{row.courseLine || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-xs font-medium text-slate-600">{formatDate(row.updatedAt)}</td>
                        <td className="px-4 py-4"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-4 text-right"><ViewPortfolioLink row={row} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {data.rows.map((row) => (
                  <article key={row.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-slate-900">{row.teacherName}</h3>
                        <p className="mt-1 font-mono text-xs text-slate-500">{row.teacherCode}</p>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{row.centerName || 'Chưa cập nhật cơ sở'}</p>
                      <p className="flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-slate-400" />{row.courseLine || 'Chưa cập nhật bộ môn'}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <p className="text-[11px] font-semibold text-slate-400">Cập nhật {formatDate(row.updatedAt)}</p>
                      <ViewPortfolioLink row={row} />
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {!loading && !error && data.totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <p className="text-xs font-semibold text-slate-500">Trang {page} / {data.totalPages}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Trước
                </button>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(data.totalPages, value + 1))}
                  disabled={page >= data.totalPages}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </PageLayoutContent>
    </PageLayout>
  )
}
