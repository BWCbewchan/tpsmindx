/**
 * Loading Spinner Component
 * 
 * Inline loading indicator following international standards:
 * - Material Design 3 Progress Indicators
 * - Apple HIG Activity Indicators
 * 
 * @example
 * ```tsx
 * // Inline spinner
 * <LoadingSpinner size="sm" />
 * 
 * // With text
 * <LoadingSpinner size="md">Đang tải...</LoadingSpinner>
 * 
 * // Custom color
 * <LoadingSpinner className="text-blue-600" />
 * ```
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Box } from './primitives/box'
import { Text } from './primitives/text'

const spinnerVariants = cva(
  'animate-spin rounded-full border-2 border-current border-t-transparent',
  {
    variants: {
      size: {
        xs: 'size-3',   // 12px
        sm: 'size-4',   // 16px
        md: 'size-6',   // 24px
        lg: 'size-8',   // 32px
        xl: 'size-12',  // 48px
      },
      variant: {
        default: 'text-primary',
        secondary: 'text-gray-600',
        white: 'text-white',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  },
)

export interface LoadingSpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  children?: React.ReactNode
}

export function LoadingSpinner({
  size,
  variant,
  className,
  children,
  ...props
}: LoadingSpinnerProps) {
  if (children) {
    return (
      <Box
        className={cn('flex items-center gap-2', className)}
        {...props}
      >
        <div
          className={cn(spinnerVariants({ size, variant }))}
          role="status"
          aria-label="Đang tải"
        />
        <Text size="sm" color="muted">
          {children}
        </Text>
      </Box>
    )
  }

  return (
    <div
      className={cn(spinnerVariants({ size, variant, className }))}
      role="status"
      aria-label="Đang tải"
      {...props}
    />
  )
}
