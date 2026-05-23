/**
 * Input Primitive Component
 * 
 * A base input component with consistent styling and states.
 * Part of the base component library for the design system.
 * 
 * Requirements: 6.1, 8.1, 8.2, 8.3, 8.4, 8.7, 8.9
 * 
 * @example
 * ```tsx
 * // Basic input
 * <Input type="email" placeholder="nhập email của bạn" />
 * 
 * // Input with error state
 * <Input error placeholder="nhập mật khẩu" />
 * 
 * // Different sizes
 * <Input size="sm" placeholder="nhỏ" />
 * <Input size="md" placeholder="trung bình" />
 * <Input size="lg" placeholder="lớn" />
 * 
 * // Disabled input
 * <Input disabled placeholder="vô hiệu hóa" />
 * ```
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const inputVariants = cva(
  'w-full rounded-md border bg-background px-3 text-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'h-8 text-xs',      // 32px
        md: 'h-9 text-sm',      // 36px
        lg: 'h-10 text-base',   // 40px
      },
      state: {
        default: 'border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        error: 'border-red-500 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
        readonly: 'bg-muted cursor-default',
      },
    },
    defaultVariants: {
      size: 'md',
      state: 'default',
    },
  }
)

export interface InputProps
  extends Omit<React.ComponentProps<'input'>, 'size'>,
    VariantProps<typeof inputVariants> {
  error?: boolean
}

/**
 * Input component for form fields with consistent styling.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, state, error, readOnly, disabled, ...props }, ref) => {
    // Determine the state based on props
    const inputState = error ? 'error' : readOnly ? 'readonly' : state || 'default'

    return (
      <input
        ref={ref}
        className={cn(inputVariants({ size, state: inputState }), className)}
        disabled={disabled}
        readOnly={readOnly}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'
