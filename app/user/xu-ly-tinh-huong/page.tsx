'use client'
import { useQueryState } from '@/lib/use-query-state'


import { useEffect, useState } from 'react'
import { BookOpen, ChevronRight, Lightbulb } from 'lucide-react'
import {
  Modal,
  ModalBody,
  ModalClose,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import {
  CASE_CATEGORIES,
  type CaseStudy,
} from '@/lib/case-study-store'
import { cn } from '@/lib/utils'

const CATEGORY_VARIANT_MAP: Record<
  string,
  'default' | 'info' | 'success' | 'warning' | 'purple'
> = {
  'Quản lý lớp học': 'info',
  'Tương tác học sinh': 'success',
  'Kỹ thuật giảng dạy': 'purple',
  'Xử lý tình huống đặc biệt': 'warning',
}

export default function XuLyTinhHuongPage() {
  const { token } = useAuth()

  const [studies, setStudies] = useState<CaseStudy[]>([])
  const [selectedCase, setSelectedCase] = useState<CaseStudy | null>(null)
  const [activeCategory, setActiveCategory] = useQueryState<string | null>('category', null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

        if (!cancelled) {
          setStudies(data.studies)
        }
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
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadStudies()

    return () => {
      cancelled = true
    }
  }, [token])

  const filteredCases = activeCategory
    ? studies.filter((caseStudy) => caseStudy.category === activeCategory)
    : studies

  return (
    <PageLayout maxWidth="5xl" padding="responsive">
      <PageLayoutContent spacing="lg">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight text-foreground">
                Bộ tham khảo xử lý tình huống
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Case study thực tế — bấm vào từng tình huống để xem hướng xử lý chi tiết
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200',
              activeCategory === null
                ? 'border-primary bg-primary text-white shadow-sm'
                : 'border-border bg-white text-gray-600 hover:border-primary/40 hover:text-primary',
            )}
          >
            Tất cả ({studies.length})
          </button>

          {CASE_CATEGORIES.map((category) => {
            const count = studies.filter(
              (caseStudy) => caseStudy.category === category,
            ).length

            return (
              <button
                key={category}
                type="button"
                onClick={() =>
                  setActiveCategory(
                    category === activeCategory ? null : category,
                  )
                }
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200',
                  activeCategory === category
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-border bg-white text-gray-600 hover:border-primary/40 hover:text-primary',
                )}
              >
                {category} ({count})
              </button>
            )
          })}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">
              Đang tải tình huống...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Không thể tải dữ liệu: {error}
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-2">
            {filteredCases.map((caseStudy, index) => (
              <button
                key={caseStudy.id}
                type="button"
                onClick={() => setSelectedCase(caseStudy)}
                className={cn(
                  'group flex w-full items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 text-left shadow-sm',
                  'transition-all duration-200',
                  'hover:border-primary/40 hover:bg-primary/[0.02] hover:shadow-md',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge
                      variant={
                        CATEGORY_VARIANT_MAP[caseStudy.category] ?? 'default'
                      }
                      size="xs"
                      shape="pill"
                    >
                      {caseStudy.category}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium leading-snug text-foreground transition-colors duration-200 group-hover:text-primary">
                    {caseStudy.title}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            ))}
          </div>
        )}

        {!loading && !error && filteredCases.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Không có tình huống nào trong danh mục này.
            </p>
          </div>
        )}
      </PageLayoutContent>

      <Modal
        open={!!selectedCase}
        onClose={() => setSelectedCase(null)}
        size="lg"
      >
        {selectedCase && (
          <>
            <ModalHeader className="rounded-t-xl bg-primary">
              <div className="min-w-0 flex-1 pr-4">
                <Badge
                  variant={
                    CATEGORY_VARIANT_MAP[selectedCase.category] ?? 'default'
                  }
                  size="xs"
                  shape="pill"
                  className="mb-2 opacity-90"
                >
                  {selectedCase.category}
                </Badge>
                <ModalTitle className="text-base leading-snug text-white">
                  {selectedCase.title}
                </ModalTitle>
              </div>
              <ModalClose
                onClick={() => setSelectedCase(null)}
                className="shrink-0 text-white hover:bg-white/20"
              />
            </ModalHeader>

            <ModalBody className="max-h-[60vh] px-6 py-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hướng xử lý
              </p>

              <ol className="space-y-3">
                {selectedCase.directions.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-foreground">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>

              {selectedCase.notes && (
                <div className="mt-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-sm leading-relaxed text-amber-800">
                    <span className="font-semibold">Lưu ý: </span>
                    {selectedCase.notes}
                  </p>
                </div>
              )}
            </ModalBody>

            <div className="flex items-center justify-end rounded-b-xl border-t border-border bg-muted/50 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Đóng
              </button>
            </div>
          </>
        )}
      </Modal>
    </PageLayout>
  )
}