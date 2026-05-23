'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface DataPoint {
  date: string
  users: number
}

interface EngagementChartProps {
  dau: DataPoint[]
  wau: DataPoint[]
  activeTab: 'dau' | 'wau'
  onTabChange: (tab: 'dau' | 'wau') => void
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function formatHour(dateStr: string): string {
  const d = new Date(dateStr)
  const hh = String(d.getHours()).padStart(2, '0')
  return `${hh}:00`
}

export function EngagementChart({
  dau,
  wau,
  activeTab,
  onTabChange,
}: EngagementChartProps) {
  const data = activeTab === 'dau' ? dau : wau
  const formatted = data.map((d) => ({
    ...d,
    label: activeTab === 'dau' ? formatHour(d.date) : formatDate(d.date),
  }))

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">
          Người dùng hoạt động
        </h3>
        <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          <button
            onClick={() => onTabChange('dau')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
              activeTab === 'dau'
                ? 'bg-[#a1001f] text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            DAU
          </button>
          <button
            onClick={() => onTabChange('wau')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
              activeTab === 'wau'
                ? 'bg-[#a1001f] text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            WAU
          </button>
        </div>
      </div>

      {formatted.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-gray-400">
          Chưa có dữ liệu
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={formatted}>
            <defs>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a1001f" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#a1001f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f0f0f0"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={35}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: 12,
              }}
              labelFormatter={(label) =>
                activeTab === 'dau' ? `Giờ: ${label}` : `Ngày: ${label}`
              }
              formatter={(value: number | undefined) => [
                value,
                activeTab === 'dau' ? 'Người dùng/giờ' : 'WAU theo ngày',
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Area
              type="monotone"
              dataKey="users"
              name={activeTab === 'dau' ? 'DAU' : 'WAU'}
              stroke="#a1001f"
              strokeWidth={2}
              fill="url(#colorUsers)"
              dot={{ r: 3, fill: '#a1001f', strokeWidth: 0 }}
              activeDot={{
                r: 5,
                fill: '#a1001f',
                strokeWidth: 2,
                stroke: '#fff',
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
