'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface CenterUsageItem {
  center: string
  users: number
  usage_count: number
}

interface CenterUsageChartProps {
  data: CenterUsageItem[]
}

function truncateCenterName(name: string): string {
  if (name.length <= 20) return name
  return `${name.slice(0, 20)}...`
}

function formatCenterAxisLabel(name: string): string {
  const withoutPrefix = name
    .replace(/^HCM\s*-\s*/i, '')
    .replace(/^HN\s*-\s*/i, '')
    .trim()

  if (withoutPrefix.length <= 14) return withoutPrefix
  return `${withoutPrefix.slice(0, 14)}...`
}

export function CenterUsageChart({ data }: CenterUsageChartProps) {
  const chartData = data.slice(0, 10).map((item) => ({
    ...item,
    axisCenter: formatCenterAxisLabel(item.center),
    axisCenterMobile: truncateCenterName(item.center),
  }))
  const mobileChartData = chartData.slice(0, 6)
  const mobileChartHeight = Math.max(220, mobileChartData.length * 42)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">
          Biểu đồ lượt sử dụng theo cơ sở
        </h4>
        <span className="text-[11px] text-gray-400">
          Top {chartData.length} cơ sở
        </span>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-gray-400">
          Chưa có dữ liệu để vẽ biểu đồ
        </div>
      ) : (
        <>
          <div className="sm:hidden">
            <ResponsiveContainer width="100%" height={mobileChartHeight}>
              <BarChart
                layout="vertical"
                data={mobileChartData}
                margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="axisCenterMobile"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={112}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(161, 0, 31, 0.06)' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
                    fontSize: 12,
                  }}
                  labelFormatter={(_, payload) => {
                    const datum = payload?.[0]?.payload as
                      | { center?: string }
                      | undefined
                    return `Cơ sở: ${datum?.center ?? ''}`
                  }}
                  formatter={(value) => [Number(value ?? 0), 'Lượt sử dụng']}
                />
                <Bar
                  dataKey="usage_count"
                  name="usage_count"
                  fill="#a1001f"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={14}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="hidden sm:block">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -12, bottom: 30 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="axisCenter"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  tickMargin={8}
                  minTickGap={10}
                  height={52}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(161, 0, 31, 0.06)' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
                    fontSize: 12,
                  }}
                  labelFormatter={(_, payload) => {
                    const datum = payload?.[0]?.payload as
                      | { center?: string }
                      | undefined
                    return `Cơ sở: ${datum?.center ?? ''}`
                  }}
                  formatter={(value) => [Number(value ?? 0), 'Lượt sử dụng']}
                />
                <Bar
                  dataKey="usage_count"
                  name="usage_count"
                  fill="#a1001f"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={42}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
