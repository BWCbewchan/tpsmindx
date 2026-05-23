/** Header Authorization Bearer cho API yêu cầu xác định phiên đăng nhập. */
export function authHeaders(token: string | null | undefined): HeadersInit {
  if (!token?.trim()) return {}
  return { Authorization: `Bearer ${token.trim()}` }
}
