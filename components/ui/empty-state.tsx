/**
 * Empty State Component
 * 
 * Empty state component following international standards:
 * - Material Design 3 Empty States
 * - Apple HIG Empty States
 * 
 * @example
 * ```tsx
 * // Basic empty state
 * <EmptyState
 *   icon={Inbox}
 *   title="Không có dữ liệu"
 *   description="Chưa có mục nào được tạo"
 * />
 * 
 * // With action button
 * <EmptyState
 *   icon={FileText}
 *   title="Không tìm thấy bài viết"
 *   description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
 *   action={
 *     <Button onClick={handleReset}>Đặt lại bộ lọc</Button>
 *   }
 * />
 * 
 * // Custom illustration
 * <EmptyState
 *   illustration={<img src="/empty.svg" alt="" />}
 *   title="Danh sách trống"
 *   description="Bắt đầu bằng cách thêm mục đầu tiên"
 * />
 * ```
 */

import * as React from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Box } from './primitives/box'
import { Stack } from './primitives/stack'
import { Heading } from './primitives/heading'
import { Text } from './primitives/text'
import { Icon } from './primitives/icon'

export interface EmptyStateProps {
  icon?: LucideIcon
  illustration?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Box
      className={cn(
        'flex items-center justify-center py-12 px-4',
        className,
      )}
    >
      <Stack gap="lg" align="center" className="max-w-md text-center">
        {/* Icon or Illustration */}
        {illustration ? (
          <Box className="w-48 h-48 flex items-center justify-center">
            {illustration}
          </Box>
        ) : icon ? (
          <Box className="flex items-center justify-center size-16 rounded-full bg-gray-100">
            <Icon icon={icon} size="xl" className="text-gray-400" />
          </Box>
        ) : null}

        {/* Content */}
        <Stack gap="sm" align="center">
          <Heading level="h3" className="text-gray-900">
            {title}
          </Heading>
          {description && (
            <Text size="sm" color="muted" className="max-w-sm">
              {description}
            </Text>
          )}
        </Stack>

        {/* Action */}
        {action && <Box className="mt-2">{action}</Box>}
      </Stack>
    </Box>
  )
}

// Pre-built empty state variants
export function EmptyStateNoResults() {
  return (
    <EmptyState
      title="Không tìm thấy kết quả"
      description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
    />
  )
}

export function EmptyStateNoData() {
  return (
    <EmptyState
      title="Không có dữ liệu"
      description="Chưa có mục nào được tạo"
    />
  )
}

export function EmptyStateError() {
  return (
    <EmptyState
      title="Có lỗi xảy ra"
      description="Không thể tải dữ liệu. Vui lòng thử lại sau"
    />
  )
}
