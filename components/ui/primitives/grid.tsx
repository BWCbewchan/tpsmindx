/**
 * Grid Primitive Component
 * 
 * A primitive grid layout component with consistent gap and column variants.
 * Part of the base component library for the design system.
 * 
 * Requirements: 6.1, 6.7, 3.1, 3.5
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const gridVariants = cva('grid', {
  variants: {
    cols: {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      6: 'grid-cols-6',
      12: 'grid-cols-12',
    },
    gap: {
      none: 'gap-0',
      xs: 'gap-1',    // 4px
      sm: 'gap-2',    // 8px
      md: 'gap-4',    // 16px
      lg: 'gap-6',    // 24px
      xl: 'gap-8',    // 32px
    },
  },
  defaultVariants: {
    cols: 1,
    gap: 'md',
  },
})

export interface GridProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof gridVariants> {}

/**
 * Grid component for creating grid layouts with consistent spacing.
 * 
 * @example
 * ```tsx
 * <Grid cols={3} gap="lg">
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </Grid>
 * ```
 */
export function Grid({ cols, gap, className, ...props }: GridProps) {
  return (
    <div className={cn(gridVariants({ cols, gap }), className)} {...props} />
  )
}
