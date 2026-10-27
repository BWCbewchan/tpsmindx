'use client'

import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { useAuth } from '@/lib/auth-context'
import { logger } from '@/lib/logger'
import { resolveAuthenticatedLanding } from '@/lib/teacher-session-routing'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    try {
      if (!localStorage.getItem('user')) {
        logger.info('Root: No cached user, redirecting to login')
        router.replace('/login')
        return
      }
    } catch {
      router.replace('/login')
      return
    }

    if (isLoading) return

    if (!user) {
      router.replace('/login')
      return
    }

    if (user.role === 'teacher' && !user.isAdmin && user.teacherSync) {
      try {
        if (user.teacherSync.foundInDatabase) {
          localStorage.setItem(
            'tps_profile_check_done_email',
            user.email.trim().toLowerCase(),
          )
        } else if (!user.teacherSync.dbUnavailable) {
          localStorage.removeItem('tps_profile_check_done_email')
        }
      } catch {
        // Compatibility cache only. Server session remains authoritative.
      }
    }

    const redirectPath = resolveAuthenticatedLanding({
      selectedRole: user.isAdmin ? 'manager' : 'teacher',
      userRole: user.role,
      isAdmin: Boolean(user.isAdmin),
      teacherSync: user.teacherSync,
      permissions: user.permissions,
    })

    logger.info('Root: Redirecting authenticated user', {
      email: user.email,
      role: user.role,
      path: redirectPath,
    })
    router.replace(redirectPath)
  }, [user, isLoading, router])

  return <PageSkeleton variant="default" itemCount={6} showHeader={true} />
}
