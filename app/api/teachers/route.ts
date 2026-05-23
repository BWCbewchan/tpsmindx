import {
  rejectIfDatasourceLookupForbidden,
  requireBearerSession,
} from "@/lib/datasource-api-auth";
import { withApiProtection } from "@/lib/api-protection";
import pool from "@/lib/db";
import { Teacher } from "@/types/teacher";
import { NextRequest, NextResponse } from "next/server";

const TEACHER_PROFILE_CSV_URL = process.env.NEXT_PUBLIC_TEACHER_PROFILE_CSV_URL || "";
const TEACHER_ONBOARDING_CSV_URL = process.env.TEACHER_ONBOARDING_CSV_URL || "";
const TEACHER_EXPERTISE_CSV_URL = process.env.NEXT_PUBLIC_TEACHER_EXPERTISE_CSV_URL || "";
const TEACHER_EXPERIENCE_CSV_URL = process.env.NEXT_PUBLIC_TEACHER_EXPERIENCE_CSV_URL || "";
const SHEET_FETCH_TIMEOUT_MS = 30000;
const SHEET_FETCH_RETRIES = 3;
const SHEET_RETRY_DELAY_MS = 500;

// In-memory cache with global persistence for dev mode and pending promise tracking
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheStore {
  teachers: CacheEntry<Teacher[]> | null;
  expertiseRaw: CacheEntry<string> | null;
  experienceRaw: CacheEntry<string> | null;
  pendingRequests: {
    teachers: Promise<Teacher[]> | null;
    expertiseRaw: Promise<string> | null;
    experienceRaw: Promise<string> | null;
  };
}

const globalForCache = global as unknown as { teacherCache: CacheStore };

// Ensure cache structure is valid (handle migration from old cache structure in dev)
let cache: CacheStore;

if (globalForCache.teacherCache && globalForCache.teacherCache.pendingRequests) {
  cache = globalForCache.teacherCache;
} else {
  cache = {
    teachers: null,
    expertiseRaw: null,
    experienceRaw: null,
    pendingRequests: {
      teachers: null,
      expertiseRaw: null,
      experienceRaw: null,
    }
  };
}

if (process.env.NODE_ENV !== "production") globalForCache.teacherCache = cache;

const CACHE_TTL = 5 * 60 * 1000; // 5 phút

const ONBOARDING_HEADERS = [
  "No",
  "Full name",
  "Code",
  "User name",
  "Work email",
  "Personal email",
  "Phone number",
  "Status (update)",
  "Centers",
  "Khối final",
  "Role",
  "Course line",
  "Rank",
  "Joined date",
  "Teacher point",
  "Data HR (Raw)",
  "Status check",
  "BU check",
  "Khối check",
  "CHECK",
  "TE quản lý",
  "Leader quản lý",
  "Rate K12 check",
  "Rank K12 check",
] as const;

type OnboardingHeader = typeof ONBOARDING_HEADERS[number];
type OnboardingRow = Partial<Record<OnboardingHeader, string>>;

function isCacheValid<T>(entry: CacheEntry<T> | null): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error: unknown): boolean {
  const err = error as any;
  const message = String(err?.message || "").toLowerCase();
  const causeCode = String(err?.cause?.code || "").toUpperCase();

  return (
    causeCode === "UND_ERR_SOCKET" ||
    causeCode === "ECONNRESET" ||
    causeCode === "ETIMEDOUT" ||
    message.includes("fetch failed") ||
    message.includes("socket") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    err?.name === "AbortError" ||
    err?.name === "TimeoutError"
  );
}

async function fetchCsvWithRetry(
  url: string,
  label: string,
  options?: { disableRetry?: boolean },
): Promise<string> {
  if (!url) {
    throw new Error(`${label} URL is empty`);
  }

  let lastError: unknown;

  const maxRetries = options?.disableRetry ? 0 : SHEET_FETCH_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(SHEET_FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        const retryableStatus = response.status >= 500 || response.status === 429;
        if (retryableStatus && attempt < maxRetries) {
          await sleep(SHEET_RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        throw new Error(`Cannot fetch ${label}. Status: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      const retryable = isRetryableFetchError(error);
      const hasMoreAttempts = attempt < maxRetries;
      if (!retryable || !hasMoreAttempts) {
        break;
      }
      // Exponential backoff
      const delay = SHEET_RETRY_DELAY_MS * Math.pow(2, attempt);
      console.warn(`⚠️ Retrying fetch for ${label} (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms delay... Cause: ${error instanceof Error ? error.message : "Unknown"}`);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Cannot fetch ${label}`);
}

// Fetch data từ Google Sheets với caching  
async function fetchTeachersFromSheet(): Promise<Teacher[]> {
  // Ensure cache is initialized
  if (!cache || !cache.pendingRequests) {
    console.error("Cache was not initialized correctly, re-initializing...");
    cache = {
      teachers: null,
      expertiseRaw: null,
      experienceRaw: null,
      pendingRequests: {
        teachers: null,
        expertiseRaw: null,
        experienceRaw: null,
      }
    };
    globalForCache.teacherCache = cache;
  }
  
  // Kiểm tra cache
  if (isCacheValid(cache.teachers)) {
    console.log("📦 Using cached teachers data");
    return cache.teachers!.data;
  }

  // Deduplicate
  if (!cache.pendingRequests.teachers) {
    console.log("🔄 Starting fresh fetch for teachers data...");
    cache.pendingRequests.teachers = (async () => {
      const csvText = await fetchCsvWithRetry(TEACHER_PROFILE_CSV_URL, "teacher profile data");
      const lines = csvText.split("\n");
      
      // Skip first 2 rows (title row + header row)
      const dataLines = lines.slice(2).filter(line => line.trim());
      
      const teachers: Teacher[] = dataLines.map(line => {
        const columns = parseCSVLine(line).map(col => col.trim().replace(/^"|"$/g, ""));

        // Current sheet schema (row 2 header):
        // 0 No, 1 Full name, 2 Code, 3 Work email, 4 Personal email,
        // 5 Khoi final, 6 Centers, 7 Status update,
        // 8 Status - month N-1, 9 Status - month N,
        // 10 BU check, 11 Khoi check, 12 Rank K12 check,
        // 13 Joined date, 14 Leader/TE
        const latestStatus = columns[9] || columns[8] || columns[7] || "";
        
        return {
          stt: columns[0] || "",
          name: columns[1] || "",
          code: columns[2] || "",
          emailMindx: columns[3] || "",
          emailPersonal: columns[4] || "",
          status: latestStatus,
          branchIn: columns[10] || columns[6] || "",
          programIn: columns[5] || "",
          branchCurrent: columns[6] || "",
          programCurrent: columns[11] || columns[5] || "",
          manager: columns[14] || "",
          responsible: columns[11] || "",
          position: columns[12] || "",
          startDate: columns[13] || "",
          onboardBy: columns[14] || ""
        };
      });

      return teachers.filter(t => t.code);
    })();
  } else {
    console.log("⏳ Waiting for pending teachers fetch...");
  }

  try {
    const data = await cache.pendingRequests.teachers;
    
    // Lưu vào cache
    cache.teachers = {
      data,
      timestamp: Date.now()
    };
    
    console.log(`✅ Cached ${data.length} teachers`);
    return data;
  } catch (error) {
    console.error("Error fetching from Google Sheets:", error);
    // Nếu có cache cũ, dùng nó dù đã hết hạn
    if (cache.teachers) {
      console.log("⚠️ Using stale cache due to fetch error");
      return cache.teachers.data;
    }
    return [];
  } finally {
    cache.pendingRequests.teachers = null;
  }
}

// Fetch expertise scores (Chuyên sâu) với caching
// Formula: =IFERROR(AVERAGEIFS($AH:$AH, $Z:$Z, $B$3, $AK:$AK, F$10), "3T")
async function fetchExpertiseScores(teacherCode: string): Promise<{ [key: string]: string }> {
  try {
    let csvText: string;
    
    // Kiểm tra cache
    if (isCacheValid(cache.expertiseRaw)) {
      csvText = cache.expertiseRaw!.data;
    } else {
      // Deduplicate simultaneous requests
      if (!cache.pendingRequests.expertiseRaw) {
        console.log("🔄 Fetching fresh expertise data from Google Sheets...");
        cache.pendingRequests.expertiseRaw = fetchCsvWithRetry(
          TEACHER_EXPERTISE_CSV_URL,
          "expertise data"
        );
      } else {
        console.log("⏳ Waiting for pending expertise fetch...");
      }

      try {
        csvText = await cache.pendingRequests.expertiseRaw;
        
        // Lưu vào cache
        cache.expertiseRaw = {
          data: csvText,
          timestamp: Date.now()
        };
      } finally {
        // Clear pending flag so subsequent failures can retry
        cache.pendingRequests.expertiseRaw = null;
      }
      console.log("✅ Cached expertise data");
    }

    // Parse CSV và tính toán scores
    const lines = csvText.split("\n");
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    const scores: { [key: string]: number[] } = {};
    const searchCode = teacherCode.toLowerCase();
    
    for (const line of dataLines) {
      const columns = parseCSVLine(line);
      
      const code = columns[25]?.trim().toLowerCase();
      if (code !== searchCode) continue; // Skip early nếu không match
      
      const scoreStr = columns[33]?.replace(",", ".").trim();
      const dateStr = columns[36]?.trim();
      
      if (dateStr && scoreStr) {
        const score = parseFloat(scoreStr);
        if (!isNaN(score)) {
          if (!scores[dateStr]) {
            scores[dateStr] = [];
          }
          scores[dateStr].push(score);
        }
      }
    }
    
    // Calculate average for each month and normalize date format
    const result: { [key: string]: string } = {};
    for (const [month, scoreArray] of Object.entries(scores)) {
      if (scoreArray.length > 0) {
        const avg = scoreArray.reduce((a, b) => a + b, 0) / scoreArray.length;
        const normalizedMonth = month.replace(/^0(\d)\//, '$1/');
        result[normalizedMonth] = avg.toFixed(1);
      }
    }
    
    console.log(`✅ Found expertise scores for ${teacherCode}:`, Object.keys(result).length, "months");
    return result;
  } catch (error) {
    console.error("Error fetching expertise scores:", error);
    return {};
  }
}

// Fetch experience scores (Trải nghiệm) với caching
// Formula: =IFERROR(AVERAGEIFS($M:$M, $E:$E, $B$3, $P:$P, F$10), "3T")
async function fetchExperienceScores(teacherCode: string): Promise<{ [key: string]: string }> {
  try {
    let csvText: string;
    
    // Kiểm tra cache
    if (isCacheValid(cache.experienceRaw)) {
      csvText = cache.experienceRaw!.data;
    } else {
      // Deduplicate pending requests
      if (!cache.pendingRequests.experienceRaw) {
        console.log("🔄 Fetching fresh experience data from Google Sheets...");
        cache.pendingRequests.experienceRaw = fetchCsvWithRetry(
          TEACHER_EXPERIENCE_CSV_URL,
          "experience data"
        );
      } else {
        console.log("⏳ Waiting for pending experience fetch...");
      }

      try {
        csvText = await cache.pendingRequests.experienceRaw;
        
        // Lưu vào cache
        cache.experienceRaw = {
          data: csvText,
          timestamp: Date.now()
        };
      } finally {
        // Clear pending flag
        cache.pendingRequests.experienceRaw = null;
      }
      console.log("✅ Cached experience data");
    }

    // Parse CSV và tính toán scores
    const lines = csvText.split("\n");
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    const scores: { [key: string]: number[] } = {};
    const searchCode = teacherCode.toLowerCase();
    
    for (const line of dataLines) {
      const columns = parseCSVLine(line);
      
      const code = columns[4]?.trim().toLowerCase();
      if (code !== searchCode) continue; // Skip early nếu không match
      
      const scoreStr = columns[12]?.replace(",", ".").trim();
      const dateStr = columns[15]?.trim();
      
      if (dateStr && scoreStr) {
        const score = parseFloat(scoreStr);
        if (!isNaN(score)) {
          if (!scores[dateStr]) {
            scores[dateStr] = [];
          }
          scores[dateStr].push(score);
        }
      }
    }
    
    // Calculate average for each month
    const result: { [key: string]: string } = {};
    for (const [month, scoreArray] of Object.entries(scores)) {
      if (scoreArray.length > 0) {
        const avg = scoreArray.reduce((a, b) => a + b, 0) / scoreArray.length;
        result[month] = avg.toFixed(1);
      }
    }
    
    console.log(`✅ Found experience scores for ${teacherCode}:`, Object.keys(result).length, "months");
    return result;
  } catch (error) {
    console.error("Error fetching experience scores:", error);
    return {};
  }
}

// Helper function to parse CSV line with quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function buildFallbackTeacher(code: string, email: string, fullName = ""): Teacher {
  return {
    stt: "",
    name: fullName || code,
    code,
    emailMindx: email,
    emailPersonal: "",
    status: "Active",
    branchIn: "",
    programIn: "",
    branchCurrent: "",
    programCurrent: "",
    manager: "",
    responsible: "",
    position: "",
    startDate: "",
    onboardBy: "",
  };
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function mapOnboardingToTeacher(row: OnboardingRow): Teacher {
  return {
    stt: row["No"] || "",
    name: row["Full name"] || "",
    code: row["Code"] || "",
    emailMindx: row["Work email"] || "",
    emailPersonal: row["Personal email"] || "",
    status: row["Status check"] || row["Status (update)"] || "",
    branchIn: row["Centers"] || "",
    programIn: row["Khối final"] || "",
    branchCurrent: row["BU check"] || row["Centers"] || "",
    programCurrent: row["Khối check"] || row["Khối final"] || "",
    manager: row["Leader quản lý"] || "",
    responsible: row["TE quản lý"] || "",
    position: row["Role"] || "",
    startDate: row["Joined date"] || "",
    onboardBy: row["Data HR (Raw)"] || "",
  };
}

async function fetchOnboardingByWorkEmail(email: string): Promise<OnboardingRow | null> {
  if (!TEACHER_ONBOARDING_CSV_URL) return null;

  try {
    const csvText = await fetchCsvWithRetry(
      TEACHER_ONBOARDING_CSV_URL,
      "teacher onboarding data",
      { disableRetry: true },
    );
    const lines = csvText.split("\n").filter((line) => line.trim());
    const dataLines = lines.slice(2);
    const targetEmail = normalizeEmail(email);

    for (const line of dataLines) {
      const cols = parseCSVLine(line).map((col) => col.trim().replace(/^"|"$/g, ""));
      const row: OnboardingRow = {};

      ONBOARDING_HEADERS.forEach((header, idx) => {
        row[header] = cols[idx] || "";
      });

      if (normalizeEmail(row["Work email"]) === targetEmail) {
        return row;
      }
    }
  } catch (error) {
    console.warn("fetchOnboardingByWorkEmail failed:", error);
  }

  return null;
}

async function resolveTeacherFallbackByEmail(email: string): Promise<Teacher | null> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const byEmailResult = await pool.query(
      `
      SELECT teacher_code, full_name, work_email, center, teaching_block, position, status
      FROM training_teacher_stats
      WHERE LOWER(TRIM(work_email)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (byEmailResult.rows.length > 0) {
      const row = byEmailResult.rows[0];
      const teacher = buildFallbackTeacher(
        String(row.teacher_code || "").trim(),
        String(row.work_email || normalizedEmail).trim(),
        String(row.full_name || "").trim()
      );
      teacher.branchCurrent = String(row.center || "").trim();
      teacher.programCurrent = String(row.teaching_block || "").trim();
      teacher.position = String(row.position || "").trim();
      teacher.status = String(row.status || "Active").trim() || "Active";
      return teacher;
    }
  } catch (error) {
    console.warn("resolveTeacherFallbackByEmail query failed:", error);
  }

  const codeFromEmail = (email.split("@")[0] || "").trim();
  if (!codeFromEmail) {
    return null;
  }
  return buildFallbackTeacher(codeFromEmail, email);
}

export const GET = withApiProtection(async (request: NextRequest) => {
  const auth = await requireBearerSession(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const emailParam = searchParams.get("email");
  const isBasicLookup = searchParams.get("basic") === "true";
  const onboardingByEmail = emailParam ? await fetchOnboardingByWorkEmail(emailParam) : null;

  if (!code && !emailParam) {
    return NextResponse.json(
      { error: "Vui lòng cung cấp mã giáo viên hoặc email" },
      { status: 400 }
    );
  }

  const denied = await rejectIfDatasourceLookupForbidden(
    auth.sessionEmail,
    auth.privileged,
    String(emailParam || "").trim().toLowerCase(),
    String(code || "").trim(),
  );
  if (denied) return denied;

  // Fetch teachers từ Google Sheets
  const teachers = await fetchTeachersFromSheet();

  // Tìm học theo code hoặc email (fallback)
  let teacher: Teacher | undefined;

  if (code) {
    const searchCode = code.trim().toLowerCase();
    teacher = teachers.find(
      (t) => t.code.toLowerCase().trim() === searchCode
    );

    if (!teacher) {
      if (auth.privileged) {
        const availableCodes = teachers.slice(0, 10).map(t => t.code).join(", ");
        return NextResponse.json(
          { 
            error: `Không tìm thấy giáo viên với mã "${code}". Một số mã có sẵn: ${availableCodes}...`,
            totalTeachers: teachers.length,
            sampleCodes: teachers.slice(0, 20).map(t => ({ code: t.code, name: t.name }))
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `Không tìm thấy giáo viên với mã đã nhập` },
        { status: 404 }
      );
    }
  } else if (emailParam) {
    const normalizedEmail = emailParam.trim().toLowerCase();
    if (onboardingByEmail) {
      teacher = mapOnboardingToTeacher(onboardingByEmail);
    } else {
      teacher = teachers.find(t =>
        (t.emailMindx || '').toLowerCase().trim() === normalizedEmail ||
        (t.emailPersonal || '').toLowerCase().trim() === normalizedEmail
      );
    }

    if (!teacher) {
      const fallbackTeacher = await resolveTeacherFallbackByEmail(normalizedEmail);
      if (fallbackTeacher) {
        if (isBasicLookup) {
          return NextResponse.json({ teacher: fallbackTeacher, fallback: true, onboardingData: null });
        }
        teacher = fallbackTeacher;
      } else {
        return NextResponse.json(
          { error: `Không tìm thấy giáo viên với email "${emailParam}"` },
          { status: 404 }
        );
      }
    }
  }

  // Ensure teacher is defined before continuing
  if (!teacher) {
    return NextResponse.json(
      { error: "Không tìm thấy giáo viên" },
      { status: 404 }
    );
  }

  // Fetch real monthly metrics từ Google Sheets
  if (isBasicLookup) {
    return NextResponse.json({ teacher, onboardingData: onboardingByEmail || null });
  }

  // Fetch real monthly metrics từ Google Sheets
  const [expertiseScores, experienceScores] = await Promise.all([
    fetchExpertiseScores(teacher.code),
    fetchExperienceScores(teacher.code)
  ]);

  // Initialize với "3T" cho tất cả các tháng
  const currentYear = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => `${i + 1}/${currentYear}`);
  
  teacher.monthlyMetrics = {
    expertise: {},
    experience: {}
  };

  // Set scores hoặc "3T" nếu không có dữ liệu
  months.forEach(month => {
    teacher.monthlyMetrics!.expertise[month] = expertiseScores[month] || "3T";
    teacher.monthlyMetrics!.experience[month] = experienceScores[month] || "3T";
  });

  // Optimized response with caching headers
  const response = NextResponse.json({ teacher, onboardingData: onboardingByEmail || null });
  
  // Add performance headers
  response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  response.headers.set('X-Served-From', 'cache');
  response.headers.set('X-Teacher-Count', teachers.length.toString());
  
  return response;
});
