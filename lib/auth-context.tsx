'use client'

import { toast } from '@/lib/app-toast'
import { filterManagementPermissions } from '@/lib/admin-permission-routes'
import { authHeaders } from '@/lib/auth-headers'
import { logger } from '@/lib/logger'
import type { TeacherSyncState } from '@/lib/teacher-session-routing'
import { useRouter } from 'next/navigation'
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react'

interface User {
  email: string
  displayName: string
  role: 'teacher' | 'manager' | 'super_admin' | 'admin' | 'hr'
  localId: string
  isAdmin?: boolean
  isAppUser?: boolean
  permissions?: string[]
  userRoles?: string[]
  assignedCenters?: Array<{
    id: number
    full_name: string
    short_code: string | null
    email?: string
  }>
  teacherSync?: TeacherSyncState
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  logout: (redirectPath?: string) => Promise<void>
  updateUser: (user: User, token: string) => void
  refreshPermissions: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  logout: async () => {},
  updateUser: () => {},
  refreshPermissions: async () => {},
})

export const useAuth = () => useContext(AuthContext)

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    )
    const decoded = atob(padded)
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token)
  if (!payload) return true

  const exp = payload.exp
  if (typeof exp !== 'number') return true

  return Date.now() >= exp * 1000
}

function isStoredUserShapeValid(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false
  const user = value as Record<string, unknown>

  return (
    typeof user.email === 'string' &&
    user.email.trim().length > 0 &&
    typeof user.displayName === 'string' &&
    typeof user.localId === 'string' &&
    typeof user.role === 'string'
  )
}

function sanitizeUserPermissions(user: User): User {
  return {
    ...user,
    permissions: filterManagementPermissions(user.permissions || []),
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const bootstrapAuth = async () => {
      let cachedUser: User | null = null

    try {
      logger.info('Initializing auth context...')

      const storedUser = localStorage.getItem('user')

      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser)
          if (isStoredUserShapeValid(parsedUser)) {
            cachedUser = sanitizeUserPermissions(parsedUser)
            if (!cancelled) {
              setUser(cachedUser)
            }
            logger.success('Auth restored from localStorage user cache')
          } else {
            localStorage.removeItem('user')
          }
        } catch {
          localStorage.removeItem('user')
        }
      }

      const response = await fetch('/api/auth/me', { cache: 'no-store' })
      if (cancelled) return

      if (response.ok) {
        const data = await response.json()
        if (data?.success) {
          const nextUser: User = sanitizeUserPermissions({
            email: data.email ?? cachedUser?.email ?? '',
            displayName:
              cachedUser?.displayName ??
              (data.email ? String(data.email).split('@')[0] : '') ??
              data.email ??
              '',
            role: (data.role ?? cachedUser?.role ?? 'teacher') as User['role'],
            localId: cachedUser?.localId ?? data.email ?? '',
            isAdmin: Boolean(data.isAdmin ?? cachedUser?.isAdmin),
            isAppUser: Boolean(data.isAppUser ?? cachedUser?.isAppUser),
            permissions: Array.isArray(data.permissions)
              ? data.permissions
              : cachedUser?.permissions ?? [],
            userRoles: Array.isArray(data.userRoles)
              ? data.userRoles
              : cachedUser?.userRoles ?? [],
            assignedCenters: Array.isArray(data.assignedCenters)
              ? data.assignedCenters
              : cachedUser?.assignedCenters ?? [],
            teacherSync:
              data.teacherSync &&
              typeof data.teacherSync.foundInDatabase === 'boolean' &&
              typeof data.teacherSync.dbUnavailable === 'boolean'
                ? {
                    foundInDatabase: data.teacherSync.foundInDatabase,
                    dbUnavailable: data.teacherSync.dbUnavailable,
                  }
                : cachedUser?.teacherSync,
          })

          setUser(nextUser)
          localStorage.setItem('user', JSON.stringify(nextUser))
          logger.success('Auth restored from session cookie')
        } else {
          localStorage.removeItem('user')
          setUser(null)
          setToken(null)
          logger.info('Auth session verification failed')
        }
      } else {
        localStorage.removeItem('user')
        setUser(null)
        setToken(null)
        logger.info('No active auth session')
      }
    } catch (error: any) {
      logger.error('Error initializing auth', { error: error.message })
      localStorage.removeItem('user')
      setUser(null)
      setToken(null)
    } finally {
      if (!cancelled) {
        setIsLoading(false)
      }
    }
    }

    void bootstrapAuth()

    return () => {
      cancelled = true
    }
  }, []) // Empty dependency array - only run once

  const logout = useCallback(async (redirectPath = '/login') => {
    try {
      logger.info('Logging out user')

      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})

      localStorage.removeItem('user')
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      setUser(null)
      setToken(null)

      toast.success('Đăng xuất thành công!', { icon: '👋' })
      logger.success('User logged out successfully')

      router.replace(redirectPath)
    } catch (error: any) {
      logger.error('Error during logout', { error: error.message })
      toast.error('Có lỗi khi đăng xuất')
    }
  }, [router])

  const updateUser = useCallback((newUser: User, newToken: string) => {
    try {
      logger.info('Updating user in auth context')

      const safeUser = sanitizeUserPermissions(newUser)
      localStorage.setItem('user', JSON.stringify(safeUser))
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      setUser(safeUser)
      setToken(newToken)

      logger.success('Auth context updated successfully')
    } catch (error: any) {
      logger.error('Error updating user', { error: error.message })
      toast.error('Có lỗi khi cập nhật thông tin')
    }
  }, [])

  const refreshPermissions = useCallback(async () => {
    if (!user) return

    try {
      const requestInit: RequestInit = token
        ? { headers: authHeaders(token) }
        : {}
      const response = await fetch('/api/check-admin', {
        ...requestInit,
      })
      const data = await response.json()

      if (data.success && data.permissions) {
        // Compare with current permissions to avoid unnecessary updates
        const currentPerms = JSON.stringify(
          [...(user.permissions || [])].sort(),
        )
        const newPerms = JSON.stringify([...data.permissions].sort())
        const currentRole = user.role
        const newRole = data.role
        const currentUserRoles = JSON.stringify(
          [...(user.userRoles || [])].sort(),
        )
        const nextUserRoles = JSON.stringify([...(data.userRoles || [])].sort())

        if (
          currentPerms !== newPerms ||
          currentRole !== newRole ||
          user.isAdmin !== data.isAdmin ||
          currentUserRoles !== nextUserRoles
        ) {
          const updatedUser = {
            ...user,
            role: newRole,
            permissions: data.permissions,
            userRoles: data.userRoles || [],
            isAdmin: data.isAdmin,
          }

          setUser(updatedUser)
          localStorage.setItem('user', JSON.stringify(updatedUser))
          logger.success('Permissions refreshed successfully')
        }
      }
    } catch (error: any) {
      logger.error('Error refreshing permissions', { error: error.message })
    }
  }, [user, token])

  // Refresh role changes in open tabs, including revocations while the page is idle.
  useEffect(() => {
    if (!user) return
    const refresh = () => { if (document.visibilityState === 'visible') void refreshPermissions() }
    const interval = window.setInterval(refresh, 45_000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [user, refreshPermissions])

  const contextValue = useMemo(
    () => ({
      user,
      token,
      isLoading,
      logout,
      updateUser,
      refreshPermissions,
    }),
    [user, token, isLoading, logout, updateUser, refreshPermissions],
  )

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  )
}
