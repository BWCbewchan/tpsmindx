import { getApiSecret } from '@/lib/internal-api-secret'
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getBirthdayRecordsFromDataCache } from '@/lib/birthday-data-cache'

export const dynamic = 'force-dynamic'

// POST /api/birthdays/sync — sync dữ liệu sinh nhật từ GAS vào bảng teachers
// Gọi thủ công hoặc từ cron job
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const secret = body.secret || request.headers.get('x-api-key')
        const expected = getApiSecret()
        if (!expected || secret !== expected) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let synced = 0
        let skipped = 0
        let errors = 0

        // Fetch tất cả tháng (1-12) từ GAS cache
        for (let month = 1; month <= 12; month++) {
            try {
                const records = await getBirthdayRecordsFromDataCache(month, new Date().getFullYear())
                for (const record of records) {
                    try {
                        const name = String(record.hoVaTen || record.name || '').trim()
                        const email = String(record.emailCongViec || record.email || '').trim().toLowerCase()
                        const username = String(record.usernameLms || record.username || '').trim()

                        if (!email && !username) { skipped++; continue }

                        // Parse ngày sinh
                        let day = 0, bMonth = month
                        if (record.ngaySinh) {
                            const parts = String(record.ngaySinh).split('/')
                            if (parts.length >= 2) { day = parseInt(parts[0]); bMonth = parseInt(parts[1]) }
                        } else if (record.ngaySinhTrongThang) {
                            day = Number(record.ngaySinhTrongThang)
                        }
                        if (!day || day < 1 || day > 31) { skipped++; continue }

                        const birthdayStr = `${String(day).padStart(2, '0')}/${String(bMonth).padStart(2, '0')}`

                        // Update teachers bằng email hoặc username
                        const result = await pool.query(
                            `UPDATE teachers
                             SET birthday = $1, birth_day = $2, birth_month = $3
                             WHERE (work_email ILIKE $4 OR code = $5)
                               AND (birthday IS NULL OR birthday != $1)
                             RETURNING code`,
                            [birthdayStr, day, bMonth, email, username]
                        )

                        if (result.rowCount && result.rowCount > 0) synced++
                        else skipped++
                    } catch { errors++ }
                }
            } catch (err) {
                console.error(`[Birthday Sync] Month ${month} failed:`, err)
            }
        }

        return NextResponse.json({ success: true, synced, skipped, errors })
    } catch (error) {
        console.error('[Birthday Sync] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
