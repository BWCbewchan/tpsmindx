'use client'

interface TopPage {
  page: string
  views: number
  percentage: number
}

interface TopPagesTableProps {
  pages: TopPage[]
}

export function TopPagesTable({ pages }: TopPagesTableProps) {
  const visiblePages = pages.slice(0, 5)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm max-sm:p-4">
      <h3 className="mb-4 text-sm font-semibold text-gray-800">
        Trang được truy cập nhiều nhất
      </h3>

      {visiblePages.length === 0 ? (
        <div className="flex h-45 items-center justify-center text-sm text-gray-400">
          Chưa có dữ liệu
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-100 max-sm:overflow-x-auto">
          <table className="w-full text-left max-sm:min-w-130">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Trang
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  Lượt xem
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right w-28">
                  Tỷ lệ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visiblePages.map((page, idx) => (
                <tr
                  key={page.page}
                  className="transition-colors duration-150 hover:bg-gray-50/60"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-100 text-[10px] font-bold text-gray-500">
                        {idx + 1}
                      </span>
                      <span className="max-w-50 truncate text-xs font-medium text-gray-700">
                        {page.page}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-gray-900 text-right tabular-nums">
                    {page.views.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#a1001f] transition-all duration-500"
                          style={{
                            width: `${Math.min(page.percentage, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-gray-500 tabular-nums w-10 text-right">
                        {page.percentage}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
