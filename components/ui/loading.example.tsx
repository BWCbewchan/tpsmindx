/**
 * Loading Components Examples
 * 
 * Demonstrates all loading states and patterns.
 */

import { LoadingSpinner } from './loading-spinner'
import { LoadingOverlay } from './loading-overlay'
import { 
  Skeleton, 
  SkeletonText, 
  SkeletonCard, 
  SkeletonAvatar, 
  SkeletonButton,
  SkeletonTable 
} from './skeleton'
import { Stack } from './primitives/stack'
import { Box } from './primitives/box'
import { Heading } from './primitives/heading'
import { Text } from './primitives/text'

export function LoadingExamples() {
  return (
    <div className="space-y-12 p-8">
      {/* Loading Spinner */}
      <section>
        <Heading level="h2" className="mb-4">
          Loading Spinner
        </Heading>
        
        <Stack gap="lg">
          {/* Sizes */}
          <Box>
            <Text size="sm" weight="semibold" className="mb-2">
              Kích thước
            </Text>
            <div className="flex items-center gap-4">
              <LoadingSpinner size="xs" />
              <LoadingSpinner size="sm" />
              <LoadingSpinner size="md" />
              <LoadingSpinner size="lg" />
              <LoadingSpinner size="xl" />
            </div>
          </Box>

          {/* Variants */}
          <Box>
            <Text size="sm" weight="semibold" className="mb-2">
              Variants
            </Text>
            <div className="flex items-center gap-4">
              <LoadingSpinner variant="default" />
              <LoadingSpinner variant="secondary" />
              <div className="bg-gray-900 p-4 rounded">
                <LoadingSpinner variant="white" />
              </div>
            </div>
          </Box>

          {/* With text */}
          <Box>
            <Text size="sm" weight="semibold" className="mb-2">
              Với text
            </Text>
            <Stack gap="sm">
              <LoadingSpinner size="sm">Đang tải...</LoadingSpinner>
              <LoadingSpinner size="md">Đang xử lý dữ liệu...</LoadingSpinner>
              <LoadingSpinner size="lg">Vui lòng đợi...</LoadingSpinner>
            </Stack>
          </Box>
        </Stack>
      </section>

      {/* Loading Overlay */}
      <section>
        <Heading level="h2" className="mb-4">
          Loading Overlay
        </Heading>
        
        <Stack gap="md">
          {/* Container loading */}
          <Box>
            <Text size="sm" weight="semibold" className="mb-2">
              Container loading
            </Text>
            <div className="relative h-48 border border-gray-200 rounded-lg">
              <div className="p-4">
                <Text>Nội dung bên dưới...</Text>
              </div>
              <LoadingOverlay container message="Đang tải dữ liệu..." />
            </div>
          </Box>

          {/* Note about full-page */}
          <Box className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <Text size="sm" color="muted">
              <strong>Full-page loading:</strong> Sử dụng{' '}
              <code className="bg-blue-100 px-1 rounded">
                &lt;LoadingOverlay /&gt;
              </code>{' '}
              không có prop <code className="bg-blue-100 px-1 rounded">container</code>
            </Text>
          </Box>
        </Stack>
      </section>

      {/* Skeleton */}
      <section>
        <Heading level="h2" className="mb-4">
          Skeleton Screens
        </Heading>
        
        <Stack gap="lg">
          {/* Basic skeleton */}
          <Box>
            <Text size="sm" weight="semibold" className="mb-2">
              Basic skeleton
            </Text>
            <Stack gap="sm">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </Stack>
          </Box>

          {/* Skeleton text */}
          <Box>
            <Text size="sm" weight="semibold" className="mb-2">
              Skeleton text
            </Text>
            <SkeletonText lines={4} />
          </Box>

          {/* Skeleton avatar */}
          <Box>
            <Text size="sm" weight="semibold" className="mb-2">
              Skeleton avatar
            </Text>
            <div className="flex items-center gap-4">
              <SkeletonAvatar size="sm" />
              <SkeletonAvatar size="md" />
              <SkeletonAvatar size="lg" />
            </div>
          </Box>

          {/* Skeleton button */}
          <Box>
            <Text size="sm" weight="semibold" className="mb-2">
              Skeleton button
            </Text>
            <div className="flex gap-2">
              <SkeletonButton />
              <SkeletonButton />
            </div>
          </Box>

          {/* Skeleton card */}
          <Box>
            <Text size="sm" weight="semibold" className="mb-2">
              Skeleton card
            </Text>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </Box>

          {/* Skeleton table */}
          <Box>
            <Text size="sm" weight="semibold" className="mb-2">
              Skeleton table
            </Text>
            <SkeletonTable rows={5} />
          </Box>
        </Stack>
      </section>

      {/* Usage patterns */}
      <section>
        <Heading level="h2" className="mb-4">
          Mẫu sử dụng
        </Heading>
        
        <Stack gap="md">
          <Box className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <Text size="sm" weight="semibold" className="mb-2">
              Khi nào dùng gì?
            </Text>
            <Stack gap="sm">
              <Text size="sm">
                <strong>LoadingSpinner:</strong> Inline loading, button loading, small sections
              </Text>
              <Text size="sm">
                <strong>LoadingOverlay:</strong> Full-page loading, modal loading, container loading
              </Text>
              <Text size="sm">
                <strong>Skeleton:</strong> Initial page load, list loading, card loading
              </Text>
            </Stack>
          </Box>
        </Stack>
      </section>
    </div>
  )
}
