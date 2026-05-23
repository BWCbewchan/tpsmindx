import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'

interface PageSkeletonProps {
  /**
   * Variant of skeleton to show
   * - 'default': Header + content blocks
   * - 'table': Header + table skeleton
   * - 'grid': Header + grid of cards
   * - 'form': Header + form fields
   */
  variant?: 'default' | 'table' | 'grid' | 'form'
  
  /**
   * Show page header skeleton (title + description)
   */
  showHeader?: boolean
  
  /**
   * Number of content items to show
   */
  itemCount?: number
  
  /**
   * Max width of the page
   */
  maxWidth?: '4xl' | '5xl' | '6xl' | '7xl' | 'full'
  
  /**
   * Padding size
   */
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

/**
 * Standardized page skeleton for consistent loading states
 * 
 * @example
 * ```tsx
 * if (loading) {
 *   return <PageSkeleton variant="table" />
 * }
 * ```
 */
export function PageSkeleton({
  variant = 'default',
  showHeader = true,
  itemCount = 6,
  maxWidth = '7xl',
  padding = 'md',
}: PageSkeletonProps) {
  return (
    <PageLayout maxWidth={maxWidth} padding={padding}>
      <PageLayoutContent spacing="lg">
        {/* Header Skeleton */}
        {showHeader && (
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-gray-200 rounded w-64"></div>
            <div className="h-4 bg-gray-200 rounded w-96 max-w-full"></div>
          </div>
        )}

        {/* Content Skeleton based on variant */}
        {variant === 'default' && (
          <div className="animate-pulse space-y-4">
            {[...Array(itemCount)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            ))}
          </div>
        )}

        {variant === 'table' && (
          <div className="animate-pulse bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="h-5 bg-gray-200 rounded w-48"></div>
                <div className="h-5 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
            
            {/* Table Rows */}
            <div className="divide-y divide-gray-200">
              {[...Array(itemCount)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-4 bg-gray-200 rounded w-48"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="flex-1"></div>
                  <div className="h-8 bg-gray-200 rounded w-20"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {variant === 'grid' && (
          <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(itemCount)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="h-48 bg-gray-200"></div>
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {variant === 'form' && (
          <div className="animate-pulse bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            {[...Array(itemCount)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-10 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
            <div className="flex gap-3 pt-4">
              <div className="h-10 bg-gray-200 rounded w-24"></div>
              <div className="h-10 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
        )}
      </PageLayoutContent>
    </PageLayout>
  )
}

/**
 * Compact skeleton for sections within a page
 */
export function SectionSkeleton({
  rows = 3,
  showTitle = true,
}: {
  rows?: number
  showTitle?: boolean
}) {
  return (
    <div className="animate-pulse space-y-4">
      {showTitle && <div className="h-6 bg-gray-200 rounded w-48"></div>}
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded w-full"></div>
        ))}
      </div>
    </div>
  )
}

/**
 * Card skeleton for grid layouts
 */
export function CardSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="h-48 bg-gray-200"></div>
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    </div>
  )
}

/**
 * Table row skeleton
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="animate-pulse flex items-center gap-4 px-6 py-4">
      {[...Array(columns)].map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-gray-200 rounded ${i === columns - 1 ? 'w-20' : 'flex-1'}`}
        ></div>
      ))}
    </div>
  )
}
