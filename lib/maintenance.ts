/**
 * Chế độ bảo trì (opt-in): khi bật, mọi route redirect về /bao-tri; API (trừ /api/health) trả 503.
 *
 * Mặc định: TẮT. Để bật bảo trì: MAINTENANCE_MODE=true trong .env / Vercel.
 */
export function isMaintenanceModeEnabled(): boolean {
  const raw = process.env.MAINTENANCE_MODE;
  if (raw === undefined || String(raw).trim() === '') {
    return false;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') {
    return false;
  }
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}
