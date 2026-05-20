import { NextResponse } from 'next/server'

/**
 * API cũ: mail giải trình không tham gia kiểm tra chuyên sâu (new / accepted / rejected).
 * Đã tắt toàn bộ — không gửi SMTP.
 *
 * Luồng mail còn dùng: xin nghỉ 1 buổi → `POST /api/emails` (gọi từ `leave-requests` khi GV thay xác nhận).
 */
export async function POST(request: Request) {
  try {
    await request.json().catch(() => ({}))
    return NextResponse.json({
      success: true,
      message:
        'Luồng mail giải trình / kiểm tra chuyên sâu đã tắt. Chỉ còn mail quy trình xin nghỉ.',
      skipped: true,
      emailNotSent: true,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
