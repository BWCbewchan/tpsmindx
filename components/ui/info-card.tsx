/**
 * InfoCard Component
 * 
 * Reusable card component for displaying information with icon, label, and value.
 * Supports sensitive data with toggle visibility.
 * 
 * Features:
 * - Icon + Label + Value layout
 * - Sensitive data masking with toggle
 * - Consistent styling
 * - Responsive design
 * 
 * @example
 * ```tsx
 * <InfoCard
 *   icon={Mail}
 *   label="Email"
 *   value="user@example.com"
 * />
 * 
 * <InfoCard
 *   icon={Phone}
 *   label="Số điện thoại"
 *   value="0123456789"
 *   sensitive
 * />
 * ```
 */

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Icon } from './primitives/icon'

interface InfoCardProps {
  /** Icon component from lucide-react */
  icon: React.ComponentType<{ className?: string }>
  /** Label text */
  label: string
  /** Value to display */
  value: string
  /** Mask value and show toggle button */
  sensitive?: boolean
  /** Custom className */
  className?: string
  /** Custom value formatter */
  formatter?: (value: string) => string
}

export function InfoCard({
  icon: IconComponent,
  label,
  value,
  sensitive = false,
  className,
  formatter,
}: InfoCardProps) {
  const [revealed, setRevealed] = React.useState(false)

  const displayValue = React.useMemo(() => {
    if (sensitive && !revealed) return '••••••'
    return formatter ? formatter(value) : value
  }, [value, sensitive, revealed, formatter])

  return (
    <div
      className={cn(
        'flex items-start gap-2 p-2.5 rounded-lg border border-gray-300 bg-gray-50',
        className
      )}
    >
      <div className="text-gray-500 mt-0.5">
        <IconComponent className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-semibold text-gray-900 break-words leading-snug">
          {displayValue}
        </div>
      </div>
      {sensitive && (
        <Button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          variant="ghost"
          size="icon-sm"
          className="mt-1 shrink-0 h-6 w-6"
          aria-label={revealed ? 'Ẩn' : 'Hiện'}
        >
          <Icon icon={revealed ? EyeOff : Eye} size="sm" />
        </Button>
      )}
    </div>
  )
}

/**
 * InfoGrid Component
 * 
 * Grid container for multiple InfoCard components.
 * 
 * @example
 * ```tsx
 * <InfoGrid>
 *   <InfoCard icon={User} label="Tên" value="Nguyễn Văn A" />
 *   <InfoCard icon={Mail} label="Email" value="user@example.com" />
 *   <InfoCard icon={Phone} label="SĐT" value="0123456789" sensitive />
 * </InfoGrid>
 * ```
 */
interface InfoGridProps {
  children: React.ReactNode
  /** Number of columns (responsive) */
  cols?: 1 | 2 | 3 | 4
  className?: string
}

const colsClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
}

export function InfoGrid({ children, cols = 2, className }: InfoGridProps) {
  return (
    <div className={cn('grid gap-3', colsClasses[cols], className)}>
      {children}
    </div>
  )
}

/**
 * InfoSection Component
 * 
 * Section container with title for grouping InfoCard components.
 * 
 * @example
 * ```tsx
 * <InfoSection title="Thông tin cơ bản">
 *   <InfoGrid>
 *     <InfoCard icon={User} label="Tên" value="Nguyễn Văn A" />
 *     <InfoCard icon={Mail} label="Email" value="user@example.com" />
 *   </InfoGrid>
 * </InfoSection>
 * ```
 */
interface InfoSectionProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function InfoSection({ title, children, className }: InfoSectionProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      {children}
    </div>
  )
}
