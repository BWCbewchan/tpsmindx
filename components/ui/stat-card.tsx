/**
 * StatCard Component
 * 
 * Reusable card component for displaying statistics/metrics.
 * 
 * Features:
 * - Icon + Label + Value layout
 * - Color variants for different metric types
 * - Trend indicator (optional)
 * - Responsive design
 * 
 * @example
 * ```tsx
 * <StatCard
 *   label="Tổng tài nguyên"
 *   value={1234}
 *   icon={File}
 * />
 * 
 * <StatCard
 *   label="Hình ảnh"
 *   value={567}
 *   icon={Image}
 *   variant="blue"
 * />
 * 
 * <StatCard
 *   label="Doanh thu"
 *   value="1,234,567 đ"
 *   icon={TrendingUp}
 *   variant="success"
 *   trend={{ value: 12.5, direction: 'up' }}
 * />
 * ```
 */

import * as React from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  /** Label text */
  label: string
  /** Value to display (number or formatted string) */
  value: string | number
  /** Icon component from lucide-react */
  icon?: React.ComponentType<{ className?: string }>
  /** Color variant */
  variant?: 'default' | 'blue' | 'purple' | 'amber' | 'emerald' | 'success' | 'danger'
  /** Trend indicator */
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  /** Custom className */
  className?: string
  /** Format function for value */
  formatter?: (value: string | number) => string
}

const variantClasses = {
  default: 'text-gray-900',
  blue: 'text-blue-600',
  purple: 'text-purple-600',
  amber: 'text-amber-600',
  emerald: 'text-emerald-600',
  success: 'text-green-600',
  danger: 'text-red-600',
}

export function StatCard({
  label,
  value,
  icon: IconComponent,
  variant = 'default',
  trend,
  className,
  formatter,
}: StatCardProps) {
  const displayValue = React.useMemo(() => {
    if (formatter) return formatter(value)
    if (typeof value === 'number') {
      return new Intl.NumberFormat('vi-VN').format(value)
    }
    return value
  }, [value, formatter])

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow',
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-gray-500">{label}</p>
        {IconComponent && (
          <IconComponent className={cn('h-4 w-4', variantClasses[variant])} />
        )}
      </div>
      <div className="flex items-end justify-between">
        <p className={cn('text-xl font-bold', variantClasses[variant])}>
          {displayValue}
        </p>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * StatGrid Component
 * 
 * Grid container for multiple StatCard components.
 * 
 * @example
 * ```tsx
 * <StatGrid>
 *   <StatCard label="Tổng" value={1234} icon={File} />
 *   <StatCard label="Hình ảnh" value={567} icon={Image} variant="blue" />
 *   <StatCard label="Video" value={89} icon={Video} variant="purple" />
 * </StatGrid>
 * ```
 */
interface StatGridProps {
  children: React.ReactNode
  /** Number of columns (responsive) */
  cols?: 2 | 3 | 4 | 5 | 6
  className?: string
}

const colsClasses = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-5',
  6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
}

export function StatGrid({ children, cols = 4, className }: StatGridProps) {
  return (
    <div className={cn('grid gap-3', colsClasses[cols], className)}>
      {children}
    </div>
  )
}
