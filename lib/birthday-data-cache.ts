import { unstable_cache } from 'next/cache'

const BIRTHDAY_GAS_URL = 'https://script.google.com/macros/s/AKfycbxgtpi2ZxtWxzcXwcfO-l0_Qy43sXgy97yIh7F1YX2TgxvH_5AdbxfjDM24l0CSQGDQhQ/exec'

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

function extractBirthdayRecords(payload: unknown): Record<string, unknown>[] {
    if (Array.isArray(payload)) {
        return payload as Record<string, unknown>[]
    }

    if (payload && typeof payload === 'object') {
        const data = (payload as { data?: unknown }).data
        if (Array.isArray(data)) {
            return data as Record<string, unknown>[]
        }

        const result = (payload as { result?: unknown }).result
        if (Array.isArray(result)) {
            return result as Record<string, unknown>[]
        }

        const teachers = (payload as { teachers?: unknown }).teachers
        if (Array.isArray(teachers)) {
            return teachers as Record<string, unknown>[]
        }
    }

    return []
}

export function getBirthdayMonthTag(month: number, year: number): string {
    return `birthdays-month-${year}-${month}`
}

export async function getBirthdayRecordsFromDataCache(month: number, year: number): Promise<Record<string, unknown>[]> {
    const cacheTag = getBirthdayMonthTag(month, year)

    const fetchCachedRecords = unstable_cache(
        async () => {
            const response = await fetch(`${BIRTHDAY_GAS_URL}?action=birthday&month=${month}`, { cache: 'no-store' })
            if (!response.ok) {
                throw new Error(`GAS responded with status: ${response.status}`)
            }

            const payload = await response.json()
            return extractBirthdayRecords(payload)
        },
        [`birthday-records-${year}-${month}`],
        {
            revalidate: ONE_WEEK_SECONDS,
            tags: [cacheTag]
        }
    )

    return fetchCachedRecords()
}
