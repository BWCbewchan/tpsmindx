import { getCacheEntry, getCacheKey, isCacheValid, setCacheEntry } from '@/lib/birthday-cache'
import { getBirthdayRecordsFromDataCache } from '@/lib/birthday-data-cache'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BIRTHDAY_GAS_URL = 'https://script.google.com/macros/s/AKfycbxgtpi2ZxtWxzcXwcfO-l0_Qy43sXgy97yIh7F1YX2TgxvH_5AdbxfjDM24l0CSQGDQhQ/exec'

interface Birthday {
    id: number
    name: string
    date: string
    month: number
    day: number
    teachingLevel: string
    email?: string
    username?: string
    area?: string
    masked?: boolean
    isCurrentUser?: boolean
    avatar_url?: string | null
}

interface TeacherListRecord {
    emailCongViec?: string
    usernameLms?: string
}

// Tuần trong tháng: tuần 1: 1-7, tuần 2: 8-14, tuần 3: 15-21, tuần 4: 22-hết tháng
function getCurrentWeek(day: number): number {
    if (day <= 7) return 1
    if (day <= 14) return 2
    if (day <= 21) return 3
    return 4
}

function getWeekRange(week: number, year: number, month: number): { start: number; end: number } {
    const daysInMonth = new Date(year, month, 0).getDate()
    if (week === 1) return { start: 1, end: 7 }
    if (week === 2) return { start: 8, end: 14 }
    if (week === 3) return { start: 15, end: 21 }
    return { start: 22, end: daysInMonth }
}

// Parse một record từ GAS response
// Actual GAS fields: hoVaTen, ngaySinh (DD/MM/YYYY), ngaySinhTrongThang, boPhan, emailCongViec
function parseBirthdayRecord(record: Record<string, unknown>, id: number, fallbackMonth: number): Birthday | null {
    const name = String(
        record.hoVaTen || record.name || record.Name || record.fullname ||
        record.teacher_name || record.HoTen || ''
    ).trim()
    if (!name) return null

    let day = 0
    let month = fallbackMonth

    // Ưu tiên ngaySinhTrongThang (đã là số ngày)
    if (record.ngaySinhTrongThang) {
        day = Number(record.ngaySinhTrongThang)
    }

    // Parse ngaySinh (DD/MM/YYYY) để lấy day và month chính xác
    if (record.ngaySinh) {
        const parts = String(record.ngaySinh).split('/')
        if (parts.length >= 2) {
            day = parseInt(parts[0])
            month = parseInt(parts[1])
        }
    } else if (record.birthday) {
        const parts = String(record.birthday).split('/')
        if (parts.length >= 2) {
            day = parseInt(parts[0])
            month = parseInt(parts[1])
        }
    } else if (record.date) {
        const dateStr = String(record.date)
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/')
            day = parseInt(parts[0])
            month = parseInt(parts[1])
        } else if (dateStr.includes('-')) {
            const parts = dateStr.split('-')
            month = parseInt(parts[1])
            day = parseInt(parts[2])
        }
    } else if (record.day && record.month) {
        day = Number(record.day)
        month = Number(record.month)
    }

    if (!day || day < 1 || day > 31 || month < 1 || month > 12) return null

    const teachingLevel = String(
        record.boPhan || record.teachingLevel || record.department ||
        record.programCurrent || record.KhoiGiangDay || ''
    ).trim() || null

    return {
        id,
        name,
        date: `${day} Tháng ${month}`,
        month,
        day,
        teachingLevel: teachingLevel || '',
        email: String(record.emailCongViec || record.email || record.Email || ''),
        username: String(record.usernameLms || record.username || ''),
        avatar_url: (record.avatar_url as string) || null,
    }
}

// Query sinh nhật từ bảng teachers trong DB
async function getBirthdaysFromDB(month: number): Promise<Record<string, unknown>[]> {
    try {
        const result = await pool.query(
            `SELECT
                t.code AS "usernameLms",
                t.full_name AS "hoVaTen",
                t.work_email AS "emailCongViec",
                COALESCE(NULLIF(t.course_line, ''), NULLIF(t.khoi_final, '')) AS "boPhan",
                t.main_centre AS area,
                t.birth_day AS "ngaySinhTrongThang",
                t.birth_month AS month,
                ta.avatar_url
             FROM teachers t
             LEFT JOIN teacher_avatars ta ON LOWER(t.work_email) = LOWER(ta.teacher_email)
             WHERE t.birth_month = $1
               AND t.birth_day IS NOT NULL
               AND t.birth_day > 0
               AND t.status = 'Active'
             ORDER BY t.birth_day ASC`,
            [month]
        )
        return result.rows
    } catch (err) {
        console.error('[Birthdays DB] Query failed:', err)
        return []
    }
}

// Fetch leader.area của một giáo viên — từ DB (nhanh hơn GAS)
async function fetchTeacherArea(username: string): Promise<string | null> {
    if (!username) return null
    try {
        const result = await pool.query(
            'SELECT main_centre FROM teachers WHERE code = $1 LIMIT 1',
            [username]
        )
        return result.rows[0]?.main_centre || null
    } catch {
        return null
    }
}

// Resolve usernameLms từ email — từ DB (nhanh hơn GAS)
async function resolveUsernameFromEmail(email: string): Promise<string | null> {
    if (!email) return null
    try {
        const result = await pool.query(
            'SELECT code FROM teachers WHERE work_email ILIKE $1 LIMIT 1',
            [email.trim()]
        )
        return result.rows[0]?.code || null
    } catch {
        return null
    }
}

// Lấy danh sách email đã tắt show_birthday từ DB
async function fetchHiddenBirthdayEmails(): Promise<Set<string>> {
    try {
        const result = await pool.query(
            `SELECT teacher_email FROM teacher_privacy_settings WHERE show_birthday = false`
        )
        return new Set(result.rows.map((r: { teacher_email: string }) => r.teacher_email.toLowerCase()))
    } catch {
        return new Set()
    }
}

// Mask tên: giữ họ, viết tắt các từ còn lại. Vd: "Nguyễn Thị Hương" → "Nguyễn T. H."
function maskName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length <= 1) return parts[0][0] + '.'
    const lastName = parts[0]
    const initials = parts.slice(1).map(w => w[0].toUpperCase() + '.').join(' ')
    return `${lastName} ${initials}`
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireBearerSession(request)
        if (!auth.ok) return auth.response

        const loginEmail = auth.sessionEmail
        const normalizedLoginEmail = loginEmail.toLowerCase()

        // Ưu tiên lấy usernameLms chính xác từ emailCongViec (chỉ theo email trong token)
        const resolvedUsername = loginEmail ? await resolveUsernameFromEmail(loginEmail) : null
        const username = resolvedUsername || ''

        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()
        const currentDay = now.getDate()

        const currentWeek = getCurrentWeek(currentDay)
        const weekRange = getWeekRange(currentWeek, currentYear, currentMonth)

        // Không cần fetch userArea nữa — hiển thị toàn bộ không lọc khu vực
        const userArea = null

        const cacheKey = getCacheKey(currentMonth, currentYear)
        const cachedEntry = getCacheEntry(cacheKey)
        const isCached = cachedEntry && isCacheValid(cachedEntry)

        console.log(`[Birthdays API] Cache check - key: ${cacheKey}, valid: ${isCached}`)

        // Fetch data: ưu tiên DB, fallback GAS nếu DB không có data
        let birthdayRecords: Record<string, unknown>[]
        let hiddenEmails: Set<string>

        // Thử lấy từ DB trước
        const dbRecords = await getBirthdaysFromDB(currentMonth)
        const useDB = dbRecords.length > 0

        if (useDB) {
            console.log(`[Birthdays API] Using DB data - ${dbRecords.length} records`)
            birthdayRecords = dbRecords
            hiddenEmails = await fetchHiddenBirthdayEmails()
        } else if (isCached) {
            // Use cached GAS data
            console.log(`[Birthdays API] Using cached GAS data`)
            birthdayRecords = cachedEntry!.birthdayData
            hiddenEmails = await fetchHiddenBirthdayEmails()
            hiddenEmails = await fetchHiddenBirthdayEmails()
        } else {
            console.log(`[Birthdays API] Fetching data from Vercel cache + DB`)
            
            // Fetch birthday list và hidden emails song song (userArea đã fetch ở trên)
            const [cachedBirthdayRecords, fetchedHiddenEmails] = await Promise.all([
                getBirthdayRecordsFromDataCache(currentMonth, currentYear),
                fetchHiddenBirthdayEmails()
            ])

            birthdayRecords = cachedBirthdayRecords

            hiddenEmails = fetchedHiddenEmails

            // Update cache
            console.log(`[Birthdays API] Saved to cache - key: ${cacheKey}, records: ${birthdayRecords.length}, hidden: ${hiddenEmails.size}`)
            setCacheEntry(cacheKey, {
                timestamp: Date.now(),
                birthdayData: birthdayRecords
            })
        }

        // Parse và filter theo tuần hiện tại
        const weekBirthdays: Birthday[] = []
        let idCounter = 1

        for (const record of birthdayRecords) {
            const birthday = parseBirthdayRecord(record, idCounter, currentMonth)
            if (!birthday) continue
            if (birthday.day >= weekRange.start && birthday.day <= weekRange.end) {
                weekBirthdays.push(birthday)
                idCounter++
            }
        }

        weekBirthdays.sort((a, b) => a.day - b.day)

        // Áp dụng privacy: mask tên nếu show_birthday = false
        let maskedCount = 0
        for (const b of weekBirthdays) {
            if (b.email && hiddenEmails.has(b.email.toLowerCase())) {
                b.name = maskName(b.name)
                b.masked = true
                maskedCount++
            }

            b.isCurrentUser = Boolean(
                (normalizedLoginEmail && b.email?.toLowerCase() === normalizedLoginEmail) ||
                (resolvedUsername && b.username === resolvedUsername)
            )
        }
        
        console.log(`[Birthdays API] Privacy applied - total: ${weekBirthdays.length}, masked: ${maskedCount}`)

        const birthdays = weekBirthdays

        console.log(`[Birthdays API] Response - count: ${birthdays.length}, fromCache: ${isCached}`)

        return NextResponse.json({
            success: true,
            data: birthdays,
            month: currentMonth,
            year: currentYear,
            week: currentWeek,
            weekRange,
            userArea: userArea || null,
            resolvedUsernameLms: resolvedUsername,
            usernameUsed: username || null,
            fromCache: isCached,
            count: birthdays.length
        })
    } catch (error) {
        console.error('Error fetching birthdays:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch birthdays' },
            { status: 500 }
        )
    }
}
