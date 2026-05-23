import pool from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT short_code, full_name, region FROM centers WHERE status = 'Active' ORDER BY region, full_name`
    )
    return NextResponse.json({ success: true, centers: result.rows })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
