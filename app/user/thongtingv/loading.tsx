export default function LoadingThongTinGiaoVien() {
  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6">
      <div className="space-y-3 sm:space-y-4">
        <div className="border-b border-gray-200 pb-2 sm:pb-3">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-100" />
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200">
          <div className="bg-[#a1001f] p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 animate-pulse rounded-full bg-white/20" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 animate-pulse rounded bg-white/25" />
                <div className="h-3 w-24 animate-pulse rounded bg-white/20" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-white/20" />
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-gray-100 bg-white p-3">
                  <div className="mb-2 h-3 w-24 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-3">
              <div className="mb-3 h-4 w-36 animate-pulse rounded bg-gray-200" />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-4 w-full animate-pulse rounded bg-gray-100" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index}>
                <div className="mb-2 h-3 w-16 animate-pulse rounded bg-gray-200" />
                <div className="h-10 animate-pulse rounded bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
