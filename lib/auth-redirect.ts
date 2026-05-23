const LOGIN_PATH = '/login'

export function resolveSafeAuthRedirect(
  rawRedirect: string | null | undefined,
  origin: string,
): string | null {
  const value = rawRedirect?.trim()
  if (!value) return null

  const isSameOriginCandidate =
    value.startsWith('/') || value.toLowerCase().startsWith(`${origin.toLowerCase()}/`)
  if (!isSameOriginCandidate) return null

  try {
    const url = new URL(value, origin)
    if (url.origin !== origin) return null
    if (url.pathname === LOGIN_PATH) return null

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function buildLoginRedirectPath(
  requestedPath: string,
  origin: string,
): string {
  const safeRequestedPath = resolveSafeAuthRedirect(requestedPath, origin)
  const loginUrl = new URL(LOGIN_PATH, origin)

  if (safeRequestedPath) {
    loginUrl.searchParams.set('next', safeRequestedPath)
  }

  return `${loginUrl.pathname}${loginUrl.search}`
}
