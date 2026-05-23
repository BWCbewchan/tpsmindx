import { NextResponse } from 'next/server'

import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

interface WishRow {
    id: number
    sender_name: string
    message: string
    created_at: string
}

function normalizeArea(area: unknown): string | null {
    const value = String(area || '').trim()
    return value.length > 0 ? value : null
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const month = Number(searchParams.get('month'))
        const week = Number(searchParams.get('week'))
        const year = Number(searchParams.get('year'))
        const area = normalizeArea(searchParams.get('area'))

        if (!month || !week || !year) {
            return NextResponse.json(
                { success: false, error: 'Thiếu month/week/year' },
                { status: 400 }
            )
        }

        const result = await pool.query<WishRow>(
            `SELECT id, sender_name, message, created_at
             FROM birthday_wishes
             WHERE month = $1
               AND week = $2
               AND year = $3
               AND ($4::text IS NULL OR area = $4)
             ORDER BY created_at DESC
             LIMIT 200`,
            [month, week, year, area]
        )

        const data = result.rows.map((row) => ({
            id: row.id,
            senderName: row.sender_name,
            message: row.message,
            createdAt: row.created_at,
        }))

        return NextResponse.json({
            success: true,
            data,
            count: data.length,
        })
    } catch (error) {
        console.error('Error fetching birthday wishes:', error)
        return NextResponse.json(
            { success: false, error: 'Không tải được lời chúc' },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()

        const month = Number(body?.month)
        const week = Number(body?.week)
        const year = Number(body?.year)
        const area = normalizeArea(body?.area)
        const senderName = String(body?.senderName || '').trim() || 'Giáo viên MindX'
        const senderEmail = String(body?.senderEmail || '').trim().toLowerCase()
        const message = String(body?.message || '').trim()
        const birthdayNames = Array.isArray(body?.birthdayNames)
            ? body.birthdayNames
                .map((name: unknown) => String(name || '').trim())
                .filter(Boolean)
                .join(', ')
            : ''

        if (!month || !week || !year) {
            return NextResponse.json(
                { success: false, error: 'Thiếu month/week/year' },
                { status: 400 }
            )
        }

        if (!senderEmail) {
            return NextResponse.json(
                { success: false, error: 'Thiếu email người gửi' },
                { status: 400 }
            )
        }

        if (!message) {
            return NextResponse.json(
                { success: false, error: 'Vui lòng nhập nội dung lời chúc' },
                { status: 400 }
            )
        }

        if (message.length > 500) {
            return NextResponse.json(
                { success: false, error: 'Lời chúc tối đa 500 ký tự' },
                { status: 400 }
            )
        }

        const inserted = await pool.query<WishRow>(
            `INSERT INTO birthday_wishes (
                month,
                week,
                year,
                area,
                birthday_names,
                sender_name,
                sender_email,
                message
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, sender_name, message, created_at`,
            [
                month,
                week,
                year,
                area,
                birthdayNames,
                senderName,
                senderEmail,
                message,
            ]
        )

        const row = inserted.rows[0]

        return NextResponse.json({
            success: true,
            data: {
                id: row.id,
                senderName: row.sender_name,
                message: row.message,
                createdAt: row.created_at,
            },
        })
    } catch (error) {
        console.error('Error creating birthday wish:', error)
        return NextResponse.json(
            { success: false, error: 'Không gửi được lời chúc' },
            { status: 500 }
        )
    }
}
