import pool from '@/lib/db';
import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Internal endpoint used by the front‑end when a teacher logs in for the first time.
 * It reads the advanced training scores from a Google Sheet via public CSV export
 * and inserts them into `training_teacher_video_scores` for the given teacher_code.
 *
 * Security measures:
 *  - Requires a valid bearer token or session cookie (same as other datasource APIs).
 *  - The teacher_code supplied must belong to the authenticated user (checked via email).
 *  - Uses prepared statements and a transaction.
 *  - Returns minimal error information to the client.
 */

const SPREADSHEET_ID = '1pOfZp4w__q-KBEE-wrwGjjq_J3KSjAYfpHCJxL-LsGs';
const SHEET_GID = '1375184237'; // Specific GID for the "Dashboard" tab

// Mapping from CSV column index (0‑based) to video_id – identical to import_advanced_scores.js
const COLUMN_TO_VIDEO_ID: Record<number, number> = {
  11: 84, // Lesson 1
  12: 85, // Lesson 2
  13: 87, // Lesson 3
  14: 86, // Lesson 4
  15: 82, // Lesson 5
  16: 83, // Lesson 6
  17: 89, // Lesson 7
  18: 79, // Lesson 8
  19: 81, // Lesson 9
  20: 80, // Lesson 10
  21: 88, // Lesson 11
  22: 78, // Lesson 12
};

/**
 * Simple CSV parser that handles quoted fields containing commas.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r' || char === '\n') {
        currentRow.push(currentField);
        if (currentRow.some(field => field !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (char === '\r' && nextChar === '\n') i++;
      } else {
        currentField += char;
      }
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}

export async function POST(request: NextRequest) {
  // ---- 1. Authenticate ----------------------------------------------------
  const auth = await requireBearerOrSessionCookie(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const teacherCodeRaw = String(body?.teacherCode || '').trim();
  if (!teacherCodeRaw) {
    return NextResponse.json(
      { success: false, error: 'teacherCode is required' },
      { status: 400 }
    );
  }

  // Normalise the code (lower‑case, trimmed) – same convention used everywhere else
  const teacherCode = teacherCodeRaw.toLowerCase();

  // ---- 2. Verify that the authenticated user really owns this code ----------
  // In our system the email prefix is usually the teacher code.
  // We perform a robust check: either the email prefix matches teacherCode exactly,
  // or there is a matching row in the teachers table for this email and code.
  // This prevents substrings from matching (e.g. "thanh" matching "thanhnq") and ensures absolute security.
  const sessionEmail = auth.sessionEmail?.toLowerCase().trim() ?? '';
  const emailPrefix = sessionEmail.split('@')[0];
  let isAuthorized = (emailPrefix === teacherCode);

  if (!isAuthorized) {
    try {
      const dbCheck = await pool.query(
        `SELECT 1 FROM teachers 
         WHERE LOWER(TRIM(code)) = $1 
           AND (LOWER(TRIM(work_email)) = $2 OR LOWER(TRIM("Work email")) = $2)
         LIMIT 1`,
        [teacherCode, sessionEmail]
      );
      if (dbCheck.rows.length > 0) {
        isAuthorized = true;
      }
    } catch (err) {
      console.error('[ImportTeacherScores] Secure verification error:', err);
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: teacherCode does not match session' },
      { status: 403 }
    );
  }

  const client = await pool.connect();

  try {
    // ---- 3. If scores already exist, skip import ---------------------------
    const existing = await client.query(
      `SELECT 1 FROM training_teacher_video_scores WHERE LOWER(TRIM(teacher_code)) = $1 LIMIT 1`,
      [teacherCode]
    );
    if ((existing.rowCount ?? 0) > 0) {
      return NextResponse.json({ success: true, alreadyImported: true });
    }

    // ---- 4. Fetch the sheet as CSV via public export URL ----------------------
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    const csvRes = await fetch(csvUrl);
    if (!csvRes.ok) {
      throw new Error(`Failed to fetch CSV from Google Sheets: ${csvRes.statusText}`);
    }
    const csvText = await csvRes.text();
    const rows = parseCSV(csvText);

    // ---- 5. Locate the row that matches the teacher code --------------------
    // In the original CSV the teacher code lives in column index 2 (third column)
    const targetRow = rows.find(
      (r) => (r[2] ?? '').trim().toLowerCase() === teacherCode
    );

    if (!targetRow) {
      return NextResponse.json(
        { success: false, error: 'Teacher not found in Google Sheet' },
        { status: 404 }
      );
    }

    const fullName = (targetRow[1] || teacherCode).trim();

    // ---- 6. Insert scores inside a transaction -------------------------------
    await client.query('BEGIN');

    // ---- 6.1 Ensure teacher exists in training_teacher_stats (Parent Table) ----
    // This prevents foreign key constraint violations in training_teacher_video_scores.
    await client.query(
      `INSERT INTO training_teacher_stats (teacher_code, full_name, work_email, status)
       VALUES ($1, $2, '', 'Active')
       ON CONFLICT (teacher_code) DO NOTHING`,
      [teacherCode, fullName]
    );

    for (const [colIdxStr, videoId] of Object.entries(COLUMN_TO_VIDEO_ID)) {
      const colIdx = Number(colIdxStr);
      let scoreStr = targetRow[colIdx];
      if (!scoreStr) continue;

      // Clean the value (remove quotes, replace comma with dot)
      scoreStr = scoreStr.replace(/"/g, '').replace(',', '.');
      const score = parseFloat(scoreStr);
      if (isNaN(score) || score <= 0) continue;

      await client.query(
        `INSERT INTO training_teacher_video_scores
          (teacher_code, video_id, score, completion_status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (teacher_code, video_id) DO UPDATE
           SET score = EXCLUDED.score,
               completion_status = CASE
                 WHEN training_teacher_video_scores.completion_status = 'watched' THEN 'watched'
                 ELSE EXCLUDED.completion_status
               END,
               updated_at = NOW()
         WHERE training_teacher_video_scores.score < EXCLUDED.score
            OR training_teacher_video_scores.score IS NULL`,
        [teacherCode, videoId, score, 'completed']
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({ success: true, imported: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ImportTeacherScores] error:', err);
    return NextResponse.json(
      { success: false, error: 'Import failed' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}