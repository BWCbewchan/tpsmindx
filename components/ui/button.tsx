/**
 * Button Component
 * 
 * Follows international design standards:
 * - Material Design 3 (Google)
 * - Apple Human Interface Guidelines
 * - WCAG 2.1 AA Accessibility
 * 
 * Button Hierarchy (International Standard):
 * 1. Primary (default) - Main action, high emphasis
 * 2. Secondary - Important but not primary
 * 3. Tertiary (outline) - Medium emphasis
 * 4. Text (ghost) - Low emphasis
 * 5. Destructive - Dangerous actions
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.12, 7.13, 7.14, 7.16, 7.18
 * 
 * @example
 * ```tsx
 * // Primary action (high emphasis)
 * <Button variant="default">Gửi</Button>
 * 
 * // Secondary action (medium emphasis)
 * <Button variant="secondary">Hủy</Button>
 * 
 * // Tertiary action (low emphasis)
 * <Button variant="outline">Xem thêm</Button>
 * 
 * // Text button (minimal emphasis)
 * <Button variant="ghost">Bỏ qua</Button>
 * 
 * // Destructive action
 * <Button variant="destructive">Xóa</Button>
 * 
 * // Button with loading state
 * <Button loading>Đang tải</Button>
 * 
 * // Button with icon (icon on left by default)
 * <Button>
 *   <Icon icon={Check} size="sm" />
 *   Lưu thay đổi
 * </Button>
 * 
 * // Directional button (icon on right)
 * <Button>
 *   Tiếp theo
 *   <Icon icon={ChevronRight} size="sm" />
 * </Button>
 * ```
 */

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
    // Base styles following Material Design 3 & Apple HIG
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                // Primary - Filled button (Material Design: Filled, Apple: Filled)
                // High emphasis, main action
                default: 'bg-primary text-white shadow hover:bg-primary/90',
                
                // Destructive - Filled destructive (Material Design: Filled, Apple: Destructive)
                // High emphasis, dangerous action
                destructive: 'bg-destructive text-white shadow-sm hover:bg-destructive/90',
                
                // Tertiary - Outlined button (Material Design: Outlined, Apple: Bordered)
                // Medium emphasis, secondary action
                // Border màu nhạt (gray-200) thay vì đậm
                outline: 'border border-gray-200 bg-background hover:bg-accent hover:text-accent-foreground hover:border-gray-300',
                
                // Secondary - Tonal button (Material Design: Tonal, Apple: Gray)
                // Medium emphasis, alternative action
                secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                
                // Text button - Ghost (Material Design: Text, Apple: Plain)
                // Low emphasis, tertiary action
                ghost: 'hover:bg-accent hover:text-accent-foreground',
                
                // Link - Text link style
                // Minimal emphasis, navigation
                link: 'text-primary underline-offset-4 hover:underline',
                
                // Success - Positive action
                success: 'bg-green-600 text-white shadow-sm hover:bg-green-700',
                
                // Brand - MindX brand button
                // Special emphasis for brand actions
                mindx: 'bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white hover:from-[#8a0019] hover:to-[#a1001f] shadow-md hover:shadow-lg',
            },
            size: {
                // Sizes following Material Design density scale
                xs: 'h-7 px-2.5 text-xs rounded-md',      // Compact
                sm: 'h-8 px-3 text-sm rounded-md',        // Small
                default: 'h-9 px-4 py-2 text-sm',         // Medium (default)
                lg: 'h-10 px-6 text-base',                // Large
                xl: 'h-11 px-8 text-base',                // Extra large
                icon: 'size-9',                            // Icon only
                'icon-sm': 'size-8',                       // Small icon
                'icon-lg': 'size-10',                      // Large icon
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
)

export interface ButtonProps
    extends React.ComponentProps<'button'>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean
    loading?: boolean
}

function Button({
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    children,
    disabled,
    ...props
}: ButtonProps) {
    const Comp = asChild ? Slot : 'button'

    // When using asChild, we can't add loading spinner as it would create multiple children
    // The parent should handle loading state
    if (asChild) {
        return (
            <Comp
                data-slot="button"
                className={cn(buttonVariants({ variant, size }), className)}
                {...props}
            >
                {children}
            </Comp>
        )
    }

    return (
        <Comp
            data-slot="button"
            className={cn(buttonVariants({ variant, size }), className)}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <svg
                    className="animate-spin size-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            )}
            {children}
        </Comp>
    )
}

export { Button, buttonVariants }
