const MANAGEMENT_EXCLUDED_ROUTES = new Set(['/checkdatasource', '/user/checkdatasource'])

function normalizeRoutePath(routePath: string): string {
  const [path] = routePath.trim().split('?')
  const normalized = path.replace(/\/+$/, '')
  return normalized || '/'
}

export function isManagementPermissionRoute(routePath: string): boolean {
  return !MANAGEMENT_EXCLUDED_ROUTES.has(normalizeRoutePath(routePath))
}

export function filterManagementPermissions(routePaths: string[]): string[] {
  const paths = routePaths.filter((path) => typeof path === 'string').map(normalizeRoutePath)
  // Legacy catalog used /portfolio for SPCK and /portfolio/portfolios for
  // the list. Convert only an identifiable legacy set; a modern list-only
  // grant must never acquire SPCK/editor access.
  const legacy = paths.includes('/admin/portfolio/portfolios')
  return Array.from(new Set(paths.map((path) => {
    if (!legacy) return path
    if (path === '/admin/portfolio/portfolios') return '/admin/portfolio'
    if (path === '/admin/portfolio') return '/admin/kiem-soat-spck'
    return path
  }).filter(isManagementPermissionRoute)))
}
