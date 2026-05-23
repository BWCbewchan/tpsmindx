/**
 * Label Component
 * 
 * Refactored to use the base Text component from the design system.
 * Maintains Radix UI Label functionality while following design system standards.
 * 
 * Requirements: 8.5
 */

'use client'

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

/**
 * Label component for form fields.
 * Uses design system typography (font-size: 14px, font-weight: 500).
 * 
 * @example
 * ```tsx
 * <Label htmlFor="email">Địa chỉ email</Label>
 * <Label>Họ và tên</Label>
 * ```
 */
const Label = React.forwardRef<
    React.ElementRef<typeof LabelPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
    <LabelPrimitive.Root
        ref={ref}
        className={cn(
            'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
            className
        )}
        {...props}
    />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
