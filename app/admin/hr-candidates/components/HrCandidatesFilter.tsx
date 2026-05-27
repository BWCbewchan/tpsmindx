import { Search, RefreshCw } from 'lucide-react'

interface HrCandidatesFilterProps {
  searchInput: string
  setSearchInput: (val: string) => void
  statusFilter: string
  setStatusFilter: (val: string) => void
  genFilter: string
  setGenFilter: (val: string) => void
  availableGens: string[]
  refreshing: boolean
  onRefresh: () => void
}

export default function HrCandidatesFilter({
  searchInput, setSearchInput,
  statusFilter, setStatusFilter,
  genFilter, setGenFilter,
  availableGens, refreshing, onRefresh,
}: HrCandidatesFilterProps) {
  return (
    <div className="border-b border-gray-200 bg-gray-50/30 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-full lg:max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên, email, SĐT..."
            className="block w-full rounded-xl border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="cursor-pointer rounded-xl border-gray-300 py-2.5 pl-3.5 pr-8 text-sm font-medium text-gray-700 shadow-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 hover:bg-gray-50">
            <option value="all">Tất cả trạng thái</option>
            <option value="unassigned">Chưa có GEN</option>
            <option value="assigned">Đã có GEN</option>
            <option value="new">Mới</option>
            <option value="in_training">Đang đào tạo</option>
            <option value="passed">Đạt</option>
            <option value="failed">Không đạt</option>
            <option value="dropped">Bỏ học</option>
          </select>

          <select value={genFilter} onChange={(e) => setGenFilter(e.target.value)}
            className="cursor-pointer rounded-xl border-gray-300 py-2.5 pl-3.5 pr-8 text-sm font-medium text-gray-700 shadow-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 hover:bg-gray-50"
            style={{ maxWidth: '160px' }}>
            <option value="all">Lọc theo GEN</option>
            <option value="__unassigned__">-- Chưa có GEN --</option>
            {availableGens.map((gen) => (
              <option key={gen} value={gen}>{gen}</option>
            ))}
          </select>

          <button onClick={onRefresh} disabled={refreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#f3b4bd] bg-white px-4 text-sm font-semibold text-[#a1001f] shadow-sm hover:bg-[#a1001f]/5 active:scale-95 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>
    </div>
  )
}
