import { withApiProtection } from '@/lib/api-protection';
import {
  EVENT_SCHEDULE_WALL_IANA,
  eventScheduleTsAsTimestamptz,
  parseToVnWallStorage,
  vnWallStorageSqlToInstantMs,
} from '@/lib/event-schedule-time';
import pool from '@/lib/db';
import { isDegradedDatabaseQueryError } from '@/lib/db-unavailable';
import { NextRequest, NextResponse } from 'next/server';

const EVENT_TYPES = [
  'dang_ky',
  'thi',
  'registration',
  'exam',
  'workshop',
  'workshop_teaching',
  'meeting',
  'teaching_review',
  'advanced_training_release',
  'holiday',
] as const;

const EVENT_MODES = ['online', 'offline'] as const;
const EVENT_STATUSES = ['scheduled', 'completed', 'cancelled', 'rescheduled'] as const;

type EventType = (typeof EVENT_TYPES)[number];
type EventMode = (typeof EVENT_MODES)[number];
type EventStatus = (typeof EVENT_STATUSES)[number];

function isValidEventType(value: string): value is EventType {
  return EVENT_TYPES.includes(value as EventType);
}

function isValidEventMode(value: string): value is EventMode {
  return EVENT_MODES.includes(value as EventMode);
}

function isValidEventStatus(value: string): value is EventStatus {
  return EVENT_STATUSES.includes(value as EventStatus);
}

function normalizeEventType(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'workshop_teaching') return 'workshop';
  return normalized;
}

function normalizeEventMode(value: string | null | undefined): EventMode {
  const normalized = String(value || 'online').trim().toLowerCase();
  return isValidEventMode(normalized) ? normalized : 'online';
}

function normalizeEventStatus(value: string | null | undefined): EventStatus {
  const normalized = String(value || 'scheduled').trim().toLowerCase();
  return isValidEventStatus(normalized) ? normalized : 'scheduled';
}

function toJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toIntArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [5, 15, 30, 60];
  const parsed = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  return parsed.length > 0 ? parsed : [5, 15, 30, 60];
}

function toTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return ['in_app', 'email'];
  const parsed = value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : ['in_app', 'email'];
}

function isMissingReviewerMeetingTable(error: any) {
  return error?.code === '42P01' || String(error?.message || '').includes('lecture_reviewer_meetings');
}

async function loadReviewerMeetingMap(reviewerNames: string[]) {
  const normalizedNames = Array.from(
    new Set(
      reviewerNames
        .map((name) => String(name || '').trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  if (normalizedNames.length === 0) {
    return new Map<string, string>();
  }

  try {
    const result = await pool.query(
      `SELECT reviewer_name, meeting_url
       FROM lecture_reviewer_meetings
       WHERE LOWER(TRIM(reviewer_name)) = ANY($1::text[])`,
      [normalizedNames],
    );

    return new Map<string, string>(
      result.rows
        .map((row: any) => [String(row.reviewer_name || '').trim().toLowerCase(), String(row.meeting_url || '').trim()] as [string, string])
        .filter((entry: [string, string]) => Boolean(entry[0]) && Boolean(entry[1])),
    );
  } catch (error: any) {
    if (isMissingReviewerMeetingTable(error)) {
      return new Map<string, string>();
    }
    throw error;
  }
}

function requiresAutoTeamsMeeting(eventType: string | null | undefined): boolean {
  if (!eventType) return false;
  const normalized = String(eventType).toLowerCase();
  return (
    normalized === 'workshop' ||
    normalized === 'meeting' ||
    normalized === 'teaching_review'
  );
}

async function getEventScheduleColumns(): Promise<Set<string>> {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'event_schedules'`,
  );

  return new Set(
    result.rows.map((row: any) => String(row.column_name || '').trim().toLowerCase()).filter(Boolean),
  );
}

function buildEventScheduleSelect(columns: Set<string>) {
  const hasColumn = (name: string) => columns.has(name);
  const centerJoin = hasColumn('center_id')
    ? 'LEFT JOIN centers c ON c.id = es.center_id'
    : '';

  return `
      SELECT
        es.id,
        es.ten,
        es.chuyen_nganh,
        es.loai_su_kien,
        es.mau_dang_ky,
        ${eventScheduleTsAsTimestamptz('es', 'bat_dau_luc')},
        ${eventScheduleTsAsTimestamptz('es', 'ket_thuc_luc')},
        es.ghi_chu,
        es.tao_luc,
        ${hasColumn('mode') ? 'es.mode' : 'NULL::VARCHAR AS mode'},
        ${hasColumn('center_id') ? 'es.center_id' : 'NULL::INTEGER AS center_id'},
        ${hasColumn('room') ? 'es.room' : 'NULL::VARCHAR AS room'},
        ${hasColumn('dia_chi_su_kien') ? 'es.dia_chi_su_kien' : 'NULL::TEXT AS dia_chi_su_kien'},
        ${hasColumn('map_url') ? 'es.map_url' : 'NULL::TEXT AS map_url'},
        ${hasColumn('meeting_url') ? 'es.meeting_url' : 'NULL::TEXT AS meeting_url'},
        ${hasColumn('meeting_id') ? 'es.meeting_id' : 'NULL::VARCHAR AS meeting_id'},
        ${hasColumn('participants') ? 'es.participants' : 'NULL::JSONB AS participants'},
        ${hasColumn('attachments') ? 'es.attachments' : 'NULL::JSONB AS attachments'},
        ${hasColumn('lecture_reviewer') ? 'es.lecture_reviewer' : 'NULL::VARCHAR AS lecture_reviewer'},
        ${hasColumn('trang_thai') ? 'es.trang_thai' : 'NULL::VARCHAR AS trang_thai'},
        ${hasColumn('reminder_offsets') ? 'es.reminder_offsets' : 'NULL::INT[] AS reminder_offsets'},
        ${hasColumn('reminder_channels') ? 'es.reminder_channels' : 'NULL::TEXT[] AS reminder_channels'},
        ${hasColumn('allow_registration') ? 'es.allow_registration' : 'NULL::BOOLEAN AS allow_registration'},
        ${hasColumn('slot_limit') ? 'es.slot_limit' : 'NULL::INTEGER AS slot_limit'},
        ${hasColumn('center_id') ? 'c.display_name AS center_name' : 'NULL::VARCHAR AS center_name'},
        ${hasColumn('center_id') ? 'c.address AS center_address' : 'NULL::VARCHAR AS center_address'},
        ${hasColumn('center_id') ? 'c.full_address AS center_full_address' : 'NULL::VARCHAR AS center_full_address'},
        ${hasColumn('center_id') ? 'c.map_url AS center_map_url' : 'NULL::TEXT AS center_map_url'},
        ${hasColumn('center_id') ? 'c.latitude AS center_latitude' : 'NULL::DECIMAL AS center_latitude'},
        ${hasColumn('center_id') ? 'c.longitude AS center_longitude' : 'NULL::DECIMAL AS center_longitude'},
        ${hasColumn('center_id') ? 'c.hotline AS center_hotline' : 'NULL::VARCHAR AS center_hotline'}
      FROM event_schedules es
      ${centerJoin}
      WHERE TRUE
    `;
}

async function fetchEventScheduleRowWithMeetingFallback(
  id: string,
): Promise<Record<string, any> | null> {
  const columns = await getEventScheduleColumns();
  const hasMeetingUrl = columns.has('meeting_url');
  const hasLectureReviewer = columns.has('lecture_reviewer');

  let query = buildEventScheduleSelect(columns);
  query += ` AND es.id = $1`;
  const result = await pool.query(query, [String(id)]);
  if (!result.rows.length) return null;

  const row = result.rows[0];
  if (!hasMeetingUrl || !hasLectureReviewer) {
    return row;
  }
  const reviewerMeetingMap = await loadReviewerMeetingMap(
    row.lecture_reviewer ? [String(row.lecture_reviewer)] : [],
  );
  return {
    ...row,
    meeting_url:
      row.meeting_url ||
      (row.lecture_reviewer
        ? reviewerMeetingMap.get(String(row.lecture_reviewer).trim().toLowerCase()) || null
        : null),
  };
}

function buildEventScheduleInsert(columns: Set<string>) {
  const available = (name: string) => columns.has(name);
  const insertColumns = ['id', 'ten', 'chuyen_nganh', 'loai_su_kien', 'mau_dang_ky', 'bat_dau_luc', 'ket_thuc_luc', 'ghi_chu'];
  const insertValues: string[] = ['$1', '$2', '$3', '$4', '$5', '$6::timestamp', '$7::timestamp', '$8'];
  const runtimeValues: any[] = [];

  const append = (name: string, value: any, typeSuffix = '') => {
    if (!available(name)) return;
    insertColumns.push(name);
    const placeholder = `$${insertValues.length + 1}${typeSuffix}`;
    insertValues.push(placeholder);
    runtimeValues.push(value);
  };

  return {
    append,
    insertColumns,
    insertValues,
    runtimeValues,
  };
}

// Read TIMESTAMP WITHOUT TIME ZONE from pg and return VN wall-clock string.
function toTimestampString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: EVENT_SCHEDULE_WALL_IANA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const vnWallClock = fmt.format(date); // "2026-05-14 21:00:00"
  return vnWallClock.replace(' ', 'T') + '+07:00'; // "2026-05-14T21:00:00+07:00"
}

// Serialize row â€” map DB column names to API response fields (both VN and EN aliases)
function serializeEventScheduleRow(row: Record<string, any>) {
  return {
    id: row.id,
    // Vietnamese column names (primary)
    ten: row.ten,
    chuyen_nganh: row.chuyen_nganh,
    loai_su_kien: row.loai_su_kien,
    mau_dang_ky: row.mau_dang_ky,
    ghi_chu: row.ghi_chu,
    bat_dau_luc: toTimestampString(row.bat_dau_luc),
    ket_thuc_luc: toTimestampString(row.ket_thuc_luc),
    tao_luc: toTimestampString(row.tao_luc),
    mode: row.mode,
    center_id: row.center_id,
    room: row.room,
    dia_chi_su_kien: row.dia_chi_su_kien,
    map_url: row.map_url,
    meeting_url: row.meeting_url,
    meeting_id: row.meeting_id,
    participants: Array.isArray(row.participants) ? row.participants : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    lecture_reviewer: row.lecture_reviewer,
    trang_thai: row.trang_thai,
    reminder_offsets: Array.isArray(row.reminder_offsets) ? row.reminder_offsets : [5, 15, 30, 60],
    reminder_channels: Array.isArray(row.reminder_channels) ? row.reminder_channels : ['in_app', 'email'],
    allow_registration: Boolean(row.allow_registration),
    slot_limit: row.slot_limit,
    center_name: row.center_name,
    center_address: row.center_address,
    center_full_address: row.center_full_address,
    center_map_url: row.center_map_url,
    center_latitude: row.center_latitude,
    center_longitude: row.center_longitude,
    center_hotline: row.center_hotline,
    // English aliases for backward-compatibility with frontend
    title: row.ten,
    specialty: row.chuyen_nganh,
    event_type: row.loai_su_kien,
    registration_template: row.mau_dang_ky,
    note: row.ghi_chu,
    start_at: toTimestampString(row.bat_dau_luc),
    end_at: toTimestampString(row.ket_thuc_luc),
    created_at: toTimestampString(row.tao_luc),
    status: row.trang_thai,
  };
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const eventType = searchParams.get('event_type') || searchParams.get('loai_su_kien');

    const columns = await getEventScheduleColumns();
    const hasMeetingUrl = columns.has('meeting_url');
    const hasLectureReviewer = columns.has('lecture_reviewer');
    const hasMode = columns.has('mode');
    const hasStatus = columns.has('trang_thai');

    let query = buildEventScheduleSelect(columns);

    const values: any[] = [];

    if (month) {
      values.push(month);
      query += ` AND TO_CHAR(es.bat_dau_luc, 'YYYY-MM') = $${values.length}`;
    }

    if (year) {
      values.push(year);
      query += ` AND TO_CHAR(es.bat_dau_luc, 'YYYY') = $${values.length}`;
    }

    if (eventType) {
      values.push(eventType);
      query += ` AND es.loai_su_kien = $${values.length}`;
    }

    const mode = searchParams.get('mode');
    if (mode && hasMode) {
      values.push(normalizeEventMode(mode));
      query += ` AND es.mode = $${values.length}`;
    }

    const status = searchParams.get('status') || searchParams.get('trang_thai');
    if (status && hasStatus) {
      values.push(normalizeEventStatus(status));
      query += ` AND es.trang_thai = $${values.length}`;
    }

    query += ' ORDER BY es.bat_dau_luc ASC, es.tao_luc DESC';

    const result = await pool.query(query, values);
    const reviewerMeetingMap = hasMeetingUrl && hasLectureReviewer
      ? await loadReviewerMeetingMap(
          result.rows
            .map((row: any) => row.lecture_reviewer)
            .filter(Boolean),
        )
      : new Map<string, string>();

    const mappedRows = result.rows.map((row: any) => ({
      ...row,
      meeting_url:
        row.meeting_url ||
        (row.lecture_reviewer ? reviewerMeetingMap.get(String(row.lecture_reviewer).trim().toLowerCase()) || null : null),
    }));

    return NextResponse.json({
      success: true,
      data: mappedRows.map(serializeEventScheduleRow),
      count: mappedRows.length,
    });
  } catch (error: unknown) {
    if (isDegradedDatabaseQueryError(error)) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        dbUnavailable: true,
      });
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch event schedules';
    console.error('Error fetching event schedules:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const columns = await getEventScheduleColumns();

    // Accept both Vietnamese and English field names
    const id = body.id;
    const ten = body.ten || body.title;
    const chuyen_nganh = body.chuyen_nganh || body.specialty;
    const loai_su_kien = normalizeEventType(body.loai_su_kien || body.event_type);
    const mau_dang_ky = body.mau_dang_ky || body.registration_template;
    const bat_dau_luc = body.bat_dau_luc || body.start_at;
    const ket_thuc_luc = body.ket_thuc_luc || body.end_at;
    const ghi_chu = body.ghi_chu || body.note;
    const mode = normalizeEventMode(body.mode);
    const center_id = body.center_id != null && body.center_id !== '' ? Number(body.center_id) : null;
    const room = body.room != null ? String(body.room).trim() : null;
    const lecture_reviewer = body.lecture_reviewer != null ? String(body.lecture_reviewer).trim() : null;
    const trang_thai = normalizeEventStatus(body.trang_thai || body.status);
    const allow_registration =
      body.allow_registration !== undefined
        ? Boolean(body.allow_registration)
        : body.allowRegistration !== undefined
          ? Boolean(body.allowRegistration)
          : false;
    const slot_limit = body.slot_limit != null && body.slot_limit !== '' ? Number(body.slot_limit) : null;
    const meeting_url = body.meeting_url != null ? String(body.meeting_url).trim() : null;
    const meeting_id = body.meeting_id != null ? String(body.meeting_id).trim() : null;
    const reminder_offsets = toIntArray(body.reminder_offsets);
    const reminder_channels = toTextArray(body.reminder_channels);
    const participants = toJsonArray(body.participants);
    const attachments = toJsonArray(body.attachments);

    let resolvedMeetingUrl = meeting_url;
    if (!resolvedMeetingUrl && lecture_reviewer) {
      const reviewerMeetingMap = await loadReviewerMeetingMap([lecture_reviewer]);
      resolvedMeetingUrl = reviewerMeetingMap.get(lecture_reviewer.trim().toLowerCase()) || null;
    }

    if (!id || !ten || !loai_su_kien || !bat_dau_luc || !ket_thuc_luc) {
      return NextResponse.json(
        { success: false, error: 'Thiáº¿u trÆ°á»ng báº¯t buá»™c: id, ten, loai_su_kien, bat_dau_luc, ket_thuc_luc' },
        { status: 400 }
      );
    }

    const startAt = parseToVnWallStorage(bat_dau_luc);
    const endAt = parseToVnWallStorage(ket_thuc_luc);
    if (!startAt || !endAt) {
      return NextResponse.json(
        { success: false, error: 'bat_dau_luc hoáº·c ket_thuc_luc khĂ´ng há»£p lá»‡' },
        { status: 400 }
      );
    }
    if (vnWallStorageSqlToInstantMs(endAt) <= vnWallStorageSqlToInstantMs(startAt)) {
      return NextResponse.json(
        { success: false, error: 'ket_thuc_luc pháº£i sau bat_dau_luc' },
        { status: 400 }
      );
    }

    if (!isValidEventType(loai_su_kien)) {
      return NextResponse.json(
        { success: false, error: `loai_su_kien khĂ´ng há»£p lá»‡: ${loai_su_kien}` },
        { status: 400 }
      );
    }

    const insert = buildEventScheduleInsert(columns);
    insert.append('mode', mode);
    insert.append('center_id', center_id);
    insert.append('room', room);
    insert.append('meeting_url', resolvedMeetingUrl);
    insert.append('meeting_id', meeting_id || null);
    insert.append('participants', JSON.stringify(participants), '::jsonb');
    insert.append('attachments', JSON.stringify(attachments), '::jsonb');
    insert.append('lecture_reviewer', lecture_reviewer || null);
    insert.append('trang_thai', trang_thai);
    insert.append('reminder_offsets', reminder_offsets, '::int[]');
    insert.append('reminder_channels', reminder_channels, '::text[]');
    insert.append('allow_registration', allow_registration, '::boolean');
    insert.append('slot_limit', slot_limit);

    const query = `
      INSERT INTO event_schedules (
        ${insert.insertColumns.join(', ')}
      )
      VALUES (
        ${insert.insertValues.join(', ')}
      )
      RETURNING *
    `;

    const values = [
      String(id),
      String(ten),
      chuyen_nganh ? String(chuyen_nganh) : null,
      String(loai_su_kien),
      mau_dang_ky ? String(mau_dang_ky) : null,
      startAt,
      endAt,
      ghi_chu ? String(ghi_chu) : null,
      ...insert.runtimeValues,
    ];

    await pool.query(query, values);

    const merged = await fetchEventScheduleRowWithMeetingFallback(String(id));
    if (!merged) {
      return NextResponse.json(
        { success: false, error: 'Không tải lại được sự kiện sau khi tạo' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: serializeEventScheduleRow(merged),
        message: 'Táº¡o sá»± kiá»‡n thĂ nh cĂ´ng',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating event schedule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create event' },
      { status: 500 }
    );
  }
});

export const PUT = withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const columns = await getEventScheduleColumns();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id sá»± kiá»‡n lĂ  báº¯t buá»™c' },
        { status: 400 }
      );
    }

    const currentEventResult = await pool.query(
      `SELECT 1 FROM event_schedules WHERE id = $1 LIMIT 1`,
      [String(id)],
    );

    if (!currentEventResult.rows.length) {
      return NextResponse.json(
        { success: false, error: 'KhĂ´ng tĂ¬m tháº¥y sá»± kiá»‡n' },
        { status: 404 }
      );
    }

    const fields: string[] = [];
    const values: any[] = [String(id)];

    const pushField = (sql: string, value: any) => {
      values.push(value);
      fields.push(`${sql} = $${values.length}`);
    };

    // Accept both VN and EN field names
    const ten = body.ten ?? body.title;
    const chuyen_nganh = body.chuyen_nganh ?? body.specialty;
    const loai_su_kien = normalizeEventType(body.loai_su_kien ?? body.event_type);
    const mau_dang_ky = body.mau_dang_ky ?? body.registration_template;
    const bat_dau_luc = body.bat_dau_luc ?? body.start_at;
    const ket_thuc_luc = body.ket_thuc_luc ?? body.end_at;
    const ghi_chu = body.ghi_chu ?? body.note;
    const mode = body.mode !== undefined ? normalizeEventMode(body.mode) : undefined;
    const center_id = body.center_id !== undefined ? (body.center_id === null || body.center_id === '' ? null : Number(body.center_id)) : undefined;
    const room = body.room !== undefined ? (body.room ? String(body.room).trim() : null) : undefined;
    const lecture_reviewer = body.lecture_reviewer !== undefined ? (body.lecture_reviewer ? String(body.lecture_reviewer).trim() : null) : undefined;
    const trang_thai = body.trang_thai !== undefined || body.status !== undefined ? normalizeEventStatus(body.trang_thai ?? body.status) : undefined;
    const allow_registration =
      body.allow_registration !== undefined
        ? Boolean(body.allow_registration)
        : body.allowRegistration !== undefined
          ? Boolean(body.allowRegistration)
          : undefined;
    const slot_limit = body.slot_limit !== undefined ? (body.slot_limit === null || body.slot_limit === '' ? null : Number(body.slot_limit)) : undefined;
    const meeting_url = body.meeting_url !== undefined ? (body.meeting_url ? String(body.meeting_url).trim() : null) : undefined;
    const meeting_id = body.meeting_id !== undefined ? (body.meeting_id ? String(body.meeting_id).trim() : null) : undefined;
    const reminder_offsets = body.reminder_offsets !== undefined ? toIntArray(body.reminder_offsets) : undefined;
    const reminder_channels = body.reminder_channels !== undefined ? toTextArray(body.reminder_channels) : undefined;
    const participants = body.participants !== undefined ? toJsonArray(body.participants) : undefined;
    const attachments = body.attachments !== undefined ? toJsonArray(body.attachments) : undefined;

    let resolvedMeetingUrl = meeting_url;
    if (resolvedMeetingUrl === undefined && lecture_reviewer !== undefined) {
      const reviewerMeetingMap = await loadReviewerMeetingMap([lecture_reviewer || '']);
      resolvedMeetingUrl = lecture_reviewer ? reviewerMeetingMap.get(lecture_reviewer.trim().toLowerCase()) || null : null;
    }

    if (ten !== undefined) pushField('ten', ten ? String(ten) : null);
    if (chuyen_nganh !== undefined) pushField('chuyen_nganh', chuyen_nganh ? String(chuyen_nganh) : null);
    if (loai_su_kien !== undefined && loai_su_kien !== null) {
      if (!isValidEventType(loai_su_kien)) {
        return NextResponse.json(
          { success: false, error: `loai_su_kien khĂ´ng há»£p lá»‡: ${loai_su_kien}` },
          { status: 400 }
        );
      }
      pushField('loai_su_kien', String(loai_su_kien));
    }
    if (mau_dang_ky !== undefined) pushField('mau_dang_ky', mau_dang_ky ? String(mau_dang_ky) : null);

    if (bat_dau_luc !== undefined) {
      const parsed = parseToVnWallStorage(bat_dau_luc);
      if (!parsed) {
        return NextResponse.json(
          { success: false, error: 'bat_dau_luc khĂ´ng há»£p lá»‡' },
          { status: 400 }
        );
      }
      pushField('bat_dau_luc', parsed);
    }

    if (ket_thuc_luc !== undefined) {
      const parsed = parseToVnWallStorage(ket_thuc_luc);
      if (!parsed) {
        return NextResponse.json(
          { success: false, error: 'ket_thuc_luc khĂ´ng há»£p lá»‡' },
          { status: 400 }
        );
      }
      pushField('ket_thuc_luc', parsed);
    }

    if (ghi_chu !== undefined) pushField('ghi_chu', ghi_chu ? String(ghi_chu) : null);
    if (mode !== undefined && columns.has('mode')) pushField('mode', mode);
    if (center_id !== undefined && columns.has('center_id')) pushField('center_id', center_id);
    if (room !== undefined && columns.has('room')) pushField('room', room);
    if (resolvedMeetingUrl !== undefined && columns.has('meeting_url')) pushField('meeting_url', resolvedMeetingUrl);
    if (meeting_id !== undefined && columns.has('meeting_id')) pushField('meeting_id', meeting_id);
    if (participants !== undefined && columns.has('participants')) pushField('participants', JSON.stringify(participants));
    if (attachments !== undefined && columns.has('attachments')) pushField('attachments', JSON.stringify(attachments));
    if (lecture_reviewer !== undefined && columns.has('lecture_reviewer')) pushField('lecture_reviewer', lecture_reviewer);
    if (trang_thai !== undefined && columns.has('trang_thai')) pushField('trang_thai', trang_thai);
    if (reminder_offsets !== undefined && columns.has('reminder_offsets')) pushField('reminder_offsets', reminder_offsets);
    if (reminder_channels !== undefined && columns.has('reminder_channels')) pushField('reminder_channels', reminder_channels);
    if (allow_registration !== undefined && columns.has('allow_registration')) pushField('allow_registration', allow_registration);
    if (slot_limit !== undefined && columns.has('slot_limit')) pushField('slot_limit', slot_limit);

    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'KhĂ´ng cĂ³ trÆ°á»ng nĂ o Ä‘á»ƒ cáº­p nháº­t' },
        { status: 400 }
      );
    }

    const query = `
      UPDATE event_schedules
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (!result.rows.length) {
      return NextResponse.json(
        { success: false, error: 'KhĂ´ng tĂ¬m tháº¥y sá»± kiá»‡n' },
        { status: 404 }
      );
    }

    const merged = await fetchEventScheduleRowWithMeetingFallback(String(id));
    if (!merged) {
      return NextResponse.json(
        { success: false, error: 'Không tải lại được sự kiện sau khi cập nhật' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeEventScheduleRow(merged),
      message: 'Cáº­p nháº­t sá»± kiá»‡n thĂ nh cĂ´ng',
    });
  } catch (error: any) {
    console.error('Error updating event schedule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update event' },
      { status: 500 }
    );
  }
});

export const DELETE = withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id sá»± kiá»‡n lĂ  báº¯t buá»™c' },
        { status: 400 }
      );
    }

    // Dá»n dá»¯ liá»‡u liĂªn quan trÆ°á»›c khi xĂ³a sá»± kiá»‡n: káº¿t quáº£, giáº£i trĂ¬nh, bĂ i ná»™p.
    try {
      const resultIds = await pool.query(
        `SELECT id FROM chuyen_sau_results WHERE id_su_kien = $1::uuid`,
        [String(id)]
      );
      if (resultIds.rows.length > 0) {
        const rIds = resultIds.rows.map((r: { id: number }) => r.id);

        // XĂ³a bainop_traloi trÆ°á»›c (FK CASCADE tá»« bainop)
        const bainopIds = await pool.query(
          `SELECT id FROM chuyen_sau_bainop WHERE id_ket_qua = ANY($1::bigint[])`,
          [rIds]
        );
        if (bainopIds.rows.length > 0) {
          const bIds = bainopIds.rows.map((r: { id: number }) => r.id);
          await pool.query(
            `DELETE FROM chuyen_sau_bainop_traloi WHERE id_bai_nop = ANY($1::bigint[])`,
            [bIds]
          );
          await pool.query(
            `DELETE FROM chuyen_sau_bainop WHERE id = ANY($1::bigint[])`,
            [bIds]
          );
        }

        // XĂ³a giáº£i trĂ¬nh liĂªn quan (qua id_ket_qua)
        await pool.query(
          `DELETE FROM chuyen_sau_giaitrinh WHERE id_ket_qua = ANY($1::bigint[])`,
          [rIds]
        );

        await pool.query(
          `DELETE FROM chuyen_sau_results WHERE id_su_kien = $1::uuid`,
          [String(id)]
        );
      }
    } catch {
      // Graceful: table/column may not exist in all environments
    }

    const result = await pool.query(
      `DELETE FROM event_schedules WHERE id = $1
       RETURNING id, ten AS title, loai_su_kien AS event_type`,
      [String(id)]
    );

    if (!result.rows.length) {
      return NextResponse.json(
        { success: false, error: 'KhĂ´ng tĂ¬m tháº¥y sá»± kiá»‡n' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeEventScheduleRow(result.rows[0]),
      message: 'XoĂ¡ sá»± kiá»‡n thĂ nh cĂ´ng',
    });
  } catch (error: any) {
    console.error('Error deleting event schedule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete event' },
      { status: 500 }
    );
  }
});
