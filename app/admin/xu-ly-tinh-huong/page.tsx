'use client'
import { useQueryState } from '@/lib/use-query-state'


import { useEffect, useState } from 'react'
import {
  BookOpen,
  ChevronRight,
  Edit2,
  Lightbulb,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  Modal,
  ModalBody,
  ModalClose,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { cn } from '@/lib/utils'
import {
  CASE_CATEGORIES,
  type CaseStudy,
} from '@/lib/case-study-store'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_VARIANT_MAP: Record<
  string,
  'default' | 'info' | 'success' | 'warning' | 'purple'
> = {
  'Quản lý lớp học': 'info',
  'Tương tác học sinh': 'success',
  'Kỹ thuật giảng dạy': 'purple',
  'Xử lý tình huống đặc biệt': 'warning',
}
function formatAddedDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
function toLocalDateKey(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
// ─── Empty form ───────────────────────────────────────────────────────────────

const emptyForm = (): Omit<CaseStudy, 'id'> => ({
  category: CASE_CATEGORIES[0],
  title: '',
  directions: [''],
  notes: '',
})

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminXuLyTinhHuongPage() {
  const { token } = useAuth()
  const [studies, setStudies] = useState<CaseStudy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useQueryState<string | null>('category', null)
  const [searchQuery, setSearchQuery] = useQueryState<string>('search', '')
  const [filterDate, setFilterDate] = useQueryState<string>('date', '') // 'YYYY-MM-DD'

  // ── view modal
  const [viewTarget, setViewTarget] = useState<CaseStudy | null>(null)

  // ── add / edit modal
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<CaseStudy, 'id'>>(emptyForm())
  const [saving, setSaving] = useState(false)

  // ── delete confirm
  const [deleteTarget, setDeleteTarget] = useState<CaseStudy | null>(null)

  // Load from database
  useEffect(() => {
    let cancelled = false

    async function loadStudies() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/case-studies', {
          headers: authHeaders(token),
          credentials: 'same-origin',
          cache: 'no-store',
        })
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Không thể tải danh sách tình huống')
        }

        if (!cancelled) setStudies(data.studies)
      } catch (error) {
        console.error('Không thể tải tình huống:', error)
        if (!cancelled) {
          setStudies([])
          setError(
            error instanceof Error
              ? error.message
              : 'Không thể tải danh sách tình huống',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadStudies()

    return () => {
      cancelled = true
    }
  }, [token])

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm())
    setFormOpen(true)
  }

  const openEdit = (cs: CaseStudy) => {
    setEditingId(cs.id)
    setForm({
      category: cs.category,
      title: cs.title,
      directions: [...cs.directions],
      notes: cs.notes ?? '',
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)

    const cleanedDirections = form.directions.filter((d) => d.trim() !== '')
    if (cleanedDirections.length === 0) {
      setSaving(false)
      return
    }

    try {
      const response = await fetch('/api/case-studies', {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          category: form.category,
          title: form.title.trim(),
          directions: cleanedDirections,
          notes: form.notes?.trim() || null,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Không thể lưu tình huống')
      }

      const savedStudy = data.study as CaseStudy
      setStudies((current) =>
        editingId
          ? current.map((study) =>
              study.id === savedStudy.id ? savedStudy : study,
            )
          : [savedStudy, ...current],
      )
      setFormOpen(false)
      setError(null)
    } catch (error) {
      console.error('Không thể lưu tình huống:', error)
      setError(
        error instanceof Error ? error.message : 'Không thể lưu tình huống',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cs: CaseStudy) => {
    try {
      const response = await fetch('/api/case-studies', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ id: cs.id }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Không thể xóa tình huống')
      }

      setStudies((current) => current.filter((study) => study.id !== cs.id))
      setDeleteTarget(null)
      setError(null)
    } catch (error) {
      console.error('Không thể xóa tình huống:', error)
      setError(
        error instanceof Error ? error.message : 'Không thể xóa tình huống',
      )
    }
  }

  // direction list helpers
  const setDirection = (idx: number, value: string) => {
    const next = [...form.directions]
    next[idx] = value
    setForm({ ...form, directions: next })
  }

  const addDirection = () =>
    setForm({ ...form, directions: [...form.directions, ''] })

  const removeDirection = (idx: number) => {
    const next = form.directions.filter((_, i) => i !== idx)
    setForm({ ...form, directions: next.length ? next : [''] })
  }

  // ─── Filtered list ────────────────────────────────────────────────────────

  const filtered = studies.filter((cs) => {
    const matchCat = activeCategory ? cs.category === activeCategory : true
    const matchSearch = searchQuery
      ? cs.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true
    const matchDate = filterDate
      ? toLocalDateKey(cs.createdAt) === filterDate
      : true
    return matchCat && matchSearch && matchDate
  })

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <PageLayout maxWidth="5xl" padding="responsive">
      <PageLayoutContent spacing="lg">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight text-foreground">
                Bộ tham khảo xử lý tình huống
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Quản lý case study — thay đổi sẽ cập nhật ngay cho giáo viên
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="default" size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Thêm tình huống
            </Button>
          </div>
        </div>

        {/* ── Search + Filter ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm tình huống..."
              className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-4 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {/* date filter */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-600 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="rounded-lg border border-border px-2 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Xóa lọc ngày"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* category pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200',
                activeCategory === null
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-border bg-white text-gray-600 hover:border-primary/40 hover:text-primary',
              )}
            >
              Tất cả ({studies.length})
            </button>
            {CASE_CATEGORIES.map((cat) => {
              const count = studies.filter((c) => c.category === cat).length
              return (
                <button
                  key={cat}
                  onClick={() =>
                    setActiveCategory(cat === activeCategory ? null : cat)
                  }
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200',
                    activeCategory === cat
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-border bg-white text-gray-600 hover:border-primary/40 hover:text-primary',
                  )}
                >
                  {cat} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* ── List ───────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Đang tải tình huống...</p>
          </div>
        )}

        {!loading && !error && (
        <div className="flex flex-col gap-2">
          {filtered.map((cs, index) => (
            <div
              key={cs.id}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md"
            >
              {/* index */}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                {String(index + 1).padStart(2, '0')}
              </span>

              {/* content */}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <Badge
                    variant={CATEGORY_VARIANT_MAP[cs.category] ?? 'default'}
                    size="xs"
                    shape="pill"
                  >
                    {cs.category}
                  </Badge>
                </div>
                <p className="text-sm font-medium leading-snug text-foreground">
                  {cs.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {cs.directions.length} bước xử lý
                  {cs.createdAt ? ` · Thêm vào ${formatAddedDate(cs.createdAt)}` : ''}
                </p>
              </div>

              {/* actions */}
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <button
                  onClick={() => setViewTarget(cs)}
                  title="Xem chi tiết"
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => openEdit(cs)}
                  title="Chỉnh sửa"
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(cs)}
                  title="Xóa"
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? 'Không tìm thấy tình huống nào phù hợp.'
                  : 'Chưa có tình huống nào trong danh mục này.'}
              </p>
              <Button variant="outline" size="sm" className="mt-4 text-xs" onClick={openAdd}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Thêm tình huống đầu tiên
              </Button>
            </div>
          )}
        </div>
        )}
      </PageLayoutContent>

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} size="lg">
        {viewTarget && (
          <>
            <ModalHeader className="rounded-t-xl bg-primary">
              <div className="min-w-0 flex-1 pr-4">
                <Badge
                  variant={CATEGORY_VARIANT_MAP[viewTarget.category] ?? 'default'}
                  size="xs"
                  shape="pill"
                  className="mb-2 opacity-90"
                >
                  {viewTarget.category}
                </Badge>
                <ModalTitle className="text-base leading-snug text-white">
                  {viewTarget.title}
                </ModalTitle>
              </div>
              <ModalClose
                onClick={() => setViewTarget(null)}
                className="shrink-0 text-white hover:bg-white/20"
              />
            </ModalHeader>
            <ModalBody className="max-h-[60vh] px-6 py-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hướng xử lý
              </p>
              <ol className="space-y-3">
                {viewTarget.directions.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-foreground">{step}</p>
                  </li>
                ))}
              </ol>
              {viewTarget.notes && (
                <div className="mt-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-sm leading-relaxed text-amber-800">
                    <span className="font-semibold">Lưu ý: </span>
                    {viewTarget.notes}
                  </p>
                </div>
              )}
            </ModalBody>
            <div className="flex items-center justify-between rounded-b-xl border-t border-border bg-muted/50 px-6 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setViewTarget(null)
                  openEdit(viewTarget)
                }}
              >
                <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                Chỉnh sửa
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewTarget(null)}
              >
                Đóng
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          ADD / EDIT MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="2xl"
        disableBackdropClick
      >
        <ModalHeader>
          <ModalTitle>
            {editingId ? 'Chỉnh sửa tình huống' : 'Thêm tình huống mới'}
          </ModalTitle>
          <ModalClose onClick={() => setFormOpen(false)} />
        </ModalHeader>

        <ModalBody className="max-h-[70vh] px-6 py-5">
          <div className="space-y-5">
            {/* Category */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Danh mục <span className="text-destructive">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {CASE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Tên tình huống <span className="text-destructive">*</span>
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ví dụ: Học sinh mất trật tự trong giờ học..."
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Directions */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Hướng xử lý <span className="text-destructive">*</span>
              </label>
              <div className="space-y-2">
                {form.directions.map((dir, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="mt-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {idx + 1}
                    </span>
                    <textarea
                      value={dir}
                      onChange={(e) => setDirection(idx, e.target.value)}
                      placeholder={`Bước ${idx + 1}...`}
                      rows={2}
                      className="flex-1 resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeDirection(idx)}
                      disabled={form.directions.length === 1}
                      className="mt-1.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addDirection}
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline focus-visible:outline-none"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm bước
              </button>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Lưu ý{' '}
                <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Những lưu ý quan trọng cần nhớ khi xử lý tình huống này..."
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </ModalBody>

        <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-border bg-muted/50 px-6 py-4">
          <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>
            Hủy
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
          >
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {editingId ? 'Lưu thay đổi' : 'Thêm tình huống'}
          </Button>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          DELETE CONFIRM MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        size="sm"
      >
        {deleteTarget && (
          <>
            <ModalHeader>
              <ModalTitle>Xác nhận xóa</ModalTitle>
              <ModalClose onClick={() => setDeleteTarget(null)} />
            </ModalHeader>
            <ModalBody className="px-6 py-5">
              <p className="text-sm text-foreground">
                Bạn có chắc muốn xóa tình huống:
              </p>
              <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground">
                &ldquo;{deleteTarget.title}&rdquo;
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Hành động này không thể hoàn tác.
              </p>
            </ModalBody>
            <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-border bg-muted/50 px-6 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(deleteTarget)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Xóa
              </Button>
            </div>
          </>
        )}
      </Modal>
    </PageLayout>
  )
}
