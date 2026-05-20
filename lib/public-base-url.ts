/**
 * URL công khai của app (email / webhook gọi lại chính nó).
 * Một lỗi hay gặp: gõ nhầm TLD `.ngro` thay vì ngrok → ERR_NAME_NOT_RESOLVED.
 * Chuẩn hóa sang `.ngrok-free.app` (free tier phổ biến).
 */
export function getPublicBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!raw) return 'http://localhost:3000';
  try {
    const u = new URL(raw);
    if (/\.ngro$/i.test(u.hostname)) {
      u.hostname = u.hostname.replace(/\.ngro$/i, '.ngrok-free.app');
      return u.origin;
    }
    return raw.replace(/\/+$/, '');
  } catch {
    return 'http://localhost:3000';
  }
}
