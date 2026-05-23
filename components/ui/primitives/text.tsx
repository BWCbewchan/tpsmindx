import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const textVariants = cva('', {
  variants: {
    size: {
      xs: 'text-xs',      // 10.24px (16 / 1.25^2)
      sm: 'text-sm',      // 12.8px (16 / 1.25)
      base: 'text-base',  // 16px
      lg: 'text-lg',      // 20px (16 * 1.25)
      xl: 'text-xl',      // 25px (16 * 1.25^2)
    },
    weight: {
      light: 'font-light',
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    color: {
      primary: 'text-foreground',
      secondary: 'text-muted-foreground',
      muted: 'text-muted-foreground/60',
      disabled: 'text-muted-foreground/40',
      error: 'text-destructive',
      success: 'text-success',
      warning: 'text-warning',
      info: 'text-info',
    },
  },
  defaultVariants: {
    size: 'base',
    weight: 'normal',
    color: 'primary',
  },
})

export interface TextProps
  extends Omit<React.ComponentProps<'span'>, 'color'>,
    VariantProps<typeof textVariants> {
  asChild?: boolean
}

export const Text = React.forwardRef<HTMLSpanElement, TextProps>(
  ({ asChild = false, size, weight, color, className, ...props }, ref) => {
    const Comp = asChild ? Slot : 'span'
    return (
      <Comp
        ref={ref}
        className={cn(textVariants({ size, weight, color }), className)}
        {...props}
      />
    )
  }
)

Text.displayName = 'Text'
