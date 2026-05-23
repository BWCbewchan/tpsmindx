'use client'

import { useAuth } from '@/lib/auth-context'
import { ArrowLeft, HomeIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/primitives/icon'

export default function NotFound() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [countdown, setCountdown] = useState(5)

  // Xác định trang chủ phù hợp
  const getHomePath = () => {
    if (!user) return '/login'
    return user.isAdmin ? '/admin/dashboard' : '/user/thong-tin-giao-vien'
  }

  const homePath = getHomePath()

  useEffect(() => {
    if (isLoading) return

    // Auto redirect sau 5 giây
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          router.push(homePath)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isLoading, homePath, router])

  const handleGoHome = () => {
    router.push(homePath)
  }

  const handleGoBack = () => {
    router.back()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-4">
      <div className="max-w-2xl w-full">
        {/* Main Error Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 text-center transform transition-all duration-300 hover:shadow-3xl">
          {/* 404 Number */}
          <div className="relative mb-6">
            <h1 className="text-9xl md:text-[180px] font-bold text-gray-200 select-none">
              404
            </h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-[#a1001f] text-white p-6 rounded-full animate-bounce">
                <svg
                  className="w-16 h-16"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Error Message */}
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            Trang không tồn tại
          </h2>
          <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">
            Đường dẫn bạn đang tìm không tồn tại hoặc đã bị di chuyển. Đừng lo,
            chúng tôi sẽ đưa bạn về nơi an toàn!
          </p>

          {/* Auto Redirect Info */}
          {!isLoading && (
            <div className="bg-gradient-to-r from-[#a1001f]/10 to-[#c1122f]/10 border border-[#a1001f]/20 rounded-xl p-4 mb-8">
              <p className="text-gray-700 font-medium">
                Tự động chuyển hướng sau{' '}
                <span className="text-[#a1001f] font-bold text-xl">
                  {countdown}
                </span>{' '}
                giây...
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Đích đến:{' '}
                <span className="font-semibold">
                  {user
                    ? user.isAdmin
                      ? 'Admin Dashboard'
                      : 'Thông tin giáo viên'
                    : 'Trang đăng nhập'}
                </span>
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={handleGoHome}
              disabled={isLoading}
              variant="mindx"
              size="lg"
              className="w-full sm:w-auto shadow-lg hover:shadow-xl"
            >
              <Icon icon={HomeIcon} size="sm" />
              {isLoading
                ? 'Đang tải...'
                : user
                  ? user.isAdmin
                    ? 'Về trang Admin'
                    : 'Về trang của tôi'
                  : 'Về trang đăng nhập'}
            </Button>

            <Button
              onClick={handleGoBack}
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
            >
              <Icon icon={ArrowLeft} size="sm" />
              Quay lại
            </Button>
          </div>

          {/* Additional Info */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-gray-500 text-sm">
              Nếu bạn nghĩ đây là lỗi hệ thống, vui lòng liên hệ bộ phận kỹ
              thuật.
            </p>
          </div>
        </div>

        {/* Fun Illustration */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            🧭 Đường dẫn bị lạc không sao, chúng ta có bản đồ!
          </p>
        </div>
      </div>
    </div>
  )
}
