"use client"

/**
 * Popover Component
 * 
 * Floating content component following international standards:
 * - Material Design 3 Menu/Tooltip
 * - Apple HIG Popovers
 * - WCAG 2.1 AA Accessibility
 * 
 * Built with Radix UI primitives and base Box component for consistency.
 * 
 * Z-Index: 1500 (z-popover) - Above modals
 * 
 * @example
 * ```tsx
 * <Popover>
 *   <PopoverTrigger asChild>
 *     <Button variant="outline">Mở menu</Button>
 *   </PopoverTrigger>
 *   <PopoverContent>
 *     <Stack gap="sm">
 *       <Text weight="semibold">Tùy chọn</Text>
 *       <Button variant="ghost" size="sm">Chỉnh sửa</Button>
 *       <Button variant="ghost" size="sm">Xóa</Button>
 *     </Stack>
 *   </PopoverContent>
 * </Popover>
 * ```
 */

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import { Box } from "./primitives/box"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 8, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        // Z-index: 1500 (above modals)
        "z-[1500]",
        // Base styles using Box component patterns
        "w-72 rounded-lg border border-gray-200 bg-white shadow-lg",
        // Animations - Material Design inspired
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        // Slide animations based on side
        "data-[side=bottom]:slide-in-from-top-2",
        "data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2",
        "data-[side=top]:slide-in-from-bottom-2",
        // Focus styles
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

const PopoverHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <Box
    className={cn(
      "px-4 pt-4 pb-2 border-b border-gray-100",
      className
    )}
    {...props}
  />
)
PopoverHeader.displayName = "PopoverHeader"

const PopoverBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <Box
    className={cn("p-4", className)}
    {...props}
  />
)
PopoverBody.displayName = "PopoverBody"

const PopoverFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <Box
    className={cn(
      "px-4 pb-4 pt-2 border-t border-gray-100",
      className
    )}
    {...props}
  />
)
PopoverFooter.displayName = "PopoverFooter"

export { 
  Popover, 
  PopoverTrigger, 
  PopoverContent, 
  PopoverAnchor,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
}
