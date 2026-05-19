'use client'

import { Modal } from '@/components/ui/modal'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { Badge } from '@/components/ui/badge'
import { StepItem, Stepper } from '@/components/ui/stepper'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { toast } from '@/lib/app-toast'
import { useAuth } from '@/lib/auth-context'
import {
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    RefreshCcw,
    X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type FeedbackItem = {
  id: number
  screen_path?: string | null
  content: string
  suggestion: string | null
  image_urls: string[] | null
  admin_image_urls?: string[] | null
  status: 'new' | 'in_progress' | 'done'
  admin_note: string | null
  admin_reply?: string | null
  created_at: string
  updated_at: string
}

const statusLabel: Record<FeedbackItem['status'], string> = {
  new: 'Mới tiếp nhận',
  in_progress: 'Đang xử lý',
  done: 'Hoàn thành',
}

type StatusVariant = 'info' | 'warning' | 'success'

function getStatusMeta(status: FeedbackItem['status']): {
  label: string
  variant: StatusVariant
} {
  switch (status) {
    case 'new':
      return { label: 'Mới tiếp nhận', variant: 'info' }
    case 'in_progress':
      return { label: 'Đang xử lý', variant: 'warning' }
    case 'done':
      return { label: 'Hoàn thành', variant: 'success' }
    default:
      return { label: status, variant: 'info' }
  }
}

function getProgressSteps(status: FeedbackItem['status']): StepItem[] {
  const currentIndex = status === 'new' ? 0 : status === 'in_progress' ? 1 : 2

  return [
    {
      id: 'new',
      label: 'Step 1',
      description: 'Mới tiếp nhận',
      status:
        currentIndex > 0
          ? 'completed'
          : currentIndex === 0
            ? 'current'
            : 'upcoming',
    },
    {
      id: 'in_progress',
      label: 'Step 2',
      description: 'Đang xử lý',
      status:
        currentIndex > 1
          ? 'completed'
          : currentIndex === 1
            ? 'current'
            : 'upcoming',
    },
    {
      id: 'done',
      label: 'Step 3',
      description: 'Hoàn thành',
      status: currentIndex === 2 ? 'success' : 'upcoming',
    },
  ]
}

function formatScreenTitle(screenPath?: string | null): string {
  if (!screenPath) return '-'

  const knownMap: Record<string, string> = {
    '/user/home': 'Trang chủ',
    '/user/truyenthong': 'Truyền thông nội bộ',
    '/user/thong-tin-giao-vien': 'Thông tin của tôi',
    '/user/hoat-dong-hang-thang': 'Hoạt động hàng tháng',
    '/user/xin-nghi-mot-buoi': 'Tạo yêu cầu xin nghỉ 1 buổi',
    '/user/nhan-lop-1-buoi': 'Tiếp nhận xin nghỉ 1 buổi',
    '/user/dao-tao-nang-cao': 'Đào tạo nâng cao',
    '/user/assignments': 'Quản lý kiểm tra',
    '/user/giaitrinh': 'Giải trình điểm kiểm tra',
    '/user/quy-trinh-quy-dinh': 'Quy trình & Quy định',
    '/user/quan-ly-phan-hoi': 'Trung tâm phản hồi',
  }

  if (knownMap[screenPath]) return knownMap[screenPath]

  const slug = screenPath.split('/').filter(Boolean).pop() || ''
  if (!slug) return screenPath

  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

type UserFeedbackManagePanelProps = {
  showInlineRefresh?: boolean
  externalRefreshSignal?: number
  onInitialLoadComplete?: () => void
}

export default function UserFeedbackManagePanel(
  props: UserFeedbackManagePanelProps,
) {
  return <UserFeedbackManagePanelWithOptions {...props} />
}

function UserFeedbackManagePanelWithOptions({
  showInlineRefresh = true,
  externalRefreshSignal,
  onInitialLoadComplete,
}: UserFeedbackManagePanelProps = {}) {
  const { user } = useAuth()
  const [loadingList, setLoadingList] = useState(false)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null)
  const [previewImages, setPreviewImages] = useState<string[] | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)

  const newCount = useMemo(
    () => items.filter((item) => item.status === 'new').length,
    [items],
  )
  const processingCount = useMemo(
    () => items.filter((item) => item.status === 'in_progress').length,
    [items],
  )
  const doneCount = useMemo(
    () => items.filter((item) => item.status === 'done').length,
    [items],
  )

  const loadMyFeedback = async () => {
    if (!user?.email) {
      console.log('[UserFeedbackManagePanel] No user email, calling callback')
      onInitialLoadComplete?.()
      return
    }

    console.log('[UserFeedbackManagePanel] Loading feedback for:', user.email)
    try {
      setLoadingList(true)
      setLoadingError(null)

      const params = new URLSearchParams({
        scope: 'mine',
        requestEmail: user.email,
      })

      const controller = new AbortController()
      const timeoutMs = 10000
      const to = window.setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(`/api/feedback?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      })

      window.clearTimeout(to)

      let data: any = null
      try {
        data = await response.json()
      } catch (err) {
        throw new Error(response.statusText || 'Không thể phân tích phản hồi từ server')
      }

      if (!response.ok || !data.success) {
        throw new Error(data?.error || response.statusText || 'Không thể tải danh sách phản hồi')
      }

      setItems(data.items || [])
      console.log('[UserFeedbackManagePanel] Loaded items:', data.items?.length || 0)
    } catch (error: any) {
      const message =
        error?.name === 'AbortError'
          ? 'Yêu cầu lấy dữ liệu quá thời gian. Vui lòng thử lại.'
          : error.message || 'Lỗi tải phản hồi'
      setLoadingError(message)
      toast.error(message)
      console.error('[UserFeedbackManagePanel] Load error:', error)
    } finally {
      setLoadingList(false)
      console.log('[UserFeedbackManagePanel] Calling onInitialLoadComplete callback')
      onInitialLoadComplete?.()
    }
  }

  useEffect(() => {
    loadMyFeedback()

  }, [user?.email])

  useEffect(() => {
    if (externalRefreshSignal === undefined) return
    loadMyFeedback()

  }, [externalRefreshSignal])

  useEffect(() => {
    if (!previewImages) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewImages(null)
        return
      }

      if (event.key === 'ArrowLeft') {
        setPreviewIndex(
          (prev) => (prev - 1 + previewImages.length) % previewImages.length,
        )
      } else if (event.key === 'ArrowRight') {
        setPreviewIndex((prev) => (prev + 1) % previewImages.length)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewImages])

  return (
    <>
      <div className="space-y-5">
        {showInlineRefresh && (
          <div className="flex gap-2 border-b border-gray-200 pb-4">
            <button
              type="button"
              onClick={loadMyFeedback}
              disabled={loadingList}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#f3b4bd] bg-white px-4 text-sm font-medium text-[#a1001f] shadow-sm hover:bg-[#a1001f]/5 disabled:opacity-60"
            >
              <RefreshCcw className="mr-1.5 h-4 w-4" />
              Làm mới
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-medium text-blue-700">Mới tiếp nhận</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">{newCount}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-medium text-amber-700">Đang xử lý</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">
              {processingCount}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-medium text-emerald-700">Hoàn thành</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">
              {doneCount}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Danh sách phản hồi
            </h2>
            <p className="text-sm text-gray-600">
              Tổng: {items.length} phản hồi
            </p>
          </div>

          {loadingError && !loadingList && (
            <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:mx-6">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Không thể tải dữ liệu</p>
                <p className="mt-0.5">{loadingError}</p>
              </div>
              <button
                type="button"
                onClick={loadMyFeedback}
                className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
              >
                Thử lại
              </button>
            </div>
          )}

          {loadingList ? (
            <div className="p-4 sm:p-6">
              <TableSkeleton rows={6} columns={4} />
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-600">
              Bạn chưa có phản hồi nào.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead>Màn hình</TableHead>
                      <TableHead>Nội dung</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const statusMeta = getStatusMeta(item.status)
                      return (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer hover:bg-blue-50/40"
                          onClick={() => setSelectedItem(item)}
                        >
                          <TableCell>
                            {new Date(item.created_at).toLocaleDateString(
                              'vi-VN',
                            )}
                          </TableCell>
                          <TableCell>
                            {formatScreenTitle(item.screen_path)}
                          </TableCell>
                          <TableCell
                            className="max-w-105 truncate"
                            title={item.content}
                          >
                            {item.content}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusMeta.variant}>
                              {statusMeta.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-gray-200 lg:hidden">
                {items.map((item) => {
                  const statusMeta = getStatusMeta(item.status)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full p-4 text-left hover:bg-gray-50"
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatScreenTitle(item.screen_path)}
                        </p>
                        <Badge variant={statusMeta.variant}>
                          {statusMeta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                        {item.content}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleDateString('vi-VN')}
                      </p>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal - outside conditional rendering */}
      <Modal
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={
          selectedItem
            ? `Chi tiết phản hồi #${selectedItem.id}`
            : 'Chi tiết phản hồi'
        }
        size="3xl"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <Stepper steps={getProgressSteps(selectedItem.status)} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Màn hình</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatScreenTitle(selectedItem.screen_path)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Trạng thái</p>
                <p className="text-sm font-medium text-gray-900">
                  {statusLabel[selectedItem.status]}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Ngày tạo</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(selectedItem.created_at).toLocaleString('vi-VN')}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Cập nhật gần nhất</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(selectedItem.updated_at).toLocaleString('vi-VN')}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                <p className="text-xs text-gray-600">Nội dung phản hồi</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {selectedItem.content}
                </p>
              </div>
              {selectedItem.suggestion && (
                <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                  <p className="text-xs text-gray-600">Đề xuất</p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {selectedItem.suggestion}
                  </p>
                </div>
              )}
            </div>

            {Array.isArray(selectedItem.image_urls) &&
              selectedItem.image_urls.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-800">
                    Ảnh bạn đã gửi
                  </p>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {selectedItem.image_urls.map((url, idx) => (
                      <button
                        key={`${url}-${idx}`}
                        type="button"
                        onClick={() => {
                          setPreviewImages(selectedItem.image_urls || [])
                          setPreviewIndex(idx)
                        }}
                        className="w-24 h-24 shrink-0 border border-gray-200 rounded-lg overflow-hidden"
                      >
                        { }
                        <img
                          src={url}
                          alt="feedback-image"
                          className="w-24 h-24 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {selectedItem.admin_note && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">Ghi chú từ admin</p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">
                  {selectedItem.admin_note}
                </p>
              </div>
            )}

            {selectedItem.admin_reply && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-800">Phản hồi từ admin</p>
                <p className="text-sm text-emerald-900 whitespace-pre-wrap">
                  {selectedItem.admin_reply}
                </p>
              </div>
            )}

            {Array.isArray(selectedItem.admin_image_urls) &&
              selectedItem.admin_image_urls.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-800">
                    Ảnh phản hồi từ admin
                  </p>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {selectedItem.admin_image_urls.map((url, idx) => (
                      <button
                        key={`${url}-${idx}`}
                        type="button"
                        onClick={() => {
                          setPreviewImages(selectedItem.admin_image_urls || [])
                          setPreviewIndex(idx)
                        }}
                        className="w-24 h-24 shrink-0 border border-emerald-200 rounded-lg overflow-hidden"
                      >
                        { }
                        <img
                          src={url}
                          alt="admin-image"
                          className="w-24 h-24 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {selectedItem.status === 'done' && (
              <div className="text-sm text-emerald-700 inline-flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Phản hồi đã xử lý xong.
              </div>
            )}
          </div>
        )}
      </Modal>

      {previewImages && previewImages.length > 0 && (
        <div className="fixed inset-0 z-1100 bg-black/80 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl">
            <button
              type="button"
              onClick={() => setPreviewImages(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="bg-black rounded-xl overflow-hidden border border-white/20">
              { }
              <img
                src={previewImages[previewIndex]}
                alt={`feedback-${previewIndex + 1}`}
                className="w-full max-h-[78vh] object-contain"
              />
            </div>
            <div className="mt-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setPreviewIndex(
                    (prev) =>
                      (prev - 1 + previewImages.length) % previewImages.length,
                  )
                }
                className="text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-white">
                {previewIndex + 1} / {previewImages.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPreviewIndex((prev) => (prev + 1) % previewImages.length)
                }
                className="text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
