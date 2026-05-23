import { NextResponse } from 'next/server'

import { getBirthdayRecordsFromDataCache } from '@/lib/birthday-data-cache'
import { getCacheKey, setCacheEntry } from '@/lib/birthday-cache'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request): boolean {
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
        return process.env.NODE_ENV !== 'production'
    }

    const authHeader = request.headers.get('authorization') || ''
    return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: Request) {
    try {
        if (!isAuthorized(request)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const now = new Date()
        const month = now.getMonth() + 1
        const year = now.getFullYear()

        const records = await getBirthdayRecordsFromDataCache(month, year)

        // Mirror vào RAM cache để request đến cùng instance trả về cực nhanh.
        setCacheEntry(getCacheKey(month, year), {
            timestamp: Date.now(),
            birthdayData: records
        })

        return NextResponse.json({
            success: true,
            month,
            year,
            records: records.length,
            warmedAt: now.toISOString()
        })
    } catch (error) {
        console.error('[Birthdays Cron] Failed to prewarm birthday cache:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to prewarm birthday cache' },
            { status: 500 }
        )
    }
}
