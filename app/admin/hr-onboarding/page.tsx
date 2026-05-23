'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageContainer } from '@/components/PageContainer'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { toast } from '@/lib/app-toast'
import { Users, UserCheck, UserX, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface GenSummary {
  gen_id: number
  gen_name: string
  total: number
  new: number
  in_training: number
  passed: number
  failed: number
  dropped: number
  avg_attendance_score: number | null
  avg_test_score: number | null
}

export default function HrOnboardingDashboard() {
  const [loading, setLoading] = useState(true)
  const [gens, setGens] = useState<GenSummary[]>([])
  const [regionFilter, setRegionFilter] = useState<string>('all')

  const fetchGens = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (regionFilter !== 'all') params.set('region_code', regionFilter)

      const response = await fetch(`/api/hr/onboarding/dashboard?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không thể tải dữ liệu.')
      setGens(data.gens || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định')
    } finally {
      setLoading(false)
    }
  }, [regionFilter])

  useEffect(() => {
    fetchGens()
  }, [fetchGens])

  const totalStats = gens.reduce(
    (acc, g) => ({
      total: acc.total + g.total,
      in_training: acc.in_training + g.in_training,
      passed: acc.passed + g.passed,
      failed: acc.failed + g.failed + g.dropped,
    }),
    { total: 0, in_training: 0, passed: 0, failed: 0 }
  )

  return (
    <PageContainer
      title="Đào tạo đầu vào (HR Onboarding)"
      description="Quản lý toàn bộ vòng đời đào tạo ứng viên mới: từ nhập liệu, gán GEN, theo dõi training, đến quyết định pass/fail."
      maxWidth="full"
      padding="md"
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Tổng ứng viên" value={totalStats.total} color="blue" />
          <StatCard icon={TrendingUp} label="Đang đào tạo" value={totalStats.in_training} color="yellow" />
          <StatCard icon={UserCheck} label="Đạt" value={totalStats.passed} color="green" />
          <StatCard icon={UserX} label="Không đạt / Bỏ" value={totalStats.failed} color="red" />
        </div>

        {/* Region Filter */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Khu vực:</label>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Tất cả</option>
            <option value="1">Khu vực 1 (HCM)</option>
            <option value="2">Khu vực 2 (Hà Nội)</option>
            <option value="3">Khu vực 3 (Tỉnh Nam)</option>
            <option value="4">Khu vực 4 (Tỉnh Bắc)</option>
            <option value="5">Khu vực 5 (Tỉnh Trung)</option>
          </select>
        </div>

        {/* GEN List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Danh sách GEN</h2>
            <span className="text-sm text-gray-500">{gens.length} GEN</span>
          </div>
          {loading ? (
            <div className="p-4">
              <PageSkeleton variant="table" itemCount={8} showHeader={false} />
            </div>
          ) : gens.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Chưa có GEN nào.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['GEN', 'Tổng', 'Mới', 'Đang đào tạo', 'Đạt', 'Không đạt', 'Bỏ học', 'Điểm chuyên cần TB', 'Điểm kiểm tra TB', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {gens.map((gen) => (
                    <tr key={gen.gen_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 font-semibold text-gray-900">{gen.gen_name}</td>
                      <td className="px-4 py-4 text-gray-700">{gen.total}</td>
                      <td className="px-4 py-4 text-gray-500">{gen.new}</td>
                      <td className="px-4 py-4 text-yellow-600 font-medium">{gen.in_training}</td>
                      <td className="px-4 py-4 text-green-600 font-medium">{gen.passed}</td>
                      <td className="px-4 py-4 text-red-600 font-medium">{gen.failed}</td>
                      <td className="px-4 py-4 text-gray-500">{gen.dropped}</td>
                      <td className="px-4 py-4 text-gray-700">
                        {gen.avg_attendance_score != null ? gen.avg_attendance_score.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-4 text-gray-700">
                        {gen.avg_test_score != null ? gen.avg_test_score.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/hr-onboarding/${gen.gen_id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm whitespace-nowrap"
                        >
                          Chi tiết →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: 'blue' | 'yellow' | 'green' | 'red'
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}
