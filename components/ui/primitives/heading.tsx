import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const headingVariants = cva('font-bold', {
  variants: {
    level: {
      h1: 'text-5xl',  // 61.04px (16 * 1.25^6)
      h2: 'text-4xl',  // 48.83px (16 * 1.25^5)
      h3: 'text-3xl',  // 39.06px (16 * 1.25^4)
      h4: 'text-2xl',  // 31.25px (16 * 1.25^3)
      h5: 'text-xl',   // 25px (16 * 1.25^2)
      h6: 'text-lg',   // 20px (16 * 1.25)
    },
  },
  defaultVariants: {
    level: 'h2',
  },
})

export interface HeadingProps
  extends Omit<React.ComponentProps<'h2'>, 'ref'>,
    VariantProps<typeof headingVariants> {
  asChild?: boolean
}

export function Heading({
  asChild = false,
  level = 'h2',
  className,
  ...props
}: HeadingProps) {
  const Comp = asChild ? Slot : level || 'h2'
  return (
    <Comp
      className={cn(headingVariants({ level }), className)}
      {...props}
    />
  )
}
