/**
 * Quy ước: cột TIMESTAMP (không TZ) `bat_dau_luc` / `ket_thuc_luc` trong `event_schedules`
 * lưu "đồng hồ tường" theo Việt Nam. Server Node / driver không được tự đoán múi giờ.
 */

export const EVENT_SCHEDULE_WALL_IANA = 'Asia/Ho_Chi_Minh' as const

const VN_OFFSET_NUMERIC = '+07:00'

/**
 * Đọc từ Postgres: TIMESTAMP không TZ → coi là giờ VN → timestamptz đúng instant (node-pg → Date).
 */
export function eventScheduleTsAsTimestamptz(
  tableAlias: string,
  column: string,
  asName: string = column,
): string {
  return `${eventScheduleTsInstantExpr(tableAlias, column)} AS ${asName}`
}

/** Biểu thức timestamptz (không `AS …`) — dùng trong WHERE / COALESCE. */
export function eventScheduleTsInstantExpr(tableAlias: string, column: string): string {
  return `(${tableAlias}.${column} AT TIME ZONE '${EVENT_SCHEDULE_WALL_IANA}')`
}

function hasExplicitZoneOrOffset(s: string): boolean {
  const t = s.trim()
  if (/[zZ]\s*$/.test(t)) return true
  // ...+07:00 or ...-05:00 (ISO offset); avoid matching date-only minus parts
  return /[+-]\d{2}:\d{2}\s*$/.test(t)
}

/**
 * Chuẩn hoá input từ client (ISO có/không offset, hoặc naive) → chuỗi lưu DB
 * `YYYY-MM-DD HH:mm:ss` theo giờ tường Việt Nam (dùng cho cột TIMESTAMP không TZ).
 */
export function parseToVnWallStorage(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  let instant: Date

  if (hasExplicitZoneOrOffset(trimmed)) {
    const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
    instant = new Date(normalized)
  } else {
    const normalized = trimmed.replace(' ', 'T')
    const m = normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/,
    )
    if (m) {
      const [, y, mo, d, hh = '00', mm = '00', ss, frac] = m
      const sec = (ss ?? '0').padStart(2, '0')
      const ms = frac != null ? `.${frac.padEnd(3, '0').slice(0, 3)}` : ''
      instant = new Date(`${y}-${mo}-${d}T${hh}:${mm}:${sec}${ms}${VN_OFFSET_NUMERIC}`)
    } else {
      instant = new Date(trimmed)
    }
  }

  if (Number.isNaN(instant.getTime())) return null

  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: EVENT_SCHEDULE_WALL_IANA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  return fmt.format(instant)
}

/** So sánh hai giá trị đã chuẩn hoá từ `parseToVnWallStorage` (cùng ý nghĩa giờ VN). */
export function vnWallStorageSqlToInstantMs(sqlTs: string): number {
  const t = sqlTs.trim().replace(' ', 'T')
  return new Date(`${t}${VN_OFFSET_NUMERIC}`).getTime()
}
