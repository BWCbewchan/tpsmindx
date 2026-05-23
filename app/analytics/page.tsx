'use client'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/primitives/icon'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStats = () => {
    setLoading(true)
    fetch('/api/analytics')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStats(data.data)
          setError('')
        } else {
          setError('Không thể tải dữ liệu analytics')
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setError('Lỗi kết nối')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return <PageSkeleton variant="default" itemCount={8} showHeader={true} />
  }

  if (error) {
    return (
      <PageLayout maxWidth="7xl" padding="md">
        <PageLayoutContent>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">{error}</p>
            <Button variant="destructive" onClick={fetchStats} className="mt-4">
              Thử lại
            </Button>
          </div>
        </PageLayoutContent>
      </PageLayout>
    )
  }

  return (
    <PageLayout maxWidth="7xl" padding="md">
      <PageLayoutContent spacing="lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Analytics Dashboard
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Thống kê sử dụng hệ thống
            </p>
          </div>
          <Button variant="outline" onClick={fetchStats}>
            <Icon icon={RefreshCcw} size="sm" />
            Làm mới
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium opacity-90 mb-2">
                  Tổng lượt truy cập
                </h2>
              <p className="text-4xl font-bold">{stats?.totalVisits || 0}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium opacity-90 mb-2">
                Tổng lượt tìm kiếm
              </h2>
              <p className="text-4xl font-bold">{stats?.totalSearches || 0}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium opacity-90 mb-2">
                Mã giáo viên khác nhau
              </h2>
              <p className="text-4xl font-bold">{stats?.uniqueSearches || 0}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium opacity-90 mb-2">
                Tỷ lệ tìm kiếm
              </h2>
              <p className="text-4xl font-bold">{stats?.searchRate || 0}%</p>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <svg
            className="w-6 h-6 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Top 10 mã được tìm nhiều nhất
        </h2>

        {stats?.topSearches && stats.topSearches.length > 0 ? (
          <div className="space-y-2">
            {stats.topSearches.map((item: any, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      index === 0
                        ? 'bg-yellow-100 text-yellow-700'
                        : index === 1
                          ? 'bg-gray-200 text-gray-700'
                          : index === 2
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className="font-medium text-gray-900">{item.code}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {item.count} lượt
                  </span>
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{
                        width: `${(item.count / (stats.topSearches[0]?.count || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p>Chưa có dữ liệu tìm kiếm</p>
          </div>
        )}
      </div>

      {/* Recent Searches */}
      <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mt-6">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <svg
            className="w-6 h-6 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Tìm kiếm gần đây
        </h2>

        {stats?.recentSearches && stats.recentSearches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats.recentSearches
              .slice(0, 10)
              .map((item: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-gray-900">
                      {item.code}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(item.timestamp).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p>Chưa có dữ liệu tìm kiếm gần đây</p>
          </div>
        )}
      </div>

      <div className="text-center text-sm text-gray-500">
        <p>Dữ liệu được cập nhật theo thời gian thực từ Google Sheets</p>
      </div>
      </PageLayoutContent>
    </PageLayout>
  )
}
