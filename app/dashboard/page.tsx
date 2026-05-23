'use client'

import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { useAuth } from '@/lib/auth-context'
import { logger } from '@/lib/logger'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardRedirect() {
  const router = useRouter()
  const { user, token, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) {
      logger.info('Dashboard: Waiting for auth context to load...')
      return
    }

    // Chưa đăng nhập → redirect đến login
    if (!token || !user) {
      logger.info('Dashboard: No auth found, redirecting to login')
      router.replace('/login')
      return
    }

    // Đã đăng nhập → kiểm tra quyền
    logger.info('Dashboard: User authenticated, checking admin status', {
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
    })

    // Ưu tiên admin dashboard nếu là admin
    if (user.isAdmin) {
      logger.success('Dashboard: Redirecting to admin dashboard')
      router.replace('/admin/dashboard')
    } else {
      logger.success('Dashboard: Redirecting to user portal')
      router.replace('/user/thong-tin-giao-vien')
    }
  }, [user, token, isLoading, router])

  return <PageSkeleton variant="default" itemCount={3} showHeader={false} />
}
