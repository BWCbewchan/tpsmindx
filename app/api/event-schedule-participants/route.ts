import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type ResponseStatus = 'accepted' | 'declined';

function normalizeTeacherCode(code: string) {
  return code.trim().toLowerCase();
}

function isValidResponseStatus(value: string): value is ResponseStatus {
  return value === 'accepted' || value === 'declined';
}

function isMissingParticipantsTable(error: any) {
  return error?.code === '42P01' || String(error?.message || '').includes('event_schedule_participants');
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const teacherCode = searchParams.get('teacher_code');
    const eventIdsRaw = searchParams.get('event_ids');
    const status = searchParams.get('status');

    if (status && !isValidResponseStatus(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    if (eventId) {
      const values: any[] = [eventId];
      let query = `
        SELECT
          esp.id,
          esp.event_id,
          esp.teacher_code,
          esp.teacher_name,
          esp.teacher_email,
          esp.response_status,
          esp.note,
          esp.responded_at,
          esp.created_at,
          esp.updated_at
        FROM event_schedule_participants esp
        WHERE esp.event_id = $1
      `;

      if (status) {
        values.push(status);
        query += ` AND esp.response_status = $${values.length}`;
      }

      query += `
        ORDER BY
          CASE WHEN esp.response_status = 'accepted' THEN 0 ELSE 1 END,
          COALESCE(esp.teacher_name, esp.teacher_code) ASC
      `;

      const result = await pool.query(query, values);
      return NextResponse.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
      });
    }

    if (teacherCode && eventIdsRaw) {
      const eventIds = eventIdsRaw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

      if (eventIds.length === 0) {
        return NextResponse.json({ success: true, data: [], count: 0 });
      }

      const result = await pool.query(
        `
          SELECT
            esp.event_id,
            esp.response_status,
            esp.responded_at
          FROM event_schedule_participants esp
          WHERE LOWER(TRIM(esp.teacher_code)) = $1
            AND esp.event_id = ANY($2::uuid[])
          ORDER BY esp.responded_at DESC
        `,
        [normalizeTeacherCode(teacherCode), eventIds]
      );

      return NextResponse.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Provide event_id or teacher_code with event_ids' },
      { status: 400 }
    );
  } catch (error: any) {
    if (isMissingParticipantsTable(error)) {
      // Graceful fallback when migration has not been applied yet.
      return NextResponse.json({ success: true, data: [], count: 0 });
    }
    console.error('Error fetching event participation:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch participation data' },
      { status: 500 }
    );
  }
});

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      event_id,
      teacher_code,
      teacher_name,
      teacher_email,
      response_status,
      note,
    } = body;

    if (!event_id || !teacher_code || !response_status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: event_id, teacher_code, response_status' },
        { status: 400 }
      );
    }

    if (!isValidResponseStatus(String(response_status))) {
      return NextResponse.json(
        { success: false, error: 'Invalid response_status' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
        INSERT INTO event_schedule_participants (
          event_id,
          teacher_code,
          teacher_name,
          teacher_email,
          response_status,
          note,
          responded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (event_id, teacher_code)
        DO UPDATE SET
          teacher_name = EXCLUDED.teacher_name,
          teacher_email = EXCLUDED.teacher_email,
          response_status = EXCLUDED.response_status,
          note = EXCLUDED.note,
          responded_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      [
        String(event_id),
        normalizeTeacherCode(String(teacher_code)),
        teacher_name ? String(teacher_name) : null,
        teacher_email ? String(teacher_email) : null,
        String(response_status),
        note ? String(note) : null,
      ]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Saved participation response',
    });
  } catch (error: any) {
    if (isMissingParticipantsTable(error)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tính năng xác nhận tham gia đang được khởi tạo. Vui lòng thử lại sau ít phút.',
        },
        { status: 503 }
      );
    }
    console.error('Error saving event participation:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save participation response' },
      { status: 500 }
    );
  }
});
