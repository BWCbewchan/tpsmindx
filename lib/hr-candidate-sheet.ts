import { createHash } from 'crypto';

const DEFAULT_CACHE_TTL_MS = 2 * 60 * 1000;

function hrSheetFallbackFromEnv(): { sheetId?: string; gid?: string } {
  return {
    sheetId: process.env.HR_CANDIDATE_SHEET_ID?.trim(),
    gid: process.env.HR_CANDIDATE_SHEET_GID?.trim(),
  };
}

function resolveHrSheetIds(
  sheetId: string | undefined,
  gid: string | undefined,
): { sheetId: string; gid: string } {
  const s = sheetId?.trim();
  const g = gid?.trim();
  if (!s || !g) {
    throw new Error(
      'Thiếu sheet id/gid: đặt HR_CANDIDATE_SHEET_CSV_URL đầy đủ hoặc HR_CANDIDATE_SHEET_ID + HR_CANDIDATE_SHEET_GID trong .env.',
    );
  }
  return { sheetId: s, gid: g };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface HrCandidateSheetCacheStore {
  entry: CacheEntry<HrCandidateSheetData> | null;
  pending: Promise<HrCandidateSheetData> | null;
}

interface SheetSource {
  sheetId: string;
  gid: string;
  csvUrl: string;
}

export interface HrSheetCandidate {
  rowNumber: number;
  candidateKey: string;
  candidateFingerprint: string;
  candidateCode: string;
  regionCode: '1' | '2' | '3' | '4' | '5' | '';
  name: string;
  email: string;
  phone: string;
  status: string;
  desiredCampus: string;
  workBlock: string;
  subjectCode: string;
  desiredProgram: string;
  sheetGen: string;
  raw: Record<string, string>;
}

export interface HrCandidateSheetData {
  source: SheetSource;
  headers: string[];
  fetchedAt: string;
  availableGens: string[];
  candidates: HrSheetCandidate[];
}

const globalForHrSheetCache = global as unknown as { hrCandidateSheetCache?: HrCandidateSheetCacheStore };

let cacheStore: HrCandidateSheetCacheStore;

if (globalForHrSheetCache.hrCandidateSheetCache) {
  cacheStore = globalForHrSheetCache.hrCandidateSheetCache;
} else {
  cacheStore = { entry: null, pending: null };
  globalForHrSheetCache.hrCandidateSheetCache = cacheStore;
}

function getCacheTtlMs() {
  const configured = Number(process.env.HR_CANDIDATE_CACHE_TTL_MS || DEFAULT_CACHE_TTL_MS);
  if (Number.isNaN(configured) || configured <= 0) return DEFAULT_CACHE_TTL_MS;
  return configured;
}

function isCacheValid(entry: CacheEntry<HrCandidateSheetData> | null) {
  if (!entry) return false;
  return Date.now() - entry.timestamp < getCacheTtlMs();
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanCell(value: string | undefined) {
  return (value || '').replace(/\r/g, '').trim();
}

function normalizeRegionCode(value: string): '1' | '2' | '3' | '4' | '5' | '' {
  const normalized = cleanCell(value);
  return ['1', '2', '3', '4', '5'].includes(normalized) ? (normalized as '1' | '2' | '3' | '4' | '5') : '';
}

function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  
  // Remove BOM if present
  const text = csvText.replace(/\uFEFF/g, '');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentCell += '"';
        i++; // skip the escaped quote
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(cleanCell(currentCell));
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      // Handle \r\n
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      currentRow.push(cleanCell(currentCell));
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(cleanCell(currentCell));
    rows.push(currentRow);
  }

  return rows;
}

function pickColumnIndex(normalizedHeaders: string[], aliases: string[]) {
  return normalizedHeaders.findIndex((header) => aliases.some((alias) => header === alias || header.includes(alias)));
}

function findHeaderRow(rows: string[][]): number {
  const maxRows = Math.min(rows.length, 8);
  let bestRow = 0;
  let bestScore = -1;

  for (let i = 0; i < maxRows; i++) {
    const normalized = rows[i].map((cell) => normalizeText(cell));
    const hasName = normalized.some((cell) => cell.includes('ho ten') || cell.includes('name') || cell.includes('ung vien'));
    const hasEmail = normalized.some((cell) => cell.includes('email') || cell.includes('mail'));
    const hasGen = normalized.some((cell) => cell === 'gen' || cell.includes('nhom gen'));

    const score = [hasName, hasEmail, hasGen].filter(Boolean).length;
    if (score > bestScore) {
      bestRow = i;
      bestScore = score;
    }
  }

  return bestRow;
}

function extractSheetInfoFromUrl(rawUrl: string | undefined): SheetSource {
  const fb = hrSheetFallbackFromEnv();

  if (!rawUrl?.trim()) {
    const { sheetId, gid } = resolveHrSheetIds(fb.sheetId, fb.gid);
    return {
      sheetId,
      gid,
      csvUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    };
  }

  try {
    const parsed = new URL(rawUrl);
    const pathMatch = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    const gidFromQuery = parsed.searchParams.get('gid');
    const gidFromHash = parsed.hash.match(/gid=(\d+)/)?.[1];
    const merged = resolveHrSheetIds(
      pathMatch?.[1] || fb.sheetId,
      gidFromQuery || gidFromHash || fb.gid,
    );

    return {
      sheetId: merged.sheetId,
      gid: merged.gid,
      csvUrl: `https://docs.google.com/spreadsheets/d/${merged.sheetId}/export?format=csv&gid=${merged.gid}`,
    };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Thiếu sheet')) throw e;
    const { sheetId, gid } = resolveHrSheetIds(fb.sheetId, fb.gid);
    return {
      sheetId,
      gid,
      csvUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    };
  }
}

export function buildCandidateFingerprint(input: {
  name?: string;
  email?: string;
  phone?: string;
  rowNumber?: number;
}) {
  const normalizedEmail = normalizeText(input.email || '');
  const normalizedPhone = (input.phone || '').replace(/\D+/g, '');
  const normalizedName = normalizeText(input.name || '');

  const fingerprint = [normalizedEmail, normalizedPhone, normalizedName].filter(Boolean).join('|');
  return fingerprint || `row-${input.rowNumber || 0}`;
}

export function buildCandidateKey(fingerprint: string) {
  return createHash('sha256').update(fingerprint).digest('hex');
}

async function fetchAndParseSheet(): Promise<HrCandidateSheetData> {
  const source = extractSheetInfoFromUrl(process.env.HR_CANDIDATE_SHEET_CSV_URL);
  const response = await fetch(source.csvUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Không thể đọc sheet HR (HTTP ${response.status})`);
  }

  const csvText = await response.text();

  if (
    /ServiceLogin/i.test(csvText) ||
    /accounts\.google\.com/i.test(csvText) ||
    /<html/i.test(csvText)
  ) {
    throw new Error('Sheet HR chưa public CSV hoặc chưa cấp quyền cho service account. Vui lòng chia sẻ quyền đọc để hệ thống có thể đồng bộ.');
  }

  const rows = parseCsv(csvText).filter((cells) => cells.some((cell) => cell.trim()));
  if (rows.length === 0) {
    return {
      source,
      headers: [],
      fetchedAt: new Date().toISOString(),
      availableGens: [],
      candidates: [],
    };
  }

  const headerRowIndex = findHeaderRow(rows);
  const headerRow = rows[headerRowIndex].map((header, index) => {
    const cleaned = cleanCell(header);
    return cleaned || `Column ${index + 1}`;
  });

  const normalizedHeaders = headerRow.map((header) => normalizeText(header));

  const nameIndex = pickColumnIndex(normalizedHeaders, ['ho va ten', 'ho ten', 'ten ung vien', 'ten uv', 'ten', 'full name', 'candidate name', 'name']);
  const emailIndex = pickColumnIndex(normalizedHeaders, ['email', 'mail']);
  const phoneIndex = pickColumnIndex(normalizedHeaders, ['so dien thoai', 'dien thoai', 'sdt', 'phone', 'mobile']);
  const statusIndex = pickColumnIndex(normalizedHeaders, ['trang thai', 'status', 'stage']);
  const genIndex = pickColumnIndex(normalizedHeaders, ['gen', 'nhom gen']);
  const regionCodeIndex = pickColumnIndex(normalizedHeaders, ['ma khu vuc', 'region code', 'khu vuc']);
  const candidateCodeIndex = pickColumnIndex(normalizedHeaders, ['ma ung vien', 'ma uv', 'candidate code', 'candidate id', 'application id']);
  const desiredCampusIndex = pickColumnIndex(normalizedHeaders, ['co so mong muon', 'co so lam viec', 'desired campus', 'desired branch', 'campus mong muon']);
  const workBlockIndex = pickColumnIndex(normalizedHeaders, ['khoi lam viec', 'work block', 'teaching block', 'khoi giang day']);
  const subjectCodeIndex = pickColumnIndex(normalizedHeaders, ['ma mon', 'subject code', 'ma bo mon', 'ma mon hoc']);
  const desiredProgramIndex = pickColumnIndex(normalizedHeaders, ['chuong trinh', 'program', 'bo mon', 'specialization']);

  import('fs').then(fs => {
    fs.writeFileSync('/tmp/hr-candidate-parser-debug.txt', JSON.stringify({
      normalizedHeaders,
      nameIndex,
      phoneIndex,
      regionCodeIndex,
      candidateCodeIndex,
    }, null, 2));
  });

  const candidates: HrSheetCandidate[] = [];
  const genSet = new Set<string>();

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const nonEmptyCells = row.filter((cell) => cell.trim()).length;
    if (nonEmptyCells === 0) continue;

    const candidate: HrSheetCandidate = {
      rowNumber: i + 1,
      candidateKey: '',
      candidateFingerprint: '',
      candidateCode: candidateCodeIndex >= 0 ? cleanCell(row[candidateCodeIndex]) : '',
      regionCode: regionCodeIndex >= 0 ? normalizeRegionCode(row[regionCodeIndex]) : '',
      name: nameIndex >= 0 ? cleanCell(row[nameIndex]) : '',
      email: emailIndex >= 0 ? cleanCell(row[emailIndex]).toLowerCase() : '',
      phone: phoneIndex >= 0 ? cleanCell(row[phoneIndex]) : '',
      status: statusIndex >= 0 ? cleanCell(row[statusIndex]) : '',
      desiredCampus: desiredCampusIndex >= 0 ? cleanCell(row[desiredCampusIndex]) : '',
      workBlock: workBlockIndex >= 0 ? cleanCell(row[workBlockIndex]) : '',
      subjectCode: subjectCodeIndex >= 0 ? cleanCell(row[subjectCodeIndex]) : '',
      desiredProgram: desiredProgramIndex >= 0 ? cleanCell(row[desiredProgramIndex]) : '',
      sheetGen: genIndex >= 0 ? cleanCell(row[genIndex]) : '',
      raw: {},
    };

    for (let col = 0; col < headerRow.length; col++) {
      candidate.raw[headerRow[col]] = cleanCell(row[col]);
    }

    if (!candidate.name && !candidate.email && !candidate.phone && nonEmptyCells < 2) {
      continue;
    }

    candidate.candidateFingerprint = buildCandidateFingerprint({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      rowNumber: candidate.rowNumber,
    });
    candidate.candidateKey = buildCandidateKey(candidate.candidateFingerprint);

    if (candidate.sheetGen) {
      genSet.add(candidate.sheetGen);
    }

    candidates.push(candidate);
  }

  return {
    source,
    headers: headerRow,
    fetchedAt: new Date().toISOString(),
    availableGens: Array.from(genSet).sort((a, b) => a.localeCompare(b, 'vi')),
    candidates,
  };
}

export async function getHrCandidateSheetData(forceRefresh = false): Promise<HrCandidateSheetData> {
  if (!forceRefresh && isCacheValid(cacheStore.entry)) {
    return cacheStore.entry!.data;
  }

  if (!forceRefresh && cacheStore.pending) {
    return cacheStore.pending;
  }

  cacheStore.pending = (async () => {
    const data = await fetchAndParseSheet();
    cacheStore.entry = {
      data,
      timestamp: Date.now(),
    };
    return data;
  })();

  try {
    return await cacheStore.pending;
  } catch (error) {
    if (cacheStore.entry) {
      return cacheStore.entry.data;
    }
    throw error;
  } finally {
    cacheStore.pending = null;
  }
}
