'use client'

import UserFeedbackManagePanel from '@/components/feedback/UserFeedbackManagePanel'
import { PageHeader } from '@/components/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { RefreshCcw } from 'lucide-react'
import { useState } from 'react'

export default function QuanLyPhanHoiPage() {
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  return (
    <PageLayout>
      <PageLayoutContent spacing="lg">
        <PageHeader
          title="Trung Tâm Phản Hồi"
          description="Theo dõi toàn bộ ý kiến phản hồi bạn đã gửi và tiến trình xử lý"
          actions={
            <button
              type="button"
              onClick={() => setRefreshSignal((prev) => prev + 1)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#f3b4bd] bg-white px-4 text-sm font-medium text-[#a1001f] shadow-sm hover:bg-[#a1001f]/5"
            >
              <RefreshCcw className="mr-1.5 h-4 w-4" />
              Làm mới
            </button>
          }
        />

        {isInitialLoading && (
          <PageSkeleton variant="default" itemCount={6} showHeader={false} />
        )}

        <div className={isInitialLoading ? 'hidden' : ''}>
          <UserFeedbackManagePanel
            showInlineRefresh={false}
            externalRefreshSignal={refreshSignal}
            onInitialLoadComplete={() => {
              console.log('[QuanLyPhanHoi] Initial load complete callback called')
              setIsInitialLoading(false)
            }}
          />
        </div>
      </PageLayoutContent>
    </PageLayout>
  )
}
