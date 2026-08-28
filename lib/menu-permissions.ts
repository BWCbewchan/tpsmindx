import { filterManagementPermissions } from '@/lib/admin-permission-routes'

export function normalizeRoleToken(value?: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

export function checkHrefPermission(href: string, user: any): boolean {
  if (!user) return false

  // All user paths are accessible to any authenticated user
  if (href.startsWith('/user') || href.startsWith('/candidate-portal')) {
    return true
  }

  const normalizedRole = normalizeRoleToken(user.role)
  const isSuperAdmin =
    normalizedRole === 'super_admin' ||
    (user.userRoles || []).some(
      (code: string) => normalizeRoleToken(code) === 'super_admin',
    )

  if (isSuperAdmin) return true

  const targetPath = href.split('?')[0]

  if (targetPath === '/admin/system-metrics') {
    return false
  }

  // Check role codes for training input & management roles
  const roleCodes = (user.userRoles || []).map((code: string) => normalizeRoleToken(code))
  const hasManagementRole =
    ['manager', 'admin', 'super_admin'].includes(normalizedRole) ||
    roleCodes.some((code: string) => ['leader', 'te', 'tc', 'manager', 'admin', 'super_admin'].includes(code))

  const hasTrainingInputRole = roleCodes.some(
    (code: string) => code === 'hr' || code === 'te' || code === 'tf',
  )
  const isTrainingInputRoute =
    targetPath === '/admin/hr-candidates' ||
    targetPath.startsWith('/admin/hr-candidates/') ||
    targetPath === '/admin/hr-onboarding/videos'
  if (isTrainingInputRoute && hasTrainingInputRole) {
    return true
  }

  if (targetPath === '/admin/portfolio-qc' || targetPath === '/admin/portfolio') {
    return true
  }

  // Base permissions, deal-luong and portfolio-qc
  const MANAGER_DEFAULT_ROUTES = ['/admin/deal-luong', '/admin/tao-deal-luong', '/admin/portfolio-qc', '/admin/portfolio']
  const basePermissions = filterManagementPermissions(user.permissions || [])
  const permissions = Array.from(new Set([...basePermissions, ...MANAGER_DEFAULT_ROUTES]))

  const hasAnyK12Access = permissions.some((p) => {
    const normalizedPath = p.split('?')[0]
    return (
      normalizedPath === '/admin/page2' ||
      normalizedPath.startsWith('/admin/page2/')
    )
  })

  const hasAnyK12LeaderAccess = permissions.some((p) => {
    const normalizedPath = p.split('?')[0]
    return (
      normalizedPath === '/admin/quy-trinh-quy-dinh-leader' ||
      normalizedPath.startsWith('/admin/quy-trinh-quy-dinh-leader/')
    )
  })

  const k12Routes = hasAnyK12Access ? ['/admin/page2', '/admin/page2/manage'] : []
  const k12LeaderRoutes = (hasAnyK12LeaderAccess || hasManagementRole)
    ? ['/admin/quy-trinh-quy-dinh-leader', '/admin/quy-trinh-quy-dinh-leader/manage']
    : []

  const effectivePermissions = Array.from(
    new Set([...permissions, ...k12Routes, ...k12LeaderRoutes]),
  )

  const hasPermissionForHref = (h: string) => {
    const t = h.split('?')[0]
    return effectivePermissions.some(
      (p) =>
        t === p ||
        t.startsWith(`${p}/`) ||
        p.startsWith(`${t}/`),
    )
  }

  return hasPermissionForHref(href)
}

export function getFilteredAdminMenuItems(adminMenuItems: any[], user: any, pathname: string = ''): any[] {
  if (!user) return []

  const normalizedRole = normalizeRoleToken(user.role)
  const isSuperAdmin =
    normalizedRole === 'super_admin' ||
    (user.userRoles || []).some(
      (code: string) => normalizeRoleToken(code) === 'super_admin',
    )

  if (isSuperAdmin) return adminMenuItems

  const MANAGER_DEFAULT_ROUTES = ['/admin/deal-luong', '/admin/tao-deal-luong', '/admin/portfolio-qc', '/admin/portfolio']
  const basePermissions = filterManagementPermissions(user.permissions || [])
  const permissions = Array.from(new Set([...basePermissions, ...MANAGER_DEFAULT_ROUTES]))

  const roleCodes = (user.userRoles || []).map((code: string) =>
    normalizeRoleToken(code),
  )
  const hasManagementRole =
    ['manager', 'admin', 'super_admin'].includes(normalizedRole) ||
    roleCodes.some((code: string) => ['leader', 'te', 'tc', 'manager', 'admin', 'super_admin'].includes(code))

  const hasAnyK12Access = permissions.some((p) => {
    const normalizedPath = p.split('?')[0]
    return (
      normalizedPath === '/admin/page2' ||
      normalizedPath.startsWith('/admin/page2/')
    )
  })

  const hasAnyK12LeaderAccess = permissions.some((p) => {
    const normalizedPath = p.split('?')[0]
    return (
      normalizedPath === '/admin/quy-trinh-quy-dinh-leader' ||
      normalizedPath.startsWith('/admin/quy-trinh-quy-dinh-leader/')
    )
  })

  const k12Routes = hasAnyK12Access ? ['/admin/page2', '/admin/page2/manage'] : []
  const k12LeaderRoutes = (hasAnyK12LeaderAccess || hasManagementRole)
    ? ['/admin/quy-trinh-quy-dinh-leader', '/admin/quy-trinh-quy-dinh-leader/manage']
    : []

  const effectivePermissions = Array.from(
    new Set([...permissions, ...k12Routes, ...k12LeaderRoutes]),
  )

  const hasTrainingInputRole = roleCodes.some(
    (code: string) => code === 'hr' || code === 'te' || code === 'tf',
  )

  if (effectivePermissions.length === 0 && !hasTrainingInputRole) return []

  const hasPermissionForHref = (href: string) => {
    const targetPath = href.split('?')[0]
    return effectivePermissions.some(
      (p) =>
        targetPath === p ||
        targetPath.startsWith(`${p}/`) ||
        p.startsWith(`${targetPath}/`),
    )
  }

  const filterMenuItemsByPermissions = (items: any[]): any[] => {
    return items
      .map((item) => {
        const isK12TeacherGroup =
          item?.label === 'Quy Trình, Quy Định K12 Teaching' ||
          item?.label === 'Quy Trình, Quy Định K12 Teaching (Giáo Viên)' ||
          item?.groupLabel === 'Quy Trình K12' ||
          item?.groupLabel === 'Quy Trình K12 (Giáo Viên)' ||
          item?.label === 'Quy Trình K12'

        const isK12LeaderGroup =
          item?.label === 'Quy Trình, Quy Định K12 Teaching - Leader/TE/TC' ||
          item?.groupLabel === 'Quy Trình K12 Leader' ||
          item?.groupLabel === 'Quy Trình K12 (Leader/TE/TC)' ||
          item?.label === 'Quy Trình K12 Leader' ||
          item?.label === 'Quy Trình K12 (Leader/TE/TC)'

        if (
          isK12TeacherGroup &&
          (item?.submenu || item?.items)
        ) {
          const canOpenK12Group =
            hasPermissionForHref('/admin/page2') ||
            hasPermissionForHref('/admin/page2/manage') ||
            pathname.startsWith('/admin/page2')

          if (canOpenK12Group) {
            if (item.items) {
              const filteredSubItems = filterMenuItemsByPermissions(item.items)
              if (filteredSubItems.length > 0) {
                return { ...item, items: filteredSubItems }
              }
            } else if (item.submenu) {
              const filteredSubmenu = filterMenuItemsByPermissions(item.submenu)
              if (filteredSubmenu.length > 0) {
                return { ...item, submenu: filteredSubmenu }
              }
            }
          }
          return null
        }

        if (
          isK12LeaderGroup &&
          (item?.submenu || item?.items)
        ) {
          const canOpenLeaderGroup =
            hasManagementRole ||
            hasPermissionForHref('/admin/quy-trinh-quy-dinh-leader') ||
            hasPermissionForHref('/admin/quy-trinh-quy-dinh-leader/manage') ||
            pathname.startsWith('/admin/quy-trinh-quy-dinh-leader')

          if (canOpenLeaderGroup) {
            if (item.items) {
              const filteredSubItems = filterMenuItemsByPermissions(item.items)
              if (filteredSubItems.length > 0) {
                return { ...item, items: filteredSubItems }
              }
            } else if (item.submenu) {
              const filteredSubmenu = filterMenuItemsByPermissions(item.submenu)
              if (filteredSubmenu.length > 0) {
                return { ...item, submenu: filteredSubmenu }
              }
            }
          }
          return null
        }

        const isTrainingInputMenu = item?.href === '/admin/hr-candidates'
        if (isTrainingInputMenu && hasTrainingInputRole) {
          return item
        }

        if (item?.href === '/admin/system-metrics') {
          return null
        }

        if (item?.submenu && Array.isArray(item.submenu)) {
          const filteredChildren = filterMenuItemsByPermissions(item.submenu)
          if (filteredChildren.length > 0) {
            return { ...item, submenu: filteredChildren }
          }
          return null
        }

        if (item?.items && Array.isArray(item.items)) {
          const filteredChildren = filterMenuItemsByPermissions(item.items)
          if (filteredChildren.length > 0) {
            return { ...item, items: filteredChildren }
          }
          return null
        }

        if (item?.href) {
          if (hasPermissionForHref(item.href)) {
            return item
          }
          return null
        }

        if (item?.groupLabel) {
          return item
        }

        return null
      })
      .filter(Boolean)
  }

  return filterMenuItemsByPermissions(adminMenuItems)
}
