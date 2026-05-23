/**
 * FormField Composite Component
 * 
 * A composite form field component built by composing Stack, Text, and Input primitives.
 * Follows the design system's composition-first approach.
 * 
 * Requirements: 8.5, 8.6, 13.6, 13.7, 13.9, 13.10, 14.3
 * 
 * @example
 * ```tsx
 * // Basic form field
 * <FormField label="Địa chỉ email">
 *   <Input type="email" placeholder="nhập email của bạn" />
 * </FormField>
 * 
 * // Required field with error
 * <FormField 
 *   label="Mật khẩu" 
 *   required 
 *   error="Mật khẩu phải có ít nhất 8 ký tự"
 * >
 *   <Input type="password" error />
 * </FormField>
 * 
 * // With helper text
 * <FormField 
 *   label="Số điện thoại" 
 *   helperText="Chúng tôi sẽ không chia sẻ số điện thoại của bạn"
 * >
 *   <Input type="tel" placeholder="nhập số điện thoại" />
 * </FormField>
 * ```
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Stack } from './primitives/stack'
import { Text } from './primitives/text'
import { AlertCircle } from 'lucide-react'

export interface FormFieldProps {
  label: string
  error?: string
  helperText?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * FormField component for consistent form field layout with label, input, and messages.
 */
export function FormField({
  label,
  error,
  helperText,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <Stack gap="xs" className={className}>
      <label className="flex items-center gap-1 text-sm font-medium">
        {label}
        {required && (
          <span 
            className="text-red-500 text-base ml-1" 
            aria-label="bắt buộc"
          >
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <Text 
          size="sm" 
          color="error" 
          className="flex items-center gap-1 mt-1"
        >
          <AlertCircle className="size-4" />
          {error}
        </Text>
      )}
      {helperText && !error && (
        <Text size="sm" color="secondary" className="mt-1">
          {helperText}
        </Text>
      )}
    </Stack>
  )
}
