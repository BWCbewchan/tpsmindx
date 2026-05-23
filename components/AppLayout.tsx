'use client'

import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { isUnauthorizedStatus, parseJsonSafe } from '@/lib/auth-error-handling'
import { ArrowLeft, Mail, MessageCircle, ShieldAlert } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

interface AppLayoutProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireAdmin?: boolean
  redirectPath?: string
}

const ADMIN_PERM_REFRESH_MS = 45_000
const TEACHER_VERIFY_MIN_MS = 120_000

export default function AppLayout({
  children,
  requireAuth = true,
  requireAdmin = false,
  redirectPath = '/login',
}: AppLayoutProps) {
  const PROFILE_CHECK_DONE_EMAIL_KEY = 'tps_profile_check_done_email'
  const { user, token, isLoading, refreshPermissions, logout, updateUser } =
    useAuth()
  /** Không tin role/permissions trong localStorage — chỉ render /admin sau khi /api/check-admin + Bearer hợp lệ. */
  const [adminAccessState, setAdminAccessState] = useState<
    'idle' | 'checking' | 'allowed' | 'denied'
  >('idle')
  const router = useRouter()
  const pathname = usePathname()

  const hasRedirected = useRef(false)
  const latestUserRef = useRef(user)
  useEffect(() => {
    latestUserRef.current = user
  }, [user])
  const lastAdminPermRefreshAt = useRef(0)
  const lastTeacherVerifyAt = useRef(0)
  const lastTeacherVerifyPathname = useRef<string | null>(null)
  const [noPermission, setNoPermission] = useState(false)
  /** DB tạm không trả lời — cho qua cổng (không kẹt skeleton), không coi là đã xác nhận trong teachers. */
  const [teacherGateAllowUnknown, setTeacherGateAllowUnknown] = useState(false)

  useEffect(() => {
    if (!user) setTeacherGateAllowUnknown(false)
  }, [user])

  useEffect(() => {
    if (!pathname.startsWith('/user')) setTeacherGateAllowUnknown(false)
  }, [pathname])

  /** GV vào /user: cần localStorage khớp HOẶC xác nhận có trong bảng teachers (không ép qua /checkdatasource nếu đã có DB). */
  const needsTeacherDbCheck = useMemo(() => {
    if (!user || user.role !== 'teacher' || !pathname.startsWith('/user'))
      return false
    if (teacherGateAllowUnknown) return false
    if (typeof window === 'undefined') return false
    const checked = localStorage
      .getItem(PROFILE_CHECK_DONE_EMAIL_KEY)
      ?.trim()
      .toLowerCase()
    const cur = (user.email || '').trim().toLowerCase()
    return !(checked && checked === cur)
  }, [user, pathname, teacherGateAllowUnknown])

  const [teacherGateBlocking, setTeacherGateBlocking] = useState(false)

  useEffect(() => {
    if (!needsTeacherDbCheck) {
      setTeacherGateBlocking(false)
      return
    }
    setTeacherGateBlocking(true)
    let cancelled = false
    const cur = (user!.email || '').trim().toLowerCase()
    ;(async () => {
      try {
        const res = await fetch(
          `/api/checkdatasource/status?email=${encodeURIComponent(user!.email)}&brief=1`,
          { cache: 'no-store', headers: authHeaders(token) },
        )
        const data = ((await parseJsonSafe(res)) ?? {}) as {
          success?: boolean
          exists?: boolean
          dbUnavailable?: boolean
        }
        if (cancelled) return
        if (res.ok && data.success && data.exists === true) {
          try {
            localStorage.setItem(PROFILE_CHECK_DONE_EMAIL_KEY, cur)
          } catch {
            /* ignore */
          }
          setTeacherGateBlocking(false)
          return
        }
        if (res.ok && data.success && data.dbUnavailable) {
          setTeacherGateAllowUnknown(true)
          setTeacherGateBlocking(false)
          return
        }
        router.replace('/checkdatasource')
      } catch {
        if (cancelled) return
        setTeacherGateAllowUnknown(true)
        setTeacherGateBlocking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [needsTeacherDbCheck, user?.email, router, token])
  const getRoutePermissionAliases = (path: string) => {
    if (path === '/admin/thu-vien-de') {
      return ['/admin/thu-vien-de', '/admin/page4/thu-vien-de']
    }
    if (path === '/admin/page4/thu-vien-de') {
      return ['/admin/page4/thu-vien-de', '/admin/thu-vien-de']
    }
    return [path]
  }

  useEffect(() => {
    if (isLoading) return
    if (!requireAdmin || !user?.email) {
      setAdminAccessState('idle')
      return
    }
    if (!pathname.startsWith('/admin')) {
      setAdminAccessState('idle')
      return
    }

    // Đã xác thực trong phiên này — không gọi lại API khi chỉ đổi route con
    if (adminAccessState === 'allowed') return

    const verifyEmail = user.email.trim().toLowerCase()
    let cancelled = false
    setAdminAccessState('checking')
    ;(async () => {
      try {
        const bearer = token?.trim()
        const res = await fetch('/api/check-admin', {
          cache: 'no-store',
          headers: bearer ? authHeaders(bearer) : {},
        })
        const data = ((await parseJsonSafe(res)) ?? {}) as {
          success?: boolean
          isAdmin?: boolean
          role?: string
          permissions?: string[]
          userRoles?: Array<string | { role_code?: string }>
          assignedCenters?: Array<{
            id: number
            full_name: string
            short_code: string | null
          }>
        }

        if (cancelled) return

        if (!res.ok) {
          setAdminAccessState('denied')
          if (!hasRedirected.current) {
            hasRedirected.current = true
            if (isUnauthorizedStatus(res.status)) {
              logout()
              router.replace(redirectPath)
            } else {
              router.replace('/user/thong-tin-giao-vien')
            }
          }
          return
        }

        if (data.success !== true || !data.isAdmin) {
          setAdminAccessState('denied')
          if (!hasRedirected.current) {
            hasRedirected.current = true
            router.replace('/user/thong-tin-giao-vien')
          }
          return
        }

        const cur = latestUserRef.current
        if (!cur || cur.email.trim().toLowerCase() !== verifyEmail) {
          return
        }

        const role = (data.role || 'teacher') as
          | 'teacher'
          | 'manager'
          | 'super_admin'
          | 'admin'
          | 'hr'
        const userRolesFlat = (data.userRoles || []).map((r) =>
          typeof r === 'string'
            ? r
            : String((r as { role_code?: string }).role_code ?? ''),
        )

        if (bearer) {
          updateUser(
            {
              ...cur,
              role,
              isAdmin: true,
              permissions: data.permissions || [],
              userRoles: userRolesFlat,
              assignedCenters: data.assignedCenters || [],
            },
            bearer,
          )
        }
        setAdminAccessState('allowed')
        hasRedirected.current = false
      } catch (error) {
        if (cancelled) return
        console.warn('[AppLayout] Admin access check failed', error)
        setAdminAccessState('denied')
        if (!hasRedirected.current) {
          hasRedirected.current = true
          router.replace('/user/thong-tin-giao-vien')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    isLoading,
    requireAdmin,
    user?.email,
    token,
    pathname,
    adminAccessState, // cần để early-return khi 'allowed' hoạt động đúng
    logout,
    router,
    redirectPath,
    updateUser,
  ])

  // Admin: làm mới quyền khi vào /admin — không gọi /api/check-admin mỗi lần đổi route con (throttle)
  useEffect(() => {
    if (!user || !pathname.startsWith('/admin')) return
    if (adminAccessState !== 'allowed') return
    const now = Date.now()
    if (
      lastAdminPermRefreshAt.current !== 0 &&
      now - lastAdminPermRefreshAt.current < ADMIN_PERM_REFRESH_MS
    ) {
      return
    }
    lastAdminPermRefreshAt.current = now
    void refreshPermissions()
  }, [pathname, user, refreshPermissions, adminAccessState])

  useEffect(() => {
    if (isLoading) return

    if (
      requireAdmin &&
      pathname.startsWith('/admin') &&
      user &&
      adminAccessState !== 'allowed'
    ) {
      return
    }

    const roleCodes = (user?.userRoles || []).map((code) =>
      String(code).toUpperCase(),
    )
    const hasTrainingInputRole = roleCodes.some(
      (code) => code === 'HR' || code === 'TE' || code === 'TF',
    )
    const isTrainingInputRoute =
      pathname === '/admin/hr-candidates' ||
      pathname.startsWith('/admin/hr-candidates/')

    // Redirect to login if authentication required but not authenticated
    if (requireAuth && !user && !hasRedirected.current) {
      hasRedirected.current = true
      router.replace(redirectPath)
      return
    }

    // Check admin access
    if (requireAdmin && user) {
      const isSuperAdmin = user.role === 'super_admin'
      const isAdminUser =
        user.isAdmin || ['super_admin', 'admin', 'manager'].includes(user.role)
      const permissions = user.permissions || []

      if (!isAdminUser) {
        // Not an admin at all — redirect to user area
        if (!hasRedirected.current) {
          hasRedirected.current = true
          router.replace('/user/thong-tin-giao-vien')
        }
        return
      }

      // Super admin bypasses all permission checks
      if (!isSuperAdmin) {
        // If they have no permissions, show contact message
        if (permissions.length === 0) {
          if (hasTrainingInputRole && isTrainingInputRoute) {
            setNoPermission(false)
          } else if (hasTrainingInputRole) {
            router.replace('/admin/hr-candidates/gen-planner')
            return
          } else {
            setNoPermission(true)
            return
          }
        }

        // manager và admin luôn được phép vào deal-luong routes
        const DEAL_LUONG_ROUTES = ['/admin/deal-luong', '/admin/tao-deal-luong']
        const effectivePermissions = ['manager', 'admin'].includes(user.role)
          ? Array.from(new Set([...permissions, ...DEAL_LUONG_ROUTES]))
          : permissions

        // Check if user has permission for current route
        // Allow bypass for universal admin routes like /admin/profile
        if (
          pathname.startsWith('/admin') &&
          pathname !== '/admin' &&
          !pathname.startsWith('/admin/profile')
        ) {
          const hasPermission =
            (hasTrainingInputRole && isTrainingInputRoute) ||
            effectivePermissions.some(
              (p) =>
                pathname === p ||
                pathname.startsWith(`${p}/`) ||
                p.startsWith(`${pathname}/`),
            )

          if (!hasPermission) {
            if (hasTrainingInputRole) {
              router.replace('/admin/hr-candidates/gen-planner')
              return
            }

            // Find first allowed valid admin route to redirect to
            const firstAllowed = effectivePermissions.find((p) =>
              p.startsWith('/admin/'),
            )
            if (firstAllowed) {
              router.replace(firstAllowed)
            } else {
              setNoPermission(true)
            }
            return
          }
        }
      }
    }

    // Teacher /user gate: xử lý bởi effect teacherGateBlocking + API brief=1 (không redirect /checkdatasource đồng bộ ở đây).

    // Reset redirect flag when user logs in
    if (user) {
      hasRedirected.current = false
    }
    setNoPermission(false)
  }, [
    user,
    isLoading,
    router,
    requireAuth,
    requireAdmin,
    redirectPath,
    pathname,
    adminAccessState,
  ])

  // GV: mỗi lần đổi route trong /user/* xác minh lại còn trong bảng teachers; throttle chỉ khi cùng pathname (tránh gọi trùng khi re-render).
  useEffect(() => {
    const verifyTeacherStillExists = async () => {
      if (!user || user.role !== 'teacher') return
      if (!pathname.startsWith('/user')) return

      try {
        const response = await fetch(
          `/api/checkdatasource/status?email=${encodeURIComponent(user.email)}&brief=1`,
          { cache: 'no-store', headers: authHeaders(token) },
        )
        const data = ((await parseJsonSafe(response)) ?? {}) as {
          success?: boolean
          exists?: boolean
          dbUnavailable?: boolean
        }
        if (
          response.ok &&
          data.success &&
          data.exists === false &&
          !data.dbUnavailable
        ) {
          localStorage.removeItem(PROFILE_CHECK_DONE_EMAIL_KEY)
          setTeacherGateAllowUnknown(false)
          router.replace('/checkdatasource')
        }
      } catch {
        // DB/network error — don't kick the user out
      }
    }

    const pathChanged = lastTeacherVerifyPathname.current !== pathname
    if (pathChanged) {
      lastTeacherVerifyPathname.current = pathname
    } else {
      const now = Date.now()
      if (
        lastTeacherVerifyAt.current !== 0 &&
        now - lastTeacherVerifyAt.current < TEACHER_VERIFY_MIN_MS
      ) {
        return
      }
    }
    lastTeacherVerifyAt.current = Date.now()
    void verifyTeacherStillExists()
  }, [user, token, pathname, router])

  // Show nothing while checking authentication - let page-level skeleton handle it
  if (isLoading) {
    return null
  }

  const adminGateBlocking =
    requireAdmin &&
    pathname.startsWith('/admin') &&
    user &&
    (adminAccessState === 'checking' || adminAccessState === 'idle')

  if (adminGateBlocking) {
    return null
  }

  // GV: đang kiểm tra DB trước khi render /user (tránh nháy /checkdatasource)
  if (teacherGateBlocking) {
    return null
  }

  // Fallback UI for unassigned admin roles
  if (noPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="h-10 w-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Chưa được cấp quyền
          </h2>
          <p className="text-gray-600 mb-8">
            Tài khoản của bạn đã có vai trò Quản lý nhưng chưa được phân quyền
            truy cập các màn hình cụ thể.
          </p>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 text-left">
            <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Hướng dẫn xử lý:
            </h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              Vui lòng <strong>liên hệ HOTeaching</strong> để được cấp quyền
              truy cập vào các module tương ứng.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="mailto:hoteaching@mindx.edu.vn"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#a1001f] text-white rounded-lg font-bold hover:bg-[#c41230] transition-colors shadow-md"
            >
              <Mail className="h-4 w-4" /> Gửi mail hỗ trợ
            </a>
            <button
              onClick={() => router.replace('/user/thong-tin-giao-vien')}
              className="flex items-center justify-center gap-2 w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Quay lại trang cá nhân
            </button>
          </div>

          <p className="mt-8 text-xs text-gray-400">
            Teaching Portal System (TPS) &bull; MindX Technology School
          </p>
        </div>
      </div>
    )
  }

  // Don't render if authentication checks fail
  if (requireAuth && !user) {
    return null
  }

  if (requireAdmin && user && pathname.startsWith('/admin')) {
    if (adminAccessState !== 'allowed') {
      return null
    }
    /** Đã đồng bộ từ /api/check-admin; không tin bản ghi localStorage cũ. */
    if (!user.isAdmin) {
      return null
    }
  }

  return <>{children}</>
}
