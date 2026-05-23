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
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">
        Phân bổ thiết bị
      </h3>

      {total === 0 ? (
        <div className="flex items-center justify-center h-[180px] text-sm text-gray-400">
          Chưa có dữ liệu
        </div>
      ) : (
        <div className="flex items-center gap-6">
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
          <div className="flex flex-col gap-3">
            {data.map((entry, idx) => (
              <div key={entry.name} className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <div>
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
