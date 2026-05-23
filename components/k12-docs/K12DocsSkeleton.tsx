export default function K12DocsSkeleton() {
  return (
    <div className="p-4">
      <div className="mb-6 border-b border-gray-200 pb-4 sm:pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="h-9 w-80 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-full animate-pulse rounded-md bg-gray-100 lg:w-80" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_220px]">
        <aside className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="mb-3 h-5 w-24 animate-pulse rounded bg-gray-200" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-8 animate-pulse rounded bg-gray-100"
                style={{ width: `${90 - index * 5}%` }}
              />
            ))}
          </div>
        </aside>

        <main className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 h-8 w-2/3 animate-pulse rounded bg-gray-200" />
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-10/12 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-9/12 animate-pulse rounded bg-gray-100" />
          </div>

          <div className="my-6 h-40 animate-pulse rounded-lg bg-gray-100" />

          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-9/12 animate-pulse rounded bg-gray-100" />
          </div>
        </main>

        <aside className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="mb-3 h-5 w-20 animate-pulse rounded bg-gray-200" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-6 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
