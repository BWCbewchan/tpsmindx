const fs = require('fs');
const path = require('path');

require('dotenv').config();

const { Pool } = require('pg');
const XLSX = require('xlsx');

const TABLE_NAME = 'trial_checkout_raw';
const SOURCE_SHEET = 'Sheet1';
const DEFAULT_SOURCE_FILE = path.join(
  process.env.USERPROFILE || 'C:\\Users\\ASUS',
  'Downloads',
  'Data_trial_raw.xlsx',
);

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const skipSchema = args.includes('--skip-schema');
const sourceFile =
  args.find((arg) => !arg.startsWith('--')) ||
  process.env.TRIAL_CHECKOUT_XLSX_PATH ||
  DEFAULT_SOURCE_FILE;

const dbColumns = [
  'raw_id',
  'source_file',
  'source_sheet',
  'source_row_number',
  'timestamp_raw',
  'timestamp_at',
  'trial_teacher_name',
  'sales_owner_name',
  'student_name',
  'student_age_label',
  'trial_date_raw',
  'trial_date',
  'track',
  'trial_subject',
  'center_name',
  'ht1',
  'ht2',
  'ht3',
  'st1',
  'st2',
  'lg1',
  'lg2',
  'gt1',
  'gt2',
  'rob4b_1',
  'rob4b_2',
  'rob4b_3',
  'rob4b_4',
  'art4p_1',
  'art4p_2',
  'art4p_3',
  'art4p_4',
  'art4p_5',
  'total_score',
  'case_result',
  'general_comment',
  'evidence_link',
  'raw_payload',
];

function buildPoolConfig() {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  const dbHost = (process.env.DB_HOST || '').trim();
  const dbUser = (process.env.DB_USER || '').trim();
  const dbName = (process.env.DB_NAME || '').trim();

  const hostLooksHosted =
    /supabase\.co|neon\.tech|aiven\.io|aivencloud\.com|amazonaws\.com|render\.com|railway\.app/i.test(
      dbHost,
    );
  const urlLooksHosted =
    /supabase\.co|neon\.tech|aiven\.io|aivencloud\.com|amazonaws\.com|render\.com|railway\.app/i.test(
      databaseUrl,
    );
  const looksLikeAivenDefaults = dbUser === 'avnadmin' || dbName === 'defaultdb';
  const useSsl =
    hostLooksHosted || urlLooksHosted || looksLikeAivenDefaults || process.env.DB_SSL === 'true';
  const ssl = useSsl ? { rejectUnauthorized: false } : undefined;

  if (databaseUrl) {
    return { connectionString: databaseUrl, ssl, max: 1 };
  }

  return {
    host: dbHost,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: dbName,
    user: dbUser,
    password: process.env.DB_PASSWORD,
    ssl,
    max: 1,
  };
}

function cleanHeader(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function textOrNull(value) {
  const text = String(value ?? '')
    .replace(/\u0000/g, '')
    .trim();
  return text === '' ? null : text;
}

function displayValue(cell) {
  if (!cell) return null;
  if (cell.w != null) return textOrNull(cell.w);
  if (cell.v == null) return null;
  return textOrNull(cell.v);
}

function rawPayloadValue(cell) {
  if (!cell) return null;
  if (cell.w != null) return textOrNull(cell.w);
  if (cell.v == null) return null;
  if (typeof cell.v === 'number' || typeof cell.v === 'boolean') return cell.v;
  return textOrNull(cell.v);
}

function pad(value, size = 2) {
  return String(value).padStart(size, '0');
}

function partsToDate(parts) {
  if (!parts) return null;
  return `${pad(parts.y, 4)}-${pad(parts.m)}-${pad(parts.d)}`;
}

function partsToTimestamp(parts) {
  if (!parts) return null;
  const seconds = Math.round(parts.S || 0);
  return `${pad(parts.y, 4)}-${pad(parts.m)}-${pad(parts.d)} ${pad(parts.H || 0)}:${pad(
    parts.M || 0,
  )}:${pad(seconds)}`;
}

function parseSlashDateTime(value, dateOnly) {
  const text = textOrNull(value);
  if (!text) return null;

  const match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i,
  );
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  let hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);
  const second = Number(match[6] || 0);
  const meridiem = String(match[7] || '').toUpperCase();

  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

  if (dateOnly) return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
  return `${pad(year, 4)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

function parseDateCell(cell) {
  if (!cell) return null;
  if (typeof cell.v === 'number') return partsToDate(XLSX.SSF.parse_date_code(cell.v));
  return parseSlashDateTime(displayValue(cell), true);
}

function parseTimestampCell(cell) {
  if (!cell) return null;
  if (typeof cell.v === 'number') return partsToTimestamp(XLSX.SSF.parse_date_code(cell.v));
  return parseSlashDateTime(displayValue(cell), false);
}

function numberOrNull(value) {
  const text = textOrNull(value);
  if (!text) return null;
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function getCell(sheet, rowIndex, colIndex) {
  return sheet[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })];
}

function isRowEmpty(sheet, rowIndex, lastColumnIndex) {
  for (let colIndex = 0; colIndex <= lastColumnIndex; colIndex += 1) {
    if (displayValue(getCell(sheet, rowIndex, colIndex)) != null) return false;
  }
  return true;
}

function rowToRecord(sheet, headers, rowIndex) {
  const cell = (colIndex) => getCell(sheet, rowIndex, colIndex);
  const show = (colIndex) => displayValue(cell(colIndex));
  const payload = {};

  headers.forEach((header, colIndex) => {
    payload[header || `Column ${colIndex + 1}`] = rawPayloadValue(cell(colIndex));
  });

  return {
    raw_id: numberOrNull(show(0)),
    source_file: path.basename(sourceFile),
    source_sheet: SOURCE_SHEET,
    source_row_number: rowIndex + 1,
    timestamp_raw: show(1),
    timestamp_at: parseTimestampCell(cell(1)),
    trial_teacher_name: show(2),
    sales_owner_name: show(3),
    student_name: show(4),
    student_age_label: show(5),
    trial_date_raw: show(6),
    trial_date: parseDateCell(cell(6)),
    track: show(7),
    trial_subject: show(8),
    center_name: show(9),
    ht1: numberOrNull(show(10)),
    ht2: numberOrNull(show(11)),
    ht3: numberOrNull(show(12)),
    st1: numberOrNull(show(13)),
    st2: numberOrNull(show(14)),
    lg1: numberOrNull(show(15)),
    lg2: numberOrNull(show(16)),
    gt1: numberOrNull(show(17)),
    gt2: numberOrNull(show(18)),
    rob4b_1: numberOrNull(show(19)),
    rob4b_2: numberOrNull(show(20)),
    rob4b_3: numberOrNull(show(21)),
    rob4b_4: numberOrNull(show(22)),
    art4p_1: numberOrNull(show(23)),
    art4p_2: numberOrNull(show(24)),
    art4p_3: numberOrNull(show(25)),
    art4p_4: numberOrNull(show(26)),
    art4p_5: numberOrNull(show(27)),
    total_score: numberOrNull(show(28)),
    case_result: show(29),
    general_comment: show(30),
    evidence_link: show(31),
    raw_payload: payload,
  };
}

function parseWorkbook(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Source workbook not found: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: true });
  const sheet = workbook.Sheets[SOURCE_SHEET];
  if (!sheet) {
    throw new Error(`Workbook does not contain required sheet: ${SOURCE_SHEET}`);
  }
  if (!sheet['!ref']) {
    throw new Error(`Sheet ${SOURCE_SHEET} has no used range`);
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headers = [];
  for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
    headers.push(cleanHeader(displayValue(getCell(sheet, range.s.r, colIndex))));
  }

  if (headers.length !== 32 || headers[0] !== 'Id' || headers[1] !== 'Timestamp') {
    throw new Error(
      `Unexpected ${SOURCE_SHEET} header shape. Expected 32 columns beginning with Id, Timestamp.`,
    );
  }

  const records = [];
  for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
    if (isRowEmpty(sheet, rowIndex, range.e.c)) continue;
    records.push(rowToRecord(sheet, headers, rowIndex));
  }

  return { workbook, headers, records };
}

function validateRecords(records) {
  const ids = new Set();
  const duplicateIds = [];
  const invalidRows = [];

  records.forEach((record) => {
    if (!Number.isInteger(record.raw_id)) {
      invalidRows.push({ source_row_number: record.source_row_number, issue: 'missing raw_id' });
      return;
    }
    if (ids.has(record.raw_id)) duplicateIds.push(record.raw_id);
    ids.add(record.raw_id);

    if (!record.trial_teacher_name) {
      invalidRows.push({
        source_row_number: record.source_row_number,
        raw_id: record.raw_id,
        issue: 'missing trial_teacher_name',
      });
    }
  });

  if (duplicateIds.length > 0 || invalidRows.length > 0) {
    throw new Error(
      `Validation failed. duplicateIds=${duplicateIds.slice(0, 10).join(',')} invalidRows=${JSON.stringify(
        invalidRows.slice(0, 10),
      )}`,
    );
  }
}

function summarize(records) {
  const dates = records.map((row) => row.trial_date).filter(Boolean).sort();
  const timestamps = records.map((row) => row.timestamp_at).filter(Boolean).sort();
  const scores = records.map((row) => row.total_score).filter((value) => value != null);
  const links = records.map((row) => row.evidence_link).filter(Boolean);
  const invalidLinks = links.filter((link) => !/^https?:\/\//i.test(link));

  return {
    records: records.length,
    id_min: Math.min(...records.map((row) => row.raw_id)),
    id_max: Math.max(...records.map((row) => row.raw_id)),
    trial_date_min: dates[0] || null,
    trial_date_max: dates[dates.length - 1] || null,
    timestamp_min: timestamps[0] || null,
    timestamp_max: timestamps[timestamps.length - 1] || null,
    total_score_count: scores.length,
    total_score_min: scores.length ? Math.min(...scores) : null,
    total_score_max: scores.length ? Math.max(...scores) : null,
    invalid_link_count: invalidLinks.length,
  };
}

async function ensureSchema(client) {
  const migrationPath = path.join(__dirname, '..', 'migrations', 'V107_trial_checkout_raw.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await client.query(sql);
}

async function insertBatch(client, records) {
  if (records.length === 0) return 0;

  const values = [];
  let paramIndex = 1;
  const tuples = records.map((record) => {
    const tuple = dbColumns.map((column) => {
      const value = column === 'raw_payload' ? JSON.stringify(record[column]) : record[column];
      values.push(value);
      return `$${paramIndex++}`;
    });
    return `(${tuple.join(', ')})`;
  });

  const updateColumns = dbColumns.filter((column) => column !== 'raw_id');
  const assignments = updateColumns
    .map((column) => `${column} = EXCLUDED.${column}`)
    .concat(['updated_at = CURRENT_TIMESTAMP'])
    .join(',\n        ');

  const sql = `
    INSERT INTO ${TABLE_NAME} (${dbColumns.join(', ')})
    VALUES ${tuples.join(',\n      ')}
    ON CONFLICT (raw_id) DO UPDATE SET
        ${assignments}
  `;

  const result = await client.query(sql, values);
  return result.rowCount || 0;
}

async function importRecords(records) {
  const pool = new Pool(buildPoolConfig());
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    if (!skipSchema) await ensureSchema(client);

    let affected = 0;
    const batchSize = 400;
    for (let start = 0; start < records.length; start += batchSize) {
      const batch = records.slice(start, start + batchSize);
      affected += await insertBatch(client, batch);
    }

    await client.query('COMMIT');
    return { affected };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function verifyImport() {
  const pool = new Pool(buildPoolConfig());
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS row_count,
        MIN(raw_id)::bigint AS min_raw_id,
        MAX(raw_id)::bigint AS max_raw_id,
        MIN(trial_date)::text AS min_trial_date,
        MAX(trial_date)::text AS max_trial_date,
        COUNT(*) FILTER (WHERE total_score IS NOT NULL)::int AS total_score_count,
        COUNT(*) FILTER (WHERE evidence_link IS NOT NULL AND evidence_link !~* '^https?://')::int AS invalid_link_count
      FROM ${TABLE_NAME}
    `);
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function main() {
  const { workbook, headers, records } = parseWorkbook(sourceFile);
  validateRecords(records);

  console.log(
    JSON.stringify(
      {
        mode: isDryRun ? 'dry-run' : 'live',
        source_file: sourceFile,
        sheets: workbook.SheetNames,
        sheet: SOURCE_SHEET,
        columns: headers,
        summary: summarize(records),
      },
      null,
      2,
    ),
  );

  if (isDryRun) return;

  const importResult = await importRecords(records);
  const verification = await verifyImport();
  console.log(JSON.stringify({ import_result: importResult, verification }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
