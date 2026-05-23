import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const flexVariants = cva('flex', {
  variants: {
    gap: {
      none: 'gap-0',
      xs: 'gap-1',    // 4px
      sm: 'gap-2',    // 8px
      md: 'gap-4',    // 16px
      lg: 'gap-6',    // 24px
      xl: 'gap-8',    // 32px
    },
    align: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
      baseline: 'items-baseline',
    },
    justify: {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
      evenly: 'justify-evenly',
    },
    wrap: {
      nowrap: 'flex-nowrap',
      wrap: 'flex-wrap',
      'wrap-reverse': 'flex-wrap-reverse',
    },
  },
  defaultVariants: {
    gap: 'md',
    align: 'center',
    justify: 'start',
    wrap: 'nowrap',
  },
})

export interface FlexProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof flexVariants> {}

export function Flex({
  gap,
  align,
  justify,
  wrap,
  className,
  ...props
}: FlexProps) {
  return (
    <div
      className={cn(flexVariants({ gap, align, justify, wrap }), className)}
      {...props}
    />
  )
}
