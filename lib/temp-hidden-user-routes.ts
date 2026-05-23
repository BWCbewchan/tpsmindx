/**
 * Tạm ẩn route khu vực user (menu + onboarding + truy cập trực tiếp).
 * Bật lại: xóa path khỏi `TEMP_HIDDEN_USER_PATHS`.
 */
export const TEMP_HIDDEN_USER_PATHS = new Set<string>([
])

export function isTempHiddenUserRoute(pathname: string): boolean {
  const base = pathname.split('?')[0] ?? pathname
  return TEMP_HIDDEN_USER_PATHS.has(base)
}
