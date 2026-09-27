import { filterManagementPermissions } from '@/lib/admin-permission-routes'

export function normalizeRoleToken(value?: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function hasExplicitGrant(user: any, path: string): boolean {
  if (!user || user.isActive === false) return false
  if (normalizeRoleToken(user.role) === 'super_admin') return true
  return filterManagementPermissions(user.permissions || []).some(
    (grant) => grant.split(/[?#]/)[0].replace(/\/+$/, '') === path,
  )
}

// Editing is an explicit capability, independent of the role's display code.
// A list-only Portfolio grant must not permit editing, deleting or publishing.
export function isPortfolioEditorUser(user: any): boolean {
  return hasExplicitGrant(user, '/admin/kiem-soat-spck') ||
    hasExplicitGrant(user, '/admin/portfolio/builder')
}

export function isPortfolioReadOnlyLeaderUser(user: any): boolean {
  return isPortfolioAllowedUser(user) && !isPortfolioEditorUser(user)
}

export function isPortfolioManagementRoutePath(path: string): boolean {
  const targetPath = path.split('?')[0]
  return targetPath === '/admin/portfolio' || targetPath === '/admin/portfolio/'
}

export function isPortfolioBuilderRoutePath(path: string): boolean {
  const targetPath = path.split('?')[0]
  return targetPath === '/admin/portfolio/builder' || targetPath.startsWith('/admin/portfolio/builder/')
}

export function isSpckSubmissionRoutePath(path: string): boolean {
  const targetPath = path.split('?')[0]
  return (
    targetPath === '/admin/kiem-soat-spck' ||
    targetPath.startsWith('/admin/kiem-soat-spck/')
  )
}

export function isPortfolioRoutePath(path: string): boolean {
  const targetPath = path.split('?')[0]
  return (
    isSpckSubmissionRoutePath(targetPath) ||
    isPortfolioManagementRoutePath(targetPath) ||
    isPortfolioBuilderRoutePath(targetPath)
  )
}

export function isPortfolioAllowedUser(user: any): boolean {
  return hasExplicitGrant(user, '/admin/portfolio') || isPortfolioEditorUser(user)
}

export function canAccessPortfolioPath(user: any, path: string): boolean {
  if (isPortfolioManagementRoutePath(path)) {
    return hasExplicitGrant(user, '/admin/portfolio')
  }
  if (isPortfolioBuilderRoutePath(path) || isSpckSubmissionRoutePath(path)) {
    return isPortfolioEditorUser(user)
  }
  return false
}

/** One policy for navigation, page guards and server API checks.
 * A grant includes descendants, never ancestors or similarly named siblings.
 * Separately configured management/editor screens need their own grant.
 */
export function checkHrefPermission(href: string, user: any): boolean {
  if (!user || user.isActive === false) return false
  const path = href.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  if (path === '/user' || path.startsWith('/user/') ||
      path === '/candidate-portal' || path.startsWith('/candidate-portal/')) return true
  if (normalizeRoleToken(user.role) === 'super_admin') return true
  if (path === '/admin/system-metrics' || path.startsWith('/admin/system-metrics/')) return false
  if (path === '/admin/profile') return Boolean(user.isAdmin)
  if (isPortfolioRoutePath(path)) return canAccessPortfolioPath(user, path)
  const separateScreens = ['/admin/page2/manage', '/admin/quy-trinh-quy-dinh-leader/manage']
  const separateScreen = separateScreens.find((route) => path === route || path.startsWith(`${route}/`))
  if (separateScreen) return hasExplicitGrant(user, separateScreen)
  return filterManagementPermissions(user.permissions || []).some((permission) => {
    const grant = permission.split(/[?#]/)[0].replace(/\/+$/, '')
    return grant.startsWith('/admin/') && (path === grant || path.startsWith(`${grant}/`))
  })
}

export function getFilteredAdminMenuItems(adminMenuItems: any[], user: any, _pathname = ''): any[] {
  if (!user) return []
  return adminMenuItems.flatMap((item) => {
    const childKey = Array.isArray(item.submenu) ? 'submenu' : Array.isArray(item.items) ? 'items' : null
    if (childKey) {
      const children = getFilteredAdminMenuItems(item[childKey], user)
      return children.length ? [{ ...item, [childKey]: children }] : []
    }
    return item.href && checkHrefPermission(item.href, user) ? [item] : []
  })
}
