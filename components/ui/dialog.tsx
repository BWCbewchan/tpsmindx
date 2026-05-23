'use client'

/**
 * Dialog Component
 * 
 * Modal dialog component following international standards:
 * - Material Design 3 Dialog
 * - Apple HIG Sheets/Alerts
 * - WCAG 2.1 AA Accessibility
 * 
 * Built with base components (Box, Stack, Heading, Text) for consistency.
 * 
 * Z-Index Scale:
 * - Backdrop: 1300 (z-modal-backdrop)
 * - Content: 1400 (z-modal)
 * 
 * @example
 * ```tsx
 * <Dialog open={isOpen} onOpenChange={setIsOpen}>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Xác nhận xóa</DialogTitle>
 *       <DialogDescription>
 *         Bạn có chắc chắn muốn xóa mục này không?
 *       </DialogDescription>
 *     </DialogHeader>
 *     <DialogFooter>
 *       <Button variant="outline" onClick={() => setIsOpen(false)}>
 *         Hủy
 *       </Button>
 *       <Button variant="destructive" onClick={handleDelete}>
 *         Xóa
 *       </Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 * ```
 */

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Box } from './primitives/box'
import { Stack } from './primitives/stack'
import { Heading } from './primitives/heading'
import { Text, type TextProps } from './primitives/text'

const Dialog = ({
    open,
    onOpenChange,
    children,
}: {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
}) => {
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    // Lock body scroll when dialog is open
    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [open])

    // Close on Escape key
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && open) {
                onOpenChange?.(false)
            }
        }
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [open, onOpenChange])

    if (!open || !mounted) return null

    return createPortal(
        <Box className="fixed inset-0 z-[1300] flex items-center justify-center">
            {/* Backdrop - z-index: 1300 */}
            <Box
                className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
                onClick={() => onOpenChange?.(false)}
                aria-hidden="true"
            />
            
            {/* Content Container - z-index: 1400 */}
            <Box className="relative z-[1400] w-full max-w-lg p-4 sm:p-0 flex items-center justify-center">
                {children}
            </Box>
        </Box>,
        document.body
    )
}

const DialogContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
    <Box
        ref={ref}
        className={cn(
            "w-full bg-background border border-gray-200 shadow-xl rounded-lg",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-200",
            className
        )}
        {...props}
    >
        {children}
    </Box>
))
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <Stack
        gap="sm"
        className={cn(
            "px-6 pt-6 pb-4 border-b border-gray-100",
            className
        )}
        {...props}
    />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <Box
        className={cn(
            "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 bg-gray-50 rounded-b-lg border-t border-gray-100",
            className
        )}
        {...props}
    />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
    HTMLHeadingElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h2
        ref={ref}
        className={cn("text-lg font-semibold text-gray-900", className)}
        {...props}
    />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
    return (
        <Text
            size="sm"
            color={'muted' satisfies NonNullable<TextProps['color']> as any}
            ref={ref}
            className={className}
            {...props}
        />
    )
})
DialogDescription.displayName = "DialogDescription"

const DialogBody = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <Box
        className={cn("px-6 py-4", className)}
        {...props}
    />
)
DialogBody.displayName = "DialogBody"

export {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
    DialogBody,
}
