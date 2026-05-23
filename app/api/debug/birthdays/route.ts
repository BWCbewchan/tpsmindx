import { NextResponse } from 'next/server'
import pool from '@/lib/db'

const BIRTHDAY_GAS_URL = 'https://script.google.com/macros/s/AKfycbxgtpi2ZxtWxzcXwcfO-l0_Qy43sXgy97yIh7F1YX2TgxvH_5AdbxfjDM24l0CSQGDQhQ/exec'

/**
 * Debug endpoint để kiểm tra birthday functionality
 * GET /api/debug/birthdays?email=xxxxx
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    try {
        const { searchParams } = new URL(request.url)
        const email = (searchParams.get('email') || '').trim()

        const debug: Record<string, any> = {
            timestamp: new Date().toISOString(),
            email_provided: email,
            errors: [],
            tests: {}
        }

        // 1. Test GAS API - birthday list
        try {
            console.log('[Debug] Testing GAS API - birthday list')
            const now = new Date()
            const month = now.getMonth() + 1
            
            const gasRes = await fetch(`${BIRTHDAY_GAS_URL}?action=birthday&month=${month}`, {
                cache: 'no-store',
                method: 'GET',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            })

            const gasData = await gasRes.json()
            debug.tests!.gas_birthday_api = {
                status: gasRes.status,
                ok: gasRes.ok,
                response_type: typeof gasData,
                is_array: Array.isArray(gasData),
                keys: gasData ? Object.keys(gasData) : [],
                sample: Array.isArray(gasData) ? gasData[0] : gasData?.data?.[0],
                total_records: Array.isArray(gasData) ? gasData.length : gasData?.data?.length
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err)
            debug.errors!.push(`GAS birthday API failed: ${error}`)
            debug.tests!.gas_birthday_api = { error }
        }

        // 2. Test GAS API - email resolution (list all teachers)
        let resolvedUsername: string | null = null
        if (email) {
            let matchedTeacher: any = null
            try {
                console.log('[Debug] Testing GAS API - email resolution')
                const listRes = await fetch(
                    `${BIRTHDAY_GAS_URL}?action=list&status=${encodeURIComponent('Đang làm')}`,
                    { cache: 'no-store', method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } }
                )

                const listData = await listRes.json()
                const records = Array.isArray(listData?.data) ? listData.data : []
                
                // Try to find matching email
                matchedTeacher = records.find((record: any) => {
                    const workEmail = String(record.emailCongViec || '').trim().toLowerCase()
                    return workEmail === email.toLowerCase()
                })

                debug.tests!.gas_teacher_list = {
                    status: listRes.status,
                    ok: listRes.ok,
                    total_teachers: records.length,
                    email_normalized: email.toLowerCase(),
                    matched_teacher: matchedTeacher ? {
                        emailCongViec: matchedTeacher.emailCongViec,
                        usernameLms: matchedTeacher.usernameLms,
                        hoVaTen: matchedTeacher.hoVaTen
                    } : null,
                    sample_record: records[0]
                }

                if (matchedTeacher?.usernameLms) {
                    resolvedUsername = matchedTeacher.usernameLms
                }
            } catch (err) {
                const error = err instanceof Error ? err.message : String(err)
                debug.errors!.push(`GAS teacher list API failed: ${error}`)
                debug.tests!.gas_teacher_list = { error }
            }

            // 3. Test username resolution and area fetch
            if (resolvedUsername) {
                const username = resolvedUsername
                try {
                    console.log(`[Debug] Testing GAS API - fetch area for username: ${username}`)
                    const areaRes = await fetch(
                        `${BIRTHDAY_GAS_URL}?username=${encodeURIComponent(username)}`,
                        { cache: 'no-store', method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } }
                    )

                    const areaData = await areaRes.json()
                    debug.tests!.gas_teacher_profile = {
                        status: areaRes.status,
                        ok: areaRes.ok,
                        username_queried: username,
                        area: areaData?.data?.leader?.area || areaData?.data?.khuVucLamViec || null,
                        full_response_keys: areaData ? Object.keys(areaData) : []
                    }
                } catch (err) {
                    const error = err instanceof Error ? err.message : String(err)
                    debug.errors!.push(`GAS teacher profile API failed: ${error}`)
                    debug.tests!.gas_teacher_profile = { error }
                }
            }
        }

        // 4. Test database - fetch privacy settings
        if (email) {
            try {
                console.log('[Debug] Testing DB - fetch privacy settings')
                const dbRes = await pool.query(
                    `SELECT * FROM teacher_privacy_settings WHERE teacher_email = $1`,
                    [email]
                )

                debug.tests!.database_privacy = {
                    email_queried: email,
                    settings_exist: dbRes.rows.length > 0,
                    settings: dbRes.rows[0] || {
                        note: 'Create default (show_birthday=true) when first request'
                    }
                }
            } catch (err) {
                const error = err instanceof Error ? err.message : String(err)
                debug.errors!.push(`Database privacy settings query failed: ${error}`)
                debug.tests!.database_privacy = { error }
            }
        }

        // 5. Test database - fetch all hidden emails
        try {
            console.log('[Debug] Testing DB - fetch hidden birthdays')
            const hiddenRes = await pool.query(
                `SELECT teacher_email FROM teacher_privacy_settings WHERE show_birthday = false`
            )

            debug.tests!.database_hidden_birthdays = {
                total_hidden: hiddenRes.rows.length,
                email_normalized: email.toLowerCase(),
                user_is_hidden: hiddenRes.rows.some((r: any) => r.teacher_email.toLowerCase() === email.toLowerCase()),
                sample_hidden: hiddenRes.rows.slice(0, 3)
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err)
            debug.errors!.push(`Database hidden birthdays query failed: ${error}`)
            debug.tests!.database_hidden_birthdays = { error }
        }

        return NextResponse.json(debug, { status: 200 })
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error, timestamp: new Date().toISOString() }, { status: 500 })
    }
}
