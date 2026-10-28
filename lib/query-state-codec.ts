export type QueryValue = string | number | boolean | null | string[]
export type QueryOptions = {
  values?: readonly string[]
  min?: number
  max?: number
  maxLength?: number
  history?: 'push' | 'replace'
  kind?: 'date' | 'boolean' | 'month' | 'year'
}

export function readQueryValue<T extends QueryValue>(params: URLSearchParams, key: string, fallback: T, options: QueryOptions = {}): T {
  if (!params.has(key)) return fallback
  const raw = params.get(key) || ''
  const maxLength = options.maxLength ?? 500
  if (Array.isArray(fallback)) {
    const values = params.getAll(key)
    if (values.length > 100 || values.some(v => v.length > maxLength || (options.values && !options.values.includes(v)))) return fallback
    return [...new Set(values)] as T
  }
  if (raw.length > maxLength || (options.values && !options.values.includes(raw))) return fallback
  if (options.kind === 'month' && raw !== fallback && !/^(?:[1-9]|0[1-9]|1[0-2]|\d{4}-(?:0[1-9]|1[0-2]))$/.test(raw)) return fallback
  if (options.kind === 'year' && raw !== fallback && (!/^\d{4}$/.test(raw) || Number(raw) < 1900 || Number(raw) > 2200)) return fallback
  if (options.kind === 'date') {
    const parsed = new Date(`${raw}T12:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) return fallback
  }
  if (options.kind === 'boolean') return (raw === 'true' ? true : raw === 'false' ? false : fallback) as T
  if (typeof fallback === 'number') {
    if (!/^\d+$/.test(raw)) return fallback
    const value = Number(raw)
    return Number.isSafeInteger(value) && value >= (options.min ?? 1) && value <= (options.max ?? 100000) ? value as T : fallback
  }
  if (typeof fallback === 'boolean') return (raw === 'true' ? true : raw === 'false' ? false : fallback) as T
  return raw as T
}

export function writeQueryValue<T extends QueryValue>(url: URL, key: string, value: T, fallback: T): URL {
  const next = new URL(url)
  next.searchParams.delete(key)
  if (JSON.stringify(value) === JSON.stringify(fallback) || value === null || value === '') return next
  if (Array.isArray(value)) value.forEach(item => next.searchParams.append(key, item))
  else next.searchParams.set(key, String(value))
  return next
}
