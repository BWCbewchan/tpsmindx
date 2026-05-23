'use client'

import { Modal } from '@/components/ui/modal'
import { PageContainer } from '@/components/PageContainer'
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
    ChevronLeft,
    ChevronRight,
    RefreshCcw,
    Search,
    UploadCloud,
    X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
type FeedbackItem = {
  id: number
  user_email: string
  user_name: string | null
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

type FeedbackStatus = FeedbackItem['status']
type StatusFilter = 'all' | FeedbackStatus
type StatusVariant = 'info' | 'warning' | 'success'

function getStatusMeta(status: FeedbackStatus): {
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

function getProgressSteps(status: FeedbackStatus): StepItem[] {
  const currentIndex = status === 'new' ? 0 : status === 'in_progress' ? 1 : 2
  return [
    {
      id: 'new',
      label: 'Step 1',
      description: 'Tiếp nhận',
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

export default function AdminFeedbackPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')
  const [searchText, setSearchText] = useState('')

  const [detailItem, setDetailItem] = useState<FeedbackItem | null>(null)
  const [detailReply, setDetailReply] = useState('')
  const [detailAdminImages, setDetailAdminImages] = useState<string[]>([])
  const [notes, setNotes] = useState<Record<number, string>>({})

  const [previewImages, setPreviewImages] = useState<string[] | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const stats = useMemo(() => {
    return {
      total: items.length,
      newCount: items.filter((x) => x.status === 'new').length,
      inProgressCount: items.filter((x) => x.status === 'in_progress').length,
      doneCount: items.filter((x) => x.status === 'done').length,
    }
  }, [items])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const statusMatched =
        filterStatus === 'all' || item.status === filterStatus
      const query = searchText.trim().toLowerCase()

      if (query.length === 0) return statusMatched

      const searchable = [
        item.user_email,
        item.user_name || '',
        item.content || '',
        item.suggestion || '',
        item.screen_path || '',
        formatScreenTitle(item.screen_path),
      ]
        .join(' ')
        .toLowerCase()

      return statusMatched && searchable.includes(query)
    })
  }, [items, filterStatus, searchText])

  const fetchItems = async () => {
    if (!user?.email) return

    try {
      setLoading(true)
      setLoadingError(null)

      const params = new URLSearchParams({
        scope: 'all',
        requestEmail: user.email,
      })
      const response = await fetch(`/api/feedback?${params.toString()}`, {
        cache: 'no-store',
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Không thể tải phản hồi')
      }

      setItems(data.items || [])
      const initialNotes: Record<number, string> = {}
      ;(data.items || []).forEach((item: FeedbackItem) => {
        initialNotes[item.id] = item.admin_note || ''
      })
      setNotes(initialNotes)
    } catch (error: any) {
      const message = error.message || 'Lỗi tải phản hồi'
      setLoadingError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    fetchItems()

  }, [user?.email])

  useEffect(() => {
    if (!detailItem && !previewImages) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (previewImages) {
          setPreviewImages(null)
          return
        }
        setDetailItem(null)
        return
      }

      if (!previewImages || previewImages.length === 0) return

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
  }, [detailItem, previewImages])

  const uploadAdminImages = async (files: File[]) => {
    if (files.length === 0) return [] as string[]

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/feedback/upload-image', {
          method: 'POST',
          body: formData,
        })
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Không thể upload ảnh phản hồi')
        }
        return data.url || data.storagePath
      }),
    )

    return uploaded.filter(Boolean)
  }
  const handleAdminFiles = async (files: File[]) => {
    if (files.length === 0) return

    try {
      const uploaded = await uploadAdminImages(files)
      setDetailAdminImages((prev) => [...prev, ...uploaded])
      toast.success('Đã upload ảnh phản hồi')
    } catch (error: any) {
      toast.error(error.message || 'Lỗi upload ảnh phản hồi')
    }
  }

  const saveFromModal = async (nextStatus?: FeedbackStatus) => {
    if (!detailItem || !user?.email) return

    try {
      setSavingId(detailItem.id)

      const targetStatus = nextStatus || detailItem.status
      const response = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: detailItem.id,
          status: targetStatus,
          adminNote: notes[detailItem.id] || '',
          adminReply: detailReply,
          adminImageUrls: detailAdminImages,
          requestEmail: user.email,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Không thể cập nhật phản hồi')
      }

      setItems((prev) =>
        prev.map((x) => (x.id === detailItem.id ? { ...x, ...data.item } : x)),
      )
      setDetailItem({ ...detailItem, ...data.item })
      toast.success('Đã lưu xử lý phản hồi')
    } catch (error: any) {
      toast.error(error.message || 'Lỗi xử lý phản hồi')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <PageContainer
      title="Trung Tâm Phản Hồi"
      description="Theo dõi, phân loại và phản hồi các ý kiến từ người dùng"
      maxWidth="2xl"
      headerActions={
        <button
          type="button"
          onClick={fetchItems}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#f3b4bd] bg-white px-4 text-sm font-medium text-[#a1001f] shadow-sm hover:bg-[#a1001f]/5 disabled:opacity-60"
        >
          <RefreshCcw className="mr-1.5 h-4 w-4" />
          Làm mới
        </button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-medium text-blue-700">Mới tiếp nhận</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">
              {stats.newCount}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-medium text-amber-700">Đang xử lý</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">
              {stats.inProgressCount}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-medium text-emerald-700">Hoàn thành</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">
              {stats.doneCount}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-65 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm theo người gửi, email, nội dung hoặc màn hình..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="new">Mới tiếp nhận</option>
              <option value="in_progress">Đang xử lý</option>
              <option value="done">Hoàn thành</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Danh sách phản hồi
            </h2>
            <p className="text-sm text-gray-600">
              Tổng: {filteredItems.length} phản hồi
            </p>
          </div>

          {loadingError && !loading && (
            <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:mx-6">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Không thể tải dữ liệu</p>
                <p className="mt-0.5">{loadingError}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="p-4 sm:p-6">
              <TableSkeleton rows={8} columns={5} />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-600">
              Không có phản hồi phù hợp bộ lọc.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày gửi</TableHead>
                      <TableHead>Người gửi</TableHead>
                      <TableHead>Màn hình</TableHead>
                      <TableHead>Nội dung</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const statusMeta = getStatusMeta(item.status)
                      return (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer hover:bg-blue-50/40"
                          onClick={() => {
                            setDetailItem(item)
                            setDetailReply(item.admin_reply || '')
                            setDetailAdminImages(item.admin_image_urls || [])
                          }}
                        >
                          <TableCell>
                            {new Date(item.created_at).toLocaleDateString(
                              'vi-VN',
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900">
                                {item.user_name || item.user_email}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.user_email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatScreenTitle(item.screen_path)}
                          </TableCell>
                          <TableCell
                            className="max-w-95 truncate"
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
                {filteredItems.map((item) => {
                  const statusMeta = getStatusMeta(item.status)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full p-4 text-left hover:bg-gray-50"
                      onClick={() => {
                        setDetailItem(item)
                        setDetailReply(item.admin_reply || '')
                        setDetailAdminImages(item.admin_image_urls || [])
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.user_name || item.user_email}
                        </p>
                        <Badge variant={statusMeta.variant}>
                          {statusMeta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">
                        {formatScreenTitle(item.screen_path)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-600">
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

      <Modal
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        title={
          detailItem
            ? `Chi tiết phản hồi #${detailItem.id}`
            : 'Chi tiết phản hồi'
        }
        subtitle={
          detailItem ? detailItem.user_name || detailItem.user_email : undefined
        }
        maxWidth="4xl"
      >
        {detailItem && (
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <Stepper steps={getProgressSteps(detailItem.status)} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Email người gửi</p>
                <p className="text-sm font-medium text-gray-900 break-all">
                  {detailItem.user_email}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Màn hình</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatScreenTitle(detailItem.screen_path)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Ngày gửi</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(detailItem.created_at).toLocaleString('vi-VN')}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Cập nhật gần nhất</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(detailItem.updated_at).toLocaleString('vi-VN')}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                <p className="text-xs text-gray-600">Nội dung phản hồi</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {detailItem.content}
                </p>
              </div>
              {detailItem.suggestion && (
                <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                  <p className="text-xs text-gray-600">
                    Đề xuất của người dùng
                  </p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {detailItem.suggestion}
                  </p>
                </div>
              )}
            </div>

            {Array.isArray(detailItem.image_urls) &&
              detailItem.image_urls.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-800">
                    Ảnh người dùng đính kèm
                  </p>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {detailItem.image_urls.map((url, idx) => (
                      <button
                        key={`${url}-${idx}`}
                        type="button"
                        onClick={() => {
                          setPreviewImages(detailItem.image_urls || [])
                          setPreviewIndex(idx)
                        }}
                        className="w-24 h-24 shrink-0 border border-gray-200 rounded-lg overflow-hidden"
                      >
                        { }
                        <img
                          src={url}
                          alt="feedback-user-image"
                          className="w-24 h-24 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

            <div className="space-y-3 rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900">
                Xử lý phản hồi (Admin)
              </p>

              <textarea
                value={notes[detailItem.id] || ''}
                onChange={(e) =>
                  setNotes((prev) => ({
                    ...prev,
                    [detailItem.id]: e.target.value,
                  }))
                }
                placeholder="Ghi chú nội bộ cho phản hồi này..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={2}
              />

              <textarea
                value={detailReply}
                onChange={(e) => setDetailReply(e.target.value)}
                placeholder="Nhập phản hồi gửi lại người dùng..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={3}
              />

              <label
                className="block cursor-pointer rounded-xl border-2 border-dashed border-gray-300 p-4 transition-colors hover:border-[#a1001f]/40 hover:bg-[#a1001f]/2"
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData.items || [])
                    .filter((item) => item.type.startsWith('image/'))
                    .map((item) => item.getAsFile())
                    .filter((file): file is File => Boolean(file))
                  if (files.length > 0) {
                    e.preventDefault()
                    handleAdminFiles(files)
                  }
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || [])
                    await handleAdminFiles(files)
                  }}
                />
                <div className="flex min-h-16 items-center justify-center gap-2 text-center text-sm text-gray-600">
                  <UploadCloud className="h-4 w-4" />
                  Upload hoặc dán ảnh phản hồi cho người dùng (Ctrl+V)
                </div>
              </label>

              {detailAdminImages.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto">
                  {detailAdminImages.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-gray-200"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewImages(detailAdminImages)
                          setPreviewIndex(idx)
                        }}
                        className="block h-full w-full"
                      >
                        { }
                        <img
                          src={url}
                          alt="feedback-admin-image"
                          className="h-24 w-24 object-cover"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDetailAdminImages((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveFromModal()}
                  disabled={savingId === detailItem.id}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Lưu phản hồi
                </button>
                <button
                  type="button"
                  onClick={() => saveFromModal('in_progress')}
                  disabled={
                    savingId === detailItem.id || detailItem.status !== 'new'
                  }
                  className="rounded-lg border border-[#a1001f] bg-[#a1001f] px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  Chuyển sang Đang xử lý
                </button>
                <button
                  type="button"
                  onClick={() => saveFromModal('done')}
                  disabled={
                    savingId === detailItem.id ||
                    detailItem.status !== 'in_progress' ||
                    !detailReply.trim()
                  }
                  className="rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  Đánh dấu Hoàn thành
                </button>
              </div>
              {detailItem.status === 'in_progress' && !detailReply.trim() && (
                <p className="text-xs text-amber-700">
                  Cần nhập phản hồi trước khi đánh dấu hoàn thành.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {previewImages && previewImages.length > 0 && (
        <div className="fixed inset-0 z-1100 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-5xl">
            <button
              type="button"
              onClick={() => setPreviewImages(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="overflow-hidden rounded-xl border border-white/20 bg-black">
              { }
              <img
                src={previewImages[previewIndex]}
                alt={`feedback-${previewIndex + 1}`}
                className="w-full max-h-[80vh] object-contain"
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
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
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
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
