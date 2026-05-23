/**
 * Textarea Component
 * 
 * Refactored to follow the base Input primitive patterns from the design system.
 * Maintains consistent styling with Input component.
 * 
 * Requirements: 8.1, 8.8
 */

import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

/**
 * Textarea component for multi-line text input.
 * Follows the same styling patterns as the Input primitive.
 * 
 * @example
 * ```tsx
 * <Textarea placeholder="nhập tin nhắn của bạn" />
 * <Textarea error placeholder="có lỗi" />
 * <Textarea disabled />
 * ```
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-y",
          error
            ? "border-red-500 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            : "border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
