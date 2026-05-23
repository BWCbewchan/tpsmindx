/**
 * Teaching leaders: nhiều khu vực lưu trong `areas` (JSONB array).
 * Cột `area` giữ phần tử đầu (tương thích cũ / sort).
 */

export function getLeaderAreas(row: {
  area?: string | null
  areas?: unknown
}): string[] {
  const raw = row.areas
  if (raw != null) {
    if (Array.isArray(raw)) {
      return raw.map(String).map((s) => s.trim()).filter(Boolean)
    }
    if (typeof raw === 'string') {
      try {
        const p = JSON.parse(raw) as unknown
        if (Array.isArray(p)) {
          return p.map(String).map((s) => s.trim()).filter(Boolean)
        }
      } catch {
        /* ignore */
      }
    }
    if (typeof raw === 'object') {
      const arr = raw as { length?: number; [k: number]: unknown }
      if (typeof arr.length === 'number') {
        return Array.from({ length: arr.length }, (_, i) =>
          String(arr[i] ?? '').trim(),
        ).filter(Boolean)
      }
    }
  }
  const a = row.area
  if (a != null && String(a).trim()) {
    return String(a)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

export function primaryAreaFromAreas(areas: string[]): string | null {
  return areas[0] ?? null
}

/** Kéo leader từ khu vực `fromRegion` sang `toRegion`: bỏ gắn cũ, thêm khu vực đích (không trùng). */
export function computeAreasAfterRegionMove(
  leader: { area?: string | null; areas?: unknown },
  fromRegion: string,
  toRegion: string,
): string[] {
  if (fromRegion === toRegion) return getLeaderAreas(leader)
  const cur = getLeaderAreas(leader)
  return [...new Set([...cur.filter((a) => a !== fromRegion), toRegion])]
}
