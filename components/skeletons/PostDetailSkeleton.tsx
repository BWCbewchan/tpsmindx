import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'

export function PostDetailSkeleton() {
  return (
    <PageLayout maxWidth="7xl" padding="md">
      <PageLayoutContent spacing="md">
        {/* Back Button Skeleton */}
        <div className="pb-2">
          <div className="h-9 bg-gray-200 rounded w-24"></div>
        </div>

        {/* Banner Image Skeleton */}
        <div className="relative w-full rounded-xl overflow-hidden mb-5 shadow-lg" style={{ height: 'clamp(200px, 40vw, calc(var(--spacing) * 130))' }}>
          <div className="w-full h-full bg-gray-200"></div>
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="h-6 bg-gray-300 rounded-full w-24 mb-3"></div>
            <div className="h-8 bg-gray-300 rounded w-3/4"></div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Main Content Column */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-visible">
              {/* Meta Info Bar */}
              <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="h-4 bg-gray-200 rounded w-40"></div>
                  <div className="flex gap-4">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-8 bg-gray-200 rounded-full w-20"></div>
                  </div>
                </div>
              </div>

              {/* Article Content */}
              <div className="p-5">
                {/* Description */}
                <div className="mb-5 border-b border-gray-200 pb-5">
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                </div>

                {/* Content Lines */}
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-2">
                      <div className="h-10 bg-gray-200 rounded-xl w-24"></div>
                      <div className="h-10 bg-gray-200 rounded-xl w-24"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="p-4 space-y-3">
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          </aside>
        </div>

        {/* Comments Skeleton */}
        <div className="mt-5">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-4/5"></div>
            </div>
          </div>
        </div>

        {/* Related Posts Skeleton */}
        <section className="mt-5">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="w-full h-40 bg-gray-200"></div>
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </PageLayoutContent>
    </PageLayout>
  );
}
