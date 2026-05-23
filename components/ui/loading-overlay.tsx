/**
 * Loading Overlay Component
 * 
 * Full-page or container loading overlay following international standards:
 * - Material Design 3 Progress Indicators
 * - Apple HIG Activity Indicators
 * 
 * Z-Index: 1600 (z-tooltip) - Above all content
 * 
 * @example
 * ```tsx
 * // Full-page loading
 * <LoadingOverlay />
 * 
 * // With message
 * <LoadingOverlay message="Đang tải dữ liệu..." />
 * 
 * // Container loading (relative to parent)
 * <div className="relative">
 *   <LoadingOverlay container />
 *   <YourContent />
 * </div>
 * ```
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Box } from './primitives/box'
import { Stack } from './primitives/stack'
import { Text } from './primitives/text'
import { LoadingSpinner } from './loading-spinner'

export interface LoadingOverlayProps {
  message?: string
  container?: boolean
  className?: string
}

export function LoadingOverlay({
  message = 'Đang tải...',
  container = false,
  className,
}: LoadingOverlayProps) {
  return (
    <Box
      className={cn(
        'flex items-center justify-center bg-white/80 backdrop-blur-sm',
        container ? 'absolute inset-0 z-10' : 'fixed inset-0 z-[1600]',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Stack gap="md" align="center" className="text-center">
        <LoadingSpinner size="lg" />
        {message && (
          <Text size="sm" color="muted" weight="medium">
            {message}
          </Text>
        )}
      </Stack>
    </Box>
  )
}
