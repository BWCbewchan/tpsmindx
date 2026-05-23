import { Search } from 'lucide-react'

interface HrCandidatesFilterProps {
  searchInput: string
  setSearchInput: (val: string) => void
  statusFilter: string
  setStatusFilter: (val: string) => void
  genFilter: string
  setGenFilter: (val: string) => void
  regionFilter: string
  setRegionFilter: (val: string) => void
  campusFilter: string
  setCampusFilter: (val: string) => void
  availableGens: string[]
  availableCampuses: string[]
}

export default function HrCandidatesFilter({
  searchInput, setSearchInput,
  statusFilter, setStatusFilter,
  genFilter, setGenFilter,
  regionFilter, setRegionFilter,
  campusFilter, setCampusFilter,
  availableGens, availableCampuses,
}: HrCandidatesFilterProps) {
  return (
    <div className="border-b border-gray-200 bg-gray-50/30 px-4 py-4 sm:px-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.2fr)_minmax(170px,0.8fr)_minmax(150px,0.7fr)_minmax(170px,0.75fr)_minmax(210px,1fr)] xl:items-center">
        {/* Search */}
        <div className="relative min-w-0">
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
        <div className="grid gap-3 md:contents">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 w-full cursor-pointer rounded-xl border-gray-300 bg-white py-2.5 pl-3.5 pr-8 text-sm font-medium text-gray-700 shadow-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 hover:bg-gray-50">
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
            className="h-11 w-full cursor-pointer rounded-xl border-gray-300 bg-white py-2.5 pl-3.5 pr-8 text-sm font-medium text-gray-700 shadow-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 hover:bg-gray-50">
            <option value="all">Lọc theo GEN</option>
            <option value="__unassigned__">-- Chưa có GEN --</option>
            {availableGens.map((gen) => (
              <option key={gen} value={gen}>{gen}</option>
            ))}
          </select>

          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}
            className="h-11 w-full cursor-pointer rounded-xl border-gray-300 bg-white py-2.5 pl-3.5 pr-8 text-sm font-medium text-gray-700 shadow-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 hover:bg-gray-50">
            <option value="all">Tất cả khu vực</option>
            <option value="north">Miền Bắc</option>
            <option value="south">Miền Nam</option>
            <option value="1">Vùng 1 (HCM)</option>
            <option value="2">Vùng 2 (HN)</option>
            <option value="3">Vùng 3 (ĐN)</option>
          </select>

          <select value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)}
            className="h-11 w-full cursor-pointer rounded-xl border-gray-300 bg-white py-2.5 pl-3.5 pr-8 text-sm font-medium text-gray-700 shadow-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 hover:bg-gray-50">
            <option value="all">Tất cả cơ sở</option>
            {availableCampuses.map((campus) => (
              <option key={campus} value={campus}>{campus}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
