'use client'

import { PageHeader } from '@/components/PageHeader'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'

interface PageContainerProps {
  children: React.ReactNode
  title?: string
  description?: string
  headerActions?: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

function PageContainer({
  children,
  title,
  description,
  headerActions,
  maxWidth = 'full',
  className = '',
  padding = 'md',
}: PageContainerProps) {
  // Map PageContainer maxWidth to PageLayout maxWidth
  const pageLayoutMaxWidth = {
    sm: '3xl' as const,
    md: '4xl' as const,
    lg: '5xl' as const,
    xl: '6xl' as const,
    '2xl': '7xl' as const,
    full: '7xl' as const,
  }[maxWidth]

  // Map PageContainer padding to PageLayout padding
  const pageLayoutPadding = {
    none: 'none' as const,
    sm: 'sm' as const,
    md: 'md' as const,
    lg: 'lg' as const,
  }[padding]

  return (
    <PageLayout 
      maxWidth={pageLayoutMaxWidth} 
      padding={pageLayoutPadding}
      className={className}
    >
      <PageLayoutContent spacing="lg">
        {/* Page Header */}
        {(title || description) && (
          <PageHeader
            title={title || ''}
            description={description}
            actions={headerActions}
          />
        )}
        {/* Page Content */}
        {children}
      </PageLayoutContent>
    </PageLayout>
  )
}

export { PageContainer }
export { PageContainer as sPageContainer }
