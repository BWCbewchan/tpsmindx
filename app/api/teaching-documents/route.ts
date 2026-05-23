import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth'
import { listTeachingDocuments } from '@/lib/teaching-documents'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const auth = await requireBearerOrSessionCookie(request)
  if (!auth.ok) return auth.response

  try {
    const documents = await listTeachingDocuments({ publishedOnly: true })
    return NextResponse.json({ success: true, documents })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể tải tài liệu giảng dạy' },
      { status: 500 },
    )
  }
}
