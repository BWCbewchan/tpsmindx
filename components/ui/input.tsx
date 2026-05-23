/**
 * Input Component
 * 
 * Refactored to use the base Input primitive from the design system.
 * Maintains backward compatibility while following design system standards.
 * 
 * Requirements: 8.1, 8.8
 */

import * as React from 'react'
import { Input as InputPrimitive } from './primitives/input'

/**
 * Input component for form fields.
 * Now uses the base Input primitive for consistency.
 * 
 * @example
 * ```tsx
 * <Input type="email" placeholder="nhập email của bạn" />
 * <Input type="password" error />
 * <Input disabled />
 * ```
 */
const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof InputPrimitive>
>((props, ref) => {
  return <InputPrimitive ref={ref} {...props} />
})

Input.displayName = 'Input'

export { Input }
