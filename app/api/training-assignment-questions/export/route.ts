import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const assignmentId = searchParams.get('assignment_id');

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu assignment_id' },
        { status: 400 }
      );
    }

    // Lấy danh sách câu hỏi
    const questions = await pool.query(
      `SELECT 
        question_text,
        question_type,
        correct_answer,
        options,
        points,
        difficulty,
        explanation,
        image_url,
        order_number
      FROM training_assignment_questions 
      WHERE assignment_id = $1 
      ORDER BY order_number ASC`,
      [assignmentId]
    );

    if (questions.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy câu hỏi nào' },
        { status: 404 }
      );
    }

    // Tạo CSV content
    const headers = [
      'question_text',
      'question_type',
      'correct_answer',
      'options',
      'points',
      'difficulty',
      'explanation',
      'image_url'
    ];

    // Convert options array to pipe-separated string
    const rows = questions.rows.map((q: any) => {
      const optionsStr = q.options
        ? (Array.isArray(q.options) ? q.options.join('|') : q.options)
        : '';

      // multiple_select: correct_answer là JSON array → xuất dạng pipe-separated
      let correctAnswerStr = q.correct_answer || ''
      if (q.question_type === 'multiple_select') {
        try {
          const arr = JSON.parse(correctAnswerStr)
          if (Array.isArray(arr)) correctAnswerStr = arr.join('|')
        } catch { /* giữ nguyên */ }
      }

      return [
        escapeCsvValue(q.question_text || ''),
        q.question_type || '',
        escapeCsvValue(correctAnswerStr),
        escapeCsvValue(optionsStr),
        q.points || 1,
        q.difficulty || 'medium',
        escapeCsvValue(q.explanation || ''),
        q.image_url || ''
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    // Add UTF-8 BOM for Excel compatibility
    const bom = '\uFEFF';
    const csvWithBom = bom + csv;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cau_hoi_bai_tap_${assignmentId}_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting questions:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi khi export câu hỏi' },
      { status: 500 }
    );
  }
}

// Helper function to escape CSV values
function escapeCsvValue(value: string): string {
  if (!value) return '';
  
  // If value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  
  return value;
}
