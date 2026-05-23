/**
 * Badge Component
 * 
 * Reusable badge component for status indicators, tags, and labels.
 * 
 * Features:
 * - Multiple variants (default, success, danger, warning, info, etc.)
 * - Multiple sizes (xs, sm, md, lg)
 * - Icon support
 * - Rounded or pill shape
 * 
 * @example
 * ```tsx
 * <Badge variant="success">✓ Tính</Badge>
 * <Badge variant="danger">✗ Không tính</Badge>
 * <Badge variant="info" icon={User}>Admin</Badge>
 * <Badge variant="warning" size="lg">Pending</Badge>
 * ```
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800',
        success: 'bg-green-100 text-green-800',
        danger: 'bg-red-100 text-red-800',
        warning: 'bg-amber-100 text-amber-800',
        info: 'bg-blue-100 text-blue-800',
        purple: 'bg-purple-100 text-purple-800',
        pink: 'bg-pink-100 text-pink-800',
        emerald: 'bg-emerald-100 text-emerald-700',
        violet: 'bg-violet-50 text-violet-700',
        slate: 'bg-slate-50 text-slate-500 border border-slate-100',
        outline: 'border border-gray-300 bg-white text-gray-700',
      },
      size: {
        xs: 'px-2 py-0.5 text-[10px]',
        sm: 'px-2.5 py-0.5 text-[11px]',
        md: 'px-3 py-1 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
      shape: {
        rounded: 'rounded',
        pill: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      shape: 'rounded',
    },
  }
)

// Export badgeVariants for external use
export { badgeVariants }

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Icon component from lucide-react */
  icon?: React.ComponentType<{ className?: string }>
}

export function Badge({
  className,
  variant,
  size,
  shape,
  icon: IconComponent,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size, shape }), className)}
      {...props}
    >
      {IconComponent && <IconComponent className="h-3 w-3" />}
      {children}
    </span>
  )
}

/**
 * StatusBadge Component
 * 
 * Specialized badge for boolean status (active/inactive, yes/no, etc.)
 * 
 * @example
 * ```tsx
 * <StatusBadge active={true} activeText="✓ Tính" inactiveText="✗ Không tính" />
 * <StatusBadge active={user.isActive} activeText="Active" inactiveText="Inactive" />
 * ```
 */
interface StatusBadgeProps {
  active: boolean
  activeText?: string
  inactiveText?: string
  activeVariant?: BadgeProps['variant']
  inactiveVariant?: BadgeProps['variant']
  size?: BadgeProps['size']
  shape?: BadgeProps['shape']
  className?: string
}

export function StatusBadge({
  active,
  activeText = '✓ Active',
  inactiveText = '✗ Inactive',
  activeVariant = 'success',
  inactiveVariant = 'danger',
  size = 'md',
  shape = 'rounded',
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      variant={active ? activeVariant : inactiveVariant}
      size={size}
      shape={shape}
      className={className}
    >
      {active ? activeText : inactiveText}
    </Badge>
  )
}
