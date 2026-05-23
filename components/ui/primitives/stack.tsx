import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const stackVariants = cva('flex flex-col', {
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
    },
  },
  defaultVariants: {
    gap: 'md',
    align: 'stretch',
  },
})

export interface StackProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stackVariants> {}

export function Stack({ gap, align, className, ...props }: StackProps) {
  return (
    <div
      className={cn(stackVariants({ gap, align }), className)}
      {...props}
    />
  )
}
