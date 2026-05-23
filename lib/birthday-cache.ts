// Shared birthday cache management
// Cache interface
export interface BirthdaysCacheEntry {
    timestamp: number
    birthdayData: Record<string, unknown>[]
}

// In-memory cache với TTL 1 giờ
const CACHE_TTL = 60 * 60 * 1000 // 1 hour
let cache: { [key: string]: BirthdaysCacheEntry } = {}

export function getCacheKey(month: number, year: number): string {
    return `birthdays-${year}-${month}`
}

export function isCacheValid(entry: BirthdaysCacheEntry): boolean {
    return Date.now() - entry.timestamp < CACHE_TTL
}

export function setCacheEntry(key: string, entry: BirthdaysCacheEntry): void {
    cache[key] = entry
}

export function getCacheEntry(key: string): BirthdaysCacheEntry | undefined {
    return cache[key]
}

// Invalidate cache cho tháng cụ thể
export function invalidateBirthdaysCache(month: number, year: number): void {
    const key = getCacheKey(month, year)
    delete cache[key]
    console.log(`[Cache] Invalidated birthdays cache for ${year}-${month}`)
}

// Invalidate all birthdays cache
export function invalidateAllBirthdaysCache(): void {
    cache = {}
    console.log('[Cache] Invalidated all birthdays cache')
}

// Invalidate cache cho tháng hiện tại + tháng liền kề (để safe)
export function invalidateCurrentAndNeighboringMonths(): void {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Invalidate tháng hiện tại
    invalidateBirthdaysCache(currentMonth, currentYear)

    // Invalidate tháng trước
    if (currentMonth === 1) {
        invalidateBirthdaysCache(12, currentYear - 1)
    } else {
        invalidateBirthdaysCache(currentMonth - 1, currentYear)
    }

    // Invalidate tháng sau
    if (currentMonth === 12) {
        invalidateBirthdaysCache(1, currentYear + 1)
    } else {
        invalidateBirthdaysCache(currentMonth + 1, currentYear)
    }
}
