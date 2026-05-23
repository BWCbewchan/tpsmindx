import type { Teacher } from "@/types/teacher";

function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}

/** Map one row from `teachers` (API `/api/teachers/info`) to legacy `Teacher` used across the app. */
export function mapTeachersDbRowToTeacher(row: Record<string, unknown>): Teacher {
  return {
    stt: "",
    name: str(row, "full_name") || str(row, "code"),
    code: str(row, "code"),
    emailMindx: str(row, "work_email"),
    emailPersonal: str(row, "personal_email"),
    status: str(row, "status") || str(row, "status_check") || str(row, "status_update") || "Active",
    branchIn: str(row, "centers"),
    programIn: str(row, "khoi_final"),
    branchCurrent: str(row, "bu_check") || str(row, "main_centre") || str(row, "centers"),
    programCurrent: str(row, "khoi_check") || str(row, "khoi_final"),
    manager: str(row, "leader_quan_ly"),
    responsible: str(row, "te_quan_ly"),
    position: str(row, "role"),
    startDate: str(row, "joined_date"),
    onboardBy: str(row, "data_hr_raw"),
  };
}

/** Body JSON from `GET /api/teachers/info` → `{ teacher: Teacher }` for SWR / legacy callers. */
export function parseLegacyTeacherFromInfoJson(data: unknown): { teacher: Teacher } | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { success?: boolean; teacher?: Record<string, unknown> };
  if (!d.success || !d.teacher || typeof d.teacher !== "object") return null;
  return { teacher: mapTeachersDbRowToTeacher(d.teacher) };
}

/**
 * Use with SWR + authenticated fetchers that return parsed JSON.
 * Throws if response is not a successful teacher payload (same as old `/api/teachers` shape).
 */
export async function fetchTeacherInfoAsLegacy(
  fetchJson: (url: string) => Promise<unknown>,
  url: string
): Promise<{ teacher: Teacher }> {
  const raw = await fetchJson(url);
  const parsed = parseLegacyTeacherFromInfoJson(raw);
  if (!parsed) {
    const err = new Error("Teacher not found") as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  return parsed;
}
