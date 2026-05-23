/**
 * Card Component
 * 
 * A refactored card component built by composing Box and Stack primitives.
 * Follows the design system's composition-first approach.
 * 
 * Features:
 * - Composition pattern (CardHeader, CardTitle, CardContent, CardFooter)
 * - Multiple variants (default, outlined, elevated, interactive)
 * - Responsive padding options
 * - Backward compatible with legacy Card API
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 * 
 * @example
 * ```tsx
 * // Composition pattern (recommended)
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Tiêu đề</CardTitle>
 *     <CardDescription>Mô tả ngắn gọn</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     Nội dung chính của card
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Hành động</Button>
 *   </CardFooter>
 * </Card>
 * 
 * // Legacy API (backward compatible)
 * <Card title="Tiêu đề" hover padding="lg">
 *   Nội dung
 * </Card>
 * 
 * // Interactive card with variant
 * <Card variant="interactive" padding="lg">
 *   <CardContent>Nhấp vào card này</CardContent>
 * </Card>
 * 
 * // Elevated card
 * <Card variant="elevated">
 *   <CardContent>Card nổi bật</CardContent>
 * </Card>
 * ```
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Box } from './primitives/box'
import { Stack } from './primitives/stack'

const cardVariants = cva(
    'rounded-xl border border-border bg-card text-card-foreground',
    {
        variants: {
            variant: {
                default: 'shadow-sm',
                outlined: 'border-2 border-border',
                elevated: 'shadow-lg',
                interactive: 'hover:shadow-md transition-shadow cursor-pointer',
            },
            padding: {
                none: '',
                sm: 'p-3 lg:p-4',
                md: 'p-4 lg:p-6',
                lg: 'p-6 lg:p-8',
            },
        },
        defaultVariants: {
            variant: 'default',
            padding: 'md',
        },
    }
)

export interface CardProps
    extends React.ComponentProps<'div'>,
        VariantProps<typeof cardVariants> {
    /** Legacy API: Card title (use CardHeader + CardTitle instead) */
    title?: string
    /** Legacy API: Enable hover effect (use variant="interactive" instead) */
    hover?: boolean
}

function Card({ variant, padding, className, title, hover, children, ...props }: CardProps) {
    // Legacy API: If hover prop is used, override variant
    const effectiveVariant = hover ? 'interactive' : variant
    
    // Legacy API: If title is provided, wrap children with title header
    if (title) {
        return (
            <Box
                data-slot="card"
                className={cn(cardVariants({ variant: effectiveVariant, padding }), className)}
                {...props}
            >
                <h3 className="mb-4 border-b border-border pb-3 text-lg font-bold text-foreground lg:text-xl">
                    {title}
                </h3>
                {children}
            </Box>
        )
    }
    
    // New API: Standard composition pattern
    return (
        <Box
            data-slot="card"
            className={cn(cardVariants({ variant: effectiveVariant, padding }), className)}
            {...props}
        >
            {children}
        </Box>
    )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <Stack
            data-slot="card-header"
            gap="sm"
            className={cn('pb-4', className)}
            {...props}
        />
    )
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
    return (
        <h3
            data-slot="card-title"
            className={cn('text-xl font-semibold leading-none', className)}
            {...props}
        />
    )
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
    return (
        <p
            data-slot="card-description"
            className={cn('text-sm text-muted-foreground', className)}
            {...props}
        />
    )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <Box
            data-slot="card-content"
            className={cn('', className)}
            {...props}
        />
    )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <Box
            data-slot="card-footer"
            className={cn('flex items-center pt-4', className)}
            {...props}
        />
    )
}

export {
    Card,
    CardHeader,
    CardFooter,
    CardTitle,
    CardDescription,
    CardContent,
}
