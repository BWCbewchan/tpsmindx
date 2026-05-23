/**
 * Icon Primitive Component
 * 
 * A wrapper for lucide-react icons with consistent sizing and accessibility.
 * Part of the base component library for the design system.
 * 
 * Requirements: 6.1, 18.1, 18.2, 18.8
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

const iconVariants = cva('shrink-0', {
  variants: {
    size: {
      xs: 'size-3',   // 12px
      sm: 'size-4',   // 16px
      md: 'size-5',   // 20px
      lg: 'size-6',   // 24px
      xl: 'size-8',   // 32px
      '2xl': 'size-12', // 48px
    },
  },
  defaultVariants: {
    size: 'md',
  },
})

export interface IconProps extends VariantProps<typeof iconVariants> {
  icon: LucideIcon
  className?: string
  'aria-label'?: string
}

/**
 * Icon component for displaying lucide-react icons with consistent sizing.
 * 
 * @example
 * ```tsx
 * import { Check } from 'lucide-react'
 * 
 * <Icon icon={Check} size="lg" aria-label="Hoàn thành" />
 * ```
 */
export function Icon({
  icon: IconComponent,
  size,
  className,
  'aria-label': ariaLabel,
  ...props
}: IconProps) {
  return (
    <IconComponent
      className={cn(iconVariants({ size }), className)}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      {...props}
    />
  )
}
