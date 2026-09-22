'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface DevicePieChartProps {
  mobile: number
  desktop: number
}

const COLORS = ['#a1001f', '#374151']
const LABELS: Record<string, string> = {
  mobile: 'Di động',
  desktop: 'Máy tính',
}

export function DevicePieChart({ mobile, desktop }: DevicePieChartProps) {
  const data = [
    { name: 'mobile', value: mobile },
    { name: 'desktop', value: desktop },
  ].filter((d) => d.value > 0)

  const total = mobile + desktop

  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-4 text-sm font-semibold text-gray-800">
        Phân bổ thiết bị
      </h3>

      {total === 0 ? (
        <div className="flex h-[180px] items-center justify-center text-sm text-gray-400">
          Chưa có dữ liệu
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, idx) => (
                  <Cell
                    key={entry.name}
                    fill={COLORS[idx % COLORS.length]}
                    className="transition-all duration-300 hover:opacity-80"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  fontSize: 12,
                }}
                formatter={(value, name) => [
                  `${Number(value ?? 0)}%`,
                  LABELS[String(name)] || String(name),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex w-full min-w-0 flex-row justify-center gap-4 sm:w-auto sm:flex-col sm:justify-start sm:gap-3">
            {data.map((entry, idx) => (
              <div key={entry.name} className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700">
                    {LABELS[entry.name]}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {entry.value}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
