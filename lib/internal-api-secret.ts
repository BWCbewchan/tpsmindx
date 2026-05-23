/**
 * Secret nội bộ — chỉ dùng trong Route Handlers / Server Actions.
 * Trong `.env` đặt `API_SECRET=...` (không prefix `NEXT_PUBLIC_`, không bundle ra client).
 */
export function getApiSecret(): string {
  return process.env.API_SECRET?.trim() ?? '';
}
