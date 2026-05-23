"use client";

import { PageContainer } from "@/components/PageContainer";
import { Stepper } from "@/components/ui/stepper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AnimatedCalendar, type CalendarLocale } from "@/components/ui/calender";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseCsvToRows } from "@/lib/csv-registration-import";
import {
  IMPORT_LOG_STORAGE_MAX,
  IMPORT_UI_STORAGE_KEY,
  clearImportRecoveryStorage,
  notifyImportRecoveryChanged,
  type ImportUiStored,
} from "@/lib/exam-registration-import-storage";
import { parseXlsxRegistrationSheet } from "@/lib/xlsx-registration-import";
import { format, getMonth, getYear } from "date-fns";
import { vi } from "date-fns/locale";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileDown,
  Info,
  RefreshCw,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { toast } from "@/lib/app-toast";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/** Chuẩn hóa để tìm không dấu, không phân biệt hoa thường */
function normalizeVn(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

interface RegistrationRow {
  id: number;
  teacher_code: string;
  exam_type: string;
  registration_type: "official" | "additional";
  block_code: string;
  subject_code: string;
  subject_name: string | null;
  center_code: string | null;
  scheduled_at: string;
  source_form: string;
  created_at: string;
  assignment_id: number | null;
  assignment_status: string | null;
  score: number | null;
  score_status: string | null;
  xu_ly_diem: string | null;
  tong_diem_bi_tru: number | null;
  dang_ky_luc: string | null;
  open_at: string | null;
  close_at: string | null;
  selected_set_id: number | null;
  random_assigned_at: string | null;
  set_code: string | null;
  set_name: string | null;
  total_points: number | null;
  passing_score: number | null;
  da_giai_thich: boolean | null;
}

type ImportLineResult = {
  line: number;
  ok: boolean;
  id?: unknown;
  error?: string;
  result_id?: number;
};

type ImportLogState = {
  fileName: string;
  imported: number;
  total: number;
  failedCount: number;
  results: ImportLineResult[];
  sourceRows: Record<string, string>[];
};

/** Gom lỗi từng dòng trong một lô — để log biết lỗi từ server (insertExamRegistration). */
function summarizeBatchErrors(batchResults: ImportLineResult[]): string {
  const failed = batchResults.filter((r) => !r.ok);
  if (failed.length === 0) return "";
  const byMsg = new Map<string, number>();
  for (const r of failed) {
    const m = (r.error ?? "Lỗi không rõ").trim();
    byMsg.set(m, (byMsg.get(m) ?? 0) + 1);
  }
  const parts = [...byMsg.entries()].map(([msg, n]) => (n > 1 ? `${msg} (${n}×)` : msg));
  return parts.join(" · ");
}

/** Chi tiết lỗi một dòng import + cột Mã môn / Môn từ file (khi server chưa kèm đủ). */
function formatImportFailDetail(
  res: ImportLineResult,
  lineStart: number,
  slice: Record<string, string>[]
): string {
  const idx = res.line - lineStart;
  const row = slice[idx];
  const base = `dòng ${res.line}: ${res.error ?? "?"}`;
  if (!row) return base;
  const mm = row["Mã môn"]?.trim() || row["ma_mon"]?.trim() || row["subject_code"]?.trim() || "";
  const mon = row["Môn"]?.trim() || row["ten_mon"]?.trim() || "";
  if (!mm && !mon) return base;
  const fileHint =
    mon && mon !== mm ? ` — trên file: Mã môn="${mm || "—"}" · Môn="${mon}"` : ` — trên file: Mã môn="${mm || mon}"`;
  return `${base}${fileHint}`;
}

function previewImportRow(r: Record<string, string>): string {
  const gv = r["Mã GV"]?.trim() || r["ma_giao_vien"]?.trim() || r["teacher_code"]?.trim() || "";
  const khoi = r["Khối"]?.trim() || r["khoi_giang_day"]?.trim() || r["block_code"]?.trim() || "";
  const mm = r["Mã môn"]?.trim() || r["ma_mon"]?.trim() || r["subject_code"]?.trim() || "";
  const mon = r["Môn"]?.trim() || r["ten_mon"]?.trim() || "";
  const lich = r["Lịch thi"]?.trim() || r["lich_thi"]?.trim() || "";
  const parts: string[] = [];
  if (gv) parts.push(`GV ${gv}`);
  if (khoi) parts.push(`Khối ${khoi}`);
  if (mm) parts.push(mm);
  if (mon && mon !== mm) parts.push(mon);
  if (lich) parts.push(lich);
  if (parts.length) return parts.join(" · ");
  const flat = Object.values(r)
    .map((v) => String(v).trim())
    .filter(Boolean);
  return flat.slice(0, 4).join(" · ") || "(dòng trống)";
}

const PAGE_SIZE = 50;

/** Khối phổ biến trong dữ liệu xuất (CSV) — lọc nhanh */
const QUICK_BLOCKS = ["CODING", "ART", "ROBOTICS"] as const;

const REG_FILTER_CALENDAR_VI: Partial<CalendarLocale> = {
  weekdays: ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"],
  weekdaysShort: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
  months: [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
  ],
  monthsShort: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"],
  today: "Tháng này",
  clear: "Xóa",
  close: "Đóng",
  selectTime: "Chọn giờ",
  backToCalendar: "Về lịch",
  selected: "đã chọn",
  weekNumber: "Tuần",
};

interface ExamSubjectRow {
  id: number;
  block_code: string;
  subject_code: string;
  subject_name: string | null;
}

/** mm/yyyy, yyyy-mm, v.v. */
type PeriodParseResult = "empty" | { month: string; year: string } | null;

function parseMonthYearText(raw: string): PeriodParseResult {
  const t = raw.trim();
  if (!t) return "empty";
  const d1 = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/u.exec(t);
  if (d1) {
    const mo = parseInt(d1[1], 10);
    const yr = parseInt(d1[2], 10);
    if (mo >= 1 && mo <= 12 && yr >= 1900 && yr <= 2100) {
      return { month: String(mo).padStart(2, "0"), year: String(yr) };
    }
    return null;
  }
  const d2 = /^(\d{4})\s*[/.-]\s*(\d{1,2})$/u.exec(t);
  if (d2) {
    const yr = parseInt(d2[1], 10);
    const mo = parseInt(d2[2], 10);
    if (mo >= 1 && mo <= 12 && yr >= 1900 && yr <= 2100) {
      return { month: String(mo).padStart(2, "0"), year: String(yr) };
    }
    return null;
  }
  return null;
}

function ymWithinBounds(y: number, m: number, minD: Date, maxD: Date): boolean {
  const t = y * 12 + (m - 1);
  const tMin = minD.getFullYear() * 12 + minD.getMonth();
  const tMax = maxD.getFullYear() * 12 + maxD.getMonth();
  return t >= tMin && t <= tMax;
}

export default function ExamRegistrationListPage() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  /** Poll phát hiện thay đổi → fetch silent — hiệu ứng nút Làm mới / phân trang */
  const [silentListLoading, setSilentListLoading] = useState(false);
  const listFetchBusy = loading || silentListLoading;
  const [searchTeacherCode, setSearchTeacherCode] = useState("");
  /** "all" | YYYY */
  const [filterYear, setFilterYear] = useState<string>("all");
  /** "all" | "01".."12" */
  const [filterMonth, setFilterMonth] = useState<string>("all");
  /** Gõ tay tháng/năm — đồng bộ khi không đang focus ô gõ */
  const [periodInput, setPeriodInput] = useState("");
  const periodFieldFocusedRef = useRef(false);
  /** Rỗng = tất cả; nhiều mã → API OR */
  const [filterSubjectCodes, setFilterSubjectCodes] = useState<string[]>([]);
  const [filterBlockCodes, setFilterBlockCodes] = useState<string[]>([]);
  /** Gõ để lọc danh sách checkbox (không gửi API) */
  const [blockListQuery, setBlockListQuery] = useState("");
  const [subjectListQuery, setSubjectListQuery] = useState("");
  const [examSubjects, setExamSubjects] = useState<ExamSubjectRow[]>([]);
  const [filterRegType, setFilterRegType] = useState<"all" | "official" | "additional">("all");
  const [filterXuLy, setFilterXuLy] = useState<
    "all" | "chờ giải trình" | "đã duyệt" | "từ chối" | "đã hoàn thành"
  >("all");
  const [filterHasScore, setFilterHasScore] = useState<"all" | "has" | "none">("all");
  const [removingRegistrationId, setRemovingRegistrationId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importActivityLog, setImportActivityLog] = useState<string[]>([]);
  const [importLogOpen, setImportLogOpen] = useState(false);
  const [importLog, setImportLog] = useState<ImportLogState | null>(null);
  const [confirmStopImportOpen, setConfirmStopImportOpen] = useState(false);
  /** Thu gọn / mở rộng khối bộ lọc */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importActivityLogRef = useRef<HTMLDivElement>(null);
  /** Dừng giữa các lô / hủy request đang chạy */
  const importCancelRef = useRef(false);
  const importAbortRef = useRef<AbortController | null>(null);
  /** Dùng trong beforeunload — closure luôn có % và log mới nhất */
  const importHudRef = useRef({ progress: 0, log: [] as string[] });
  importHudRef.current = { progress: importProgress, log: importActivityLog };
  const pageRef = useRef(1);
  pageRef.current = page;
  /** So khớp poll nhẹ với GET đầy đủ — đổi DB thì tự làm mới danh sách */
  const listSyncKeyRef = useRef<string | null>(null);

  const teacherDebounced = useDebouncedValue(searchTeacherCode, 380);
  /** Khối / môn: chọn từ danh sách — áp dụng ngay */

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/exam-subjects");
        const data = await res.json();
        if (cancelled || !data?.success || !Array.isArray(data.data)) return;
        setExamSubjects(
          data.data.map((r: Record<string, unknown>) => ({
            id: Number(r.id),
            block_code: String(r.block_code ?? ""),
            subject_code: String(r.subject_code ?? ""),
            subject_name: r.subject_name != null ? String(r.subject_name) : null,
          })),
        );
      } catch {
        if (!cancelled) setExamSubjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Ghi tiến độ khi đang import; xóa khi xong (để lần sau không nhầm) */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!importing) {
      sessionStorage.removeItem(IMPORT_UI_STORAGE_KEY);
      return;
    }
    try {
      const log =
        importActivityLog.length > IMPORT_LOG_STORAGE_MAX
          ? importActivityLog.slice(-IMPORT_LOG_STORAGE_MAX)
          : importActivityLog;
      const payload: ImportUiStored = {
        v: 1,
        phase: "running",
        progress: importProgress,
        log,
        updatedAt: Date.now(),
      };
      sessionStorage.setItem(IMPORT_UI_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota */
    }
  }, [importing, importProgress, importActivityLog]);

  /** Cảnh báo + flush cuối khi đóng tab / F5 (mobile: thêm pagehide) */
  useEffect(() => {
    if (!importing) return;
    const flush = () => {
      try {
        const { progress, log } = importHudRef.current;
        const slice = log.length > IMPORT_LOG_STORAGE_MAX ? log.slice(-IMPORT_LOG_STORAGE_MAX) : log;
        const payload: ImportUiStored = {
          v: 1,
          phase: "running",
          progress,
          log: slice,
          updatedAt: Date.now(),
        };
        sessionStorage.setItem(IMPORT_UI_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flush();
      e.preventDefault();
      e.returnValue = "";
    };
    const onPageHide = () => flush();
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [importing]);

  useEffect(() => {
    if (!importing || !importActivityLog.length || !importActivityLogRef.current) return;
    importActivityLogRef.current.scrollTop = importActivityLogRef.current.scrollHeight;
  }, [importActivityLog, importing]);

  const toggleBlockCode = useCallback((code: string) => {
    const u = code.trim();
    if (!u) return;
    setFilterBlockCodes((prev) => {
      const hit = prev.findIndex((c) => c.toUpperCase() === u.toUpperCase());
      if (hit >= 0) return prev.filter((_, i) => i !== hit);
      return [...prev, u];
    });
  }, []);

  const toggleSubjectCode = useCallback((code: string) => {
    const u = code.trim();
    if (!u) return;
    setFilterSubjectCodes((prev) => {
      const hit = prev.findIndex((c) => c.toUpperCase() === u.toUpperCase());
      if (hit >= 0) return prev.filter((_, i) => i !== hit);
      return [...prev, u];
    });
  }, []);

  /** Bộ lọc — `textFields` dùng giá trị đã debounce khi gọi từ fetchRows / export */
  const appendListFilters = (
    params: URLSearchParams,
    textFields?: { teacher?: string; subjectCodes?: string[]; blockCodes?: string[] },
  ) => {
    const gv = (textFields?.teacher ?? searchTeacherCode).trim();
    if (gv) params.set("teacher_code", gv);
    const y = filterYear;
    const mo = filterMonth;
    if (y !== "all" && mo !== "all") {
      params.set("month", `${y}-${mo}`);
    } else if (y !== "all") {
      params.set("nam_dk", y);
    } else if (mo !== "all") {
      params.set("thang_dk", String(parseInt(mo, 10)));
    }
    const subj = textFields?.subjectCodes ?? filterSubjectCodes;
    if (subj.length > 0) params.set("subject_q", subj.join(","));
    const blocks = textFields?.blockCodes ?? filterBlockCodes;
    if (blocks.length > 0) params.set("block_q", blocks.join(","));
    if (filterRegType !== "all") params.set("registration_type", filterRegType);
    if (filterXuLy !== "all") params.set("xu_ly_diem", filterXuLy);
    if (filterHasScore !== "all") params.set("has_score", filterHasScore === "has" ? "1" : "0");
  };

  const fetchRows = useCallback(
    async (nextPage?: number, opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      const targetPage = nextPage ?? pageRef.current;
      if (!silent) {
        listSyncKeyRef.current = null;
      }
      try {
        if (!silent) setLoading(true);
        else setSilentListLoading(true);

        const params = new URLSearchParams();
        appendListFilters(params, {
          teacher: teacherDebounced,
          subjectCodes: filterSubjectCodes,
          blockCodes: filterBlockCodes,
        });
        params.set("limit", String(PAGE_SIZE));
        params.set("page", String(targetPage));

        const response = await fetch(`/api/exam-registrations?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
          setRows(data.data || []);
          setTotal(typeof data.total === "number" ? data.total : (data.data?.length ?? 0));
          setPage(targetPage);
        } else {
          toast.error(data.error || "Không thể tải danh sách đăng ký");
        }
      } catch (error) {
        console.error("Error fetching registrations:", error);
        toast.error("Có lỗi xảy ra khi tải danh sách đăng ký");
      } finally {
        if (!silent) setLoading(false);
        else setSilentListLoading(false);
      }
    },
    [
      teacherDebounced,
      filterSubjectCodes,
      filterBlockCodes,
      filterYear,
      filterMonth,
      filterRegType,
      filterXuLy,
      filterHasScore,
    ],
  );

  useEffect(() => {
    void fetchRows(1);
  }, [fetchRows]);

  /** Poll DB nhẹ (sync_check): chỉ dừng khi unmount (đóng tab / rời route), không phụ thuộc tab ẩn hay đang import */
  useEffect(() => {
    const POLL_MS = 20_000;
    const check = async () => {
      if (typeof window === "undefined") return;
      try {
        const params = new URLSearchParams();
        appendListFilters(params, {
          teacher: teacherDebounced,
          subjectCodes: filterSubjectCodes,
          blockCodes: filterBlockCodes,
        });
        params.set("sync_check", "1");
        const response = await fetch(`/api/exam-registrations?${params.toString()}`);
        const data = await response.json();
        if (!data?.success || !data.sync) return;
        const key = `${data.sync.total}|${data.sync.maxChangedAt ?? ""}`;
        if (listSyncKeyRef.current === null) {
          listSyncKeyRef.current = key;
          return;
        }
        if (listSyncKeyRef.current !== key) {
          listSyncKeyRef.current = key;
          await fetchRows(pageRef.current, { silent: true });
          toast.success("Đã cập nhật danh sách (có thay đổi từ máy chủ).");
        }
      } catch {
        /* bỏ qua lỗi mạng tạm */
      }
    };
    const id = window.setInterval(() => void check(), POLL_MS);
    /* Về lại tab: check ngay để thấy data mới (poll nền vẫn chạy khi tab ẩn) */
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [
    teacherDebounced,
    filterSubjectCodes,
    filterBlockCodes,
    filterYear,
    filterMonth,
    filterRegType,
    filterXuLy,
    filterHasScore,
    fetchRows,
  ]);

  /** Khi đổi bộ lọc nhưng vẫn đang ở trang > 1, API có thể trả 0 dòng trong khi total > 0 — tự tải lại trang 1. */
  useEffect(() => {
    if (loading || silentListLoading) return;
    if (rows.length === 0 && total > 0 && page > 1) {
      void fetchRows(1);
    }
  }, [loading, silentListLoading, rows.length, total, page, fetchRows]);

  const handleSetPending = async (row: RegistrationRow) => {
    if (!row.assignment_id) {
      toast.error("Đăng ký này đã ở trạng thái pending");
      return;
    }

    const confirmed = window.confirm(
      `Đưa đăng ký của GV ${row.teacher_code} (${row.subject_name || row.subject_code}) về trạng thái pending?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setRemovingRegistrationId(row.id);

      const response = await fetch('/api/exam-registrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: row.id }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể đưa về pending');
      }

      toast.success('Đã đưa đăng ký về pending');
      await fetchRows(page);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể đưa về pending');
    } finally {
      setRemovingRegistrationId(null);
    }
  };

  const exportCsv = async () => {
    const getHoStatus = (row: RegistrationRow) => {
      const xu = row.xu_ly_diem || '';
      const examGraded =
        row.assignment_status === 'graded' ||
        (row.score !== null && Number(row.score) > 0);
      if (xu === 'đã duyệt') return 'Accepted';
      if (xu === 'từ chối') return 'Rejected';
      if (examGraded || xu === 'đã hoàn thành') return 'Done';
      if (xu === 'chờ giải trình') return 'Waiting';
      if (row.score !== null) return 'Done';
      return 'Pending';
    };

    const headers = [
      'STT',
      'Mã GV',
      'Loại đăng ký',
      'Khối',
      'Mã môn',
      'Môn',
      'Lịch thi',
      'Điểm',
      'Xử lý điểm',
      'Ngày đăng ký',
      'Trạng thái HO',
    ];
    let exportRows = rows;
    try {
      const params = new URLSearchParams();
      appendListFilters(params, {
        teacher: teacherDebounced,
        subjectCodes: filterSubjectCodes,
        blockCodes: filterBlockCodes,
      });
      const response = await fetch(`/api/exam-registrations?${params.toString()}`);
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        exportRows = data.data;
      } else {
        toast.error(data.error || "Không tải được dữ liệu để xuất");
        return;
      }
    } catch {
      toast.error("Không tải được dữ liệu để xuất");
      return;
    }

    const csvRows = exportRows.map((row, i) => {
      const start = row.open_at ? new Date(row.open_at) : (row.scheduled_at ? new Date(row.scheduled_at) : null);
      const lichThi = start ? format(start, 'HH:mm dd/MM/yyyy') : 'N/A';
      const ngayDk = new Date(row.dang_ky_luc || row.created_at).toLocaleDateString('vi-VN');
      return [
        i + 1,
        row.teacher_code,
        row.registration_type === 'official' ? 'Chính thức' : 'Bổ sung',
        row.block_code,
        row.subject_code,
        row.subject_name || row.subject_code,
        lichThi,
        row.score ?? '',
        row.xu_ly_diem || '',
        ngayDk,
        getHoStatus(row),
      ];
    });

    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const content = [headers, ...csvRows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `danh-sach-dang-ky-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const a = document.createElement("a");
    a.href = "/templates/mau-import-dang-ky-ky-thi.xlsx";
    a.download = "mau-import-dang-ky-ky-thi.xlsx";
    a.rel = "noopener";
    a.click();
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      toast.error("Chưa chọn file.");
      return;
    }
    if (file.size === 0) {
      toast.error("File rỗng — không có dữ liệu để import.");
      return;
    }

    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith(".xlsx");
    if (!name.endsWith(".csv") && !isXlsx) {
      toast.error(
        "Hệ thống không nhận định dạng này. Chỉ dùng file .csv hoặc .xlsx (nên tải file mẫu Excel, sheet «Đăng ký»)."
      );
      return;
    }

    clearImportRecoveryStorage();
    notifyImportRecoveryChanged();
    setImporting(true);
    setImportProgress(0);
    setImportActivityLog([]);
    const pushActivityLog = (msg: string) => {
      const t = new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setImportActivityLog((prev) => [...prev, `${t} · ${msg}`]);
    };

    try {
      pushActivityLog("Bắt đầu đọc và phân tích file…");
      let parsedRows: Record<string, string>[];
      try {
        if (isXlsx) {
          const ab = await file.arrayBuffer();
          if (ab.byteLength === 0) {
            toast.error("Không đọc được nội dung file Excel (file rỗng).");
            return;
          }
          ({ rows: parsedRows } = parseXlsxRegistrationSheet(ab));
        } else {
          const text = await file.text();
          if (!text.trim()) {
            toast.error("File CSV không có nội dung hoặc encoding không đọc được.");
            return;
          }
          ({ rows: parsedRows } = parseCsvToRows(text));
        }
      } catch (parseErr) {
        const detail = parseErr instanceof Error ? parseErr.message : String(parseErr);
        const hint =
          isXlsx
            ? " Kiểm tra file .xlsx không bị hỏng và có sheet «Đăng ký» với dòng tiêu đề + ít nhất một dòng dữ liệu."
            : " Kiểm tra file .csv có dòng tiêu đề và dòng dữ liệu, encoding UTF-8.";
        toast.error(`Không nhận được dữ liệu từ file: ${detail}${hint}`);
        return;
      }

      if (parsedRows.length === 0) {
        pushActivityLog("Không có dòng dữ liệu sau khi lọc.");
        toast.error(
          "Không có dòng dữ liệu để import (đã bỏ dòng # và dòng trống). Với Excel, chỉ sheet «Đăng ký» được đưa vào — không dùng sheet tham chiếu làm dữ liệu."
        );
        return;
      }

      pushActivityLog(`Đã parse: ${parsedRows.length} dòng dữ liệu (dòng 2 → ${parsedRows.length + 1} trên file).`);

      const totalRows = parsedRows.length;
      /** Lô lớn để giảm số vòng HTTP; server xử lý song song vài dòng/lô (IMPORT_ROW_CONCURRENCY). */
      const BATCH_SIZE = 120;
      const batchCount = Math.ceil(totalRows / BATCH_SIZE);
      setImportProgress(8);
      pushActivityLog(`Gửi server theo lô ${BATCH_SIZE} dòng — ${batchCount} lô.`);

      const allResults: ImportLineResult[] = [];
      let totalImported = 0;

      importCancelRef.current = false;
      importAbortRef.current = new AbortController();
      const importSignal = importAbortRef.current.signal;

      for (let start = 0; start < totalRows; start += BATCH_SIZE) {
        if (importCancelRef.current) {
          pushActivityLog("Đã dừng trước khi gửi lô tiếp theo.");
          break;
        }

        const batchIndex = Math.floor(start / BATCH_SIZE) + 1;
        const slice = parsedRows.slice(start, start + BATCH_SIZE);
        const lineStart = 2 + start;
        const lineEnd = lineStart + slice.length - 1;
        pushActivityLog(`Lô ${batchIndex}/${batchCount}: dòng file ${lineStart}–${lineEnd} → đang POST /api/import…`);

        let response: Response;
        try {
          response = await fetch("/api/exam-registrations/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: slice, lineStart }),
            signal: importSignal,
          });
        } catch (fetchErr) {
          const isAbort =
            (fetchErr instanceof DOMException && fetchErr.name === "AbortError") ||
            (fetchErr instanceof Error && fetchErr.name === "AbortError");
          if (isAbort) {
            pushActivityLog("Request bị hủy (dừng import).");
            break;
          }
          throw fetchErr;
        }

        let data: {
          success?: boolean;
          error?: string;
          imported?: number;
          total?: number;
          failedCount?: number;
          results?: ImportLineResult[];
        };
        try {
          data = await response.json();
        } catch {
          toast.error("Máy chủ trả về phản hồi không hợp lệ — thử lại hoặc kiểm tra kết nối.");
          return;
        }

        if (!response.ok || !data?.success) {
          pushActivityLog(`Lô ${batchIndex}: lỗi HTTP ${response.status} — ${data?.error ?? ""}`);
          throw new Error(data?.error || `Import thất bại (${response.status})`);
        }

        const batchResults = data.results ?? [];
        const batchFail = batchResults.filter((r) => !r.ok).length;
        allResults.push(...batchResults);
        totalImported += data.imported ?? 0;
        const errSummary = summarizeBatchErrors(batchResults);
        pushActivityLog(
          `Lô ${batchIndex}/${batchCount}: xong — ${data.imported ?? 0}/${slice.length} dòng ghi DB${batchFail ? `, ${batchFail} lỗi` : ""}.`
        );
        if (batchFail > 0 && errSummary) {
          pushActivityLog(`  → Lỗi từ server: ${errSummary}`);
        }
        if (batchFail > 0 && batchResults.length > 0) {
          const sample = batchResults
            .filter((r) => !r.ok)
            .slice(0, 5)
            .map((r) => formatImportFailDetail(r, lineStart, slice));
          if (sample.length) {
            pushActivityLog(`  → Chi tiết (tối đa 5 dòng): ${sample.join(" | ")}`);
          }
        }

        const done = Math.min(start + slice.length, totalRows);
        setImportProgress(8 + Math.round((92 * done) / totalRows));

        /** Cả lô đầu không ghi được dòng nào — thường là sai cột/định dạng chung; tránh chờ hàng nghìn lô tương tự. */
        if (
          batchIndex === 1 &&
          (data.imported ?? 0) === 0 &&
          batchFail === slice.length &&
          slice.length > 0
        ) {
          pushActivityLog(
            "Dừng import tại đây — cả lô đầu đều lỗi (cùng kiểu lỗi sẽ lặp cho cả file). Sửa file hoặc đối chiếu cột với «Xuất dữ liệu», rồi import lại."
          );
          setImportProgress(100);
          setImportLog({
            fileName: file.name,
            imported: totalImported,
            total: slice.length,
            failedCount: batchFail,
            results: allResults,
            sourceRows: slice,
          });
          setImportLogOpen(true);
          toast.error(
            `Lô đầu (${slice.length} dòng / file ${totalRows} dòng): không ghi DB. ${errSummary ? `Lỗi: ${errSummary}` : "Xem modal"} — đã dừng, không chạy thêm ${batchCount - 1} lô.`
          );
          await fetchRows(1);
          return;
        }
      }

      const stoppedByUser = importCancelRef.current || importSignal.aborted;

      if (stoppedByUser) {
        setImportProgress(100);
        pushActivityLog("Kết thúc: đã dừng theo yêu cầu — các lô chưa gửi được bỏ qua.");
        if (allResults.length > 0) {
          const failedPartial = allResults.filter((r) => !r.ok);
          setImportLog({
            fileName: file.name,
            imported: totalImported,
            total: totalRows,
            failedCount: failedPartial.length,
            results: allResults,
            sourceRows: parsedRows.slice(0, allResults.length),
          });
          setImportLogOpen(true);
        }
        toast.success("Đã dừng import. Dữ liệu đã gửi trước đó vẫn được lưu.");
        await fetchRows(1);
        return;
      }

      setImportProgress(100);
      pushActivityLog("Đã xử lý hết các lô. Chuẩn bị bảng kết quả và tải lại danh sách…");

      const failed = allResults.filter((r) => !r.ok);
      setImportLog({
        fileName: file.name,
        imported: totalImported,
        total: totalRows,
        failedCount: failed.length,
        results: allResults,
        sourceRows: parsedRows,
      });
      setImportLogOpen(true);

      if (failed.length > 0) {
        console.warn("Import — các dòng lỗi:", failed);
        toast.error(
          `Import xong: ${totalImported}/${totalRows} dòng thành công. ${failed.length} dòng lỗi — xem chi tiết trong bảng kết quả.`
        );
      } else {
        toast.success(`Đã import thành công ${totalImported} dòng. Xem chi tiết trong bảng kết quả.`);
      }
      await fetchRows(1);
    } catch (err: unknown) {
      const isAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      if (isAbort) {
        pushActivityLog("Import bị hủy.");
        toast.success("Đã dừng import.");
        await fetchRows(1);
        return;
      }
      const msg = err instanceof Error ? err.message : "Không thể import file";
      setImportActivityLog((prev) => [
        ...prev,
        `${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · Dừng: ${msg}`,
      ]);
      toast.error(msg);
    } finally {
      setImporting(false);
      setImportProgress(0);
      importAbortRef.current = null;
      importCancelRef.current = false;
    }
  };

  const confirmStopImport = () => {
    importCancelRef.current = true;
    importAbortRef.current?.abort();
    setConfirmStopImportOpen(false);
  };

  const registrationMonthDate = useMemo(() => {
    if (filterYear === "all" || filterMonth === "all") return undefined;
    const y = parseInt(filterYear, 10);
    const m = parseInt(filterMonth, 10) - 1;
    if (!Number.isFinite(y) || m < 0 || m > 11) return undefined;
    return new Date(y, m, 1);
  }, [filterYear, filterMonth]);

  const registrationPeriodBounds = useMemo(() => {
    const y = new Date().getFullYear();
    return { minDate: new Date(y - 3, 0, 1), maxDate: new Date(y + 2, 11, 31) };
  }, []);

  useEffect(() => {
    if (periodFieldFocusedRef.current) return;
    const s =
      filterYear === "all" || filterMonth === "all"
        ? ""
        : `${String(filterMonth).padStart(2, "0")}/${filterYear}`;
    setPeriodInput(s);
  }, [filterYear, filterMonth]);

  const commitPeriodInput = useCallback(() => {
    const parsed = parseMonthYearText(periodInput);
    if (parsed === "empty") {
      setFilterYear("all");
      setFilterMonth("all");
      return;
    }
    if (parsed === null) {
      toast.error("Dùng dạng tháng/năm: 4/2026, 04/2026 hoặc 2026-04");
      const s =
        filterYear === "all" || filterMonth === "all"
          ? ""
          : `${String(filterMonth).padStart(2, "0")}/${filterYear}`;
      setPeriodInput(s);
      return;
    }
    const y = parseInt(parsed.year, 10);
    const m = parseInt(parsed.month, 10);
    if (
      !ymWithinBounds(y, m, registrationPeriodBounds.minDate, registrationPeriodBounds.maxDate)
    ) {
      toast.error(
        `Chọn tháng trong ${format(registrationPeriodBounds.minDate, "MM/yyyy", { locale: vi })} – ${format(registrationPeriodBounds.maxDate, "MM/yyyy", { locale: vi })}`,
      );
      const s =
        filterYear === "all" || filterMonth === "all"
          ? ""
          : `${String(filterMonth).padStart(2, "0")}/${filterYear}`;
      setPeriodInput(s);
      return;
    }
    setFilterYear(parsed.year);
    setFilterMonth(parsed.month);
    setPeriodInput(`${parsed.month}/${parsed.year}`);
  }, [periodInput, filterYear, filterMonth, registrationPeriodBounds]);

  const blockSelectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of QUICK_BLOCKS) set.add(b);
    for (const s of examSubjects) {
      const bc = s.block_code.trim();
      if (bc) set.add(bc);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [examSubjects]);

  const subjectSelectOptions = useMemo(() => {
    return [...examSubjects]
      .sort((a, b) =>
        (a.subject_name || a.subject_code).localeCompare(b.subject_name || b.subject_code, "vi"),
      )
      .map((s) => {
        const code = s.subject_code.trim();
        const name = (s.subject_name || "").trim();
        let label: string;
        if (!name) label = code;
        else if (name === code || normalizeVn(name) === normalizeVn(code)) label = name;
        else label = `${code} · ${name}`;
        return {
          key: `${s.id}-${s.subject_code}`,
          code,
          label,
        };
      });
  }, [examSubjects]);

  const filteredBlockOptions = useMemo(() => {
    const q = normalizeVn(blockListQuery);
    if (!q) return blockSelectOptions;
    return blockSelectOptions.filter((b) => normalizeVn(b).includes(q));
  }, [blockSelectOptions, blockListQuery]);

  const filteredSubjectOptions = useMemo(() => {
    const q = normalizeVn(subjectListQuery);
    if (!q) return subjectSelectOptions;
    return subjectSelectOptions.filter((s) =>
      normalizeVn(`${s.code} ${s.label}`).includes(q),
    );
  }, [subjectSelectOptions, subjectListQuery]);

  const activeAdvancedFilterCount = useMemo(() => {
    let n = 0;
    if (searchTeacherCode.trim()) n++;
    if (filterYear !== "all" || filterMonth !== "all") n++;
    if (filterSubjectCodes.length > 0) n++;
    if (filterBlockCodes.length > 0) n++;
    if (filterRegType !== "all") n++;
    if (filterXuLy !== "all") n++;
    if (filterHasScore !== "all") n++;
    return n;
  }, [
    searchTeacherCode,
    filterYear,
    filterMonth,
    filterSubjectCodes,
    filterBlockCodes,
    filterRegType,
    filterXuLy,
    filterHasScore,
  ]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const clearAdvancedFilters = () => {
    setFilterYear("all");
    setFilterMonth("all");
    setFilterSubjectCodes([]);
    setFilterBlockCodes([]);
    setBlockListQuery("");
    setSubjectListQuery("");
    setFilterRegType("all");
    setFilterXuLy("all");
    setFilterHasScore("all");
  };

  const clearAllFilters = () => {
    setSearchTeacherCode("");
    clearAdvancedFilters();
  };

  const getAssignmentBadge = (row: RegistrationRow) => {
    const gtPending = row.xu_ly_diem === 'chờ giải trình';
    const gtApproved = row.xu_ly_diem === 'đã duyệt';
    const gtRejected = row.xu_ly_diem === 'từ chối';
    const hasGiaiTrinh = row.da_giai_thich || gtPending || gtApproved || gtRejected;
    /** Đã chấm bài / có điểm thi (khác với bước giải trình điểm sau chấm) */
    const examGraded =
      row.assignment_status === 'graded' ||
      (row.score !== null && Number(row.score) > 0);

    if (hasGiaiTrinh) {
      return (
        <div className="w-[300px] mx-auto">
          <Stepper
            compact
            steps={[
              {
                id: 1,
                label: 'Đăng ký',
                description: 'Đã đăng ký',
                status: 'completed'
              },
              {
                id: 2,
                label: 'Giải trình',
                description: gtPending ? 'Chờ duyệt' : 'Đã gửi',
                status: gtPending ? 'current' : 'completed'
              },
              {
                id: 3,
                label: 'Kết quả',
                description: gtApproved
                  ? 'Giải trình\n(Đã duyệt)'
                  : gtRejected
                    ? 'Giải trình\n(Từ chối)'
                    : examGraded
                      ? 'Đã chấm điểm\n(Chờ giải trình)'
                      : 'Chờ',
                status: gtApproved ? 'success' : gtRejected ? 'error' : examGraded ? 'success' : 'upcoming'
              }
            ]}
          />
        </div>
      );
    }

    const assigned = !!row.assignment_id;
    const graded = row.assignment_status === 'graded';
    const expired = row.assignment_status === 'expired';

    return (
      <div className="w-[300px] mx-auto">
        <Stepper
          compact
          steps={[
            {
              id: 1,
              label: 'Giao đề',
              description: assigned ? 'Đã giao' : 'Chưa giao',
              status: assigned ? 'completed' : 'upcoming'
            },
            {
              id: 2,
              label: 'Nộp bài',
              description: expired ? 'Quá hạn' : graded ? 'Đã nộp' : assigned ? 'Đang làm' : 'Chưa',
              status: expired ? 'error' : graded ? 'completed' : assigned ? 'current' : 'upcoming'
            },
            {
              id: 3,
              label: 'Chấm điểm',
              description: graded ? 'Hoàn thành' : 'Chưa',
              status: graded ? 'success' : 'upcoming'
            }
          ]}
        />
      </div>
    );
  };

  return (
    <>
      {importing ? (
        <div
          className="group fixed bottom-4 right-4 z-[9980] w-[min(calc(100vw-1rem),14rem)]"
          role="progressbar"
          aria-valuenow={importProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tiến độ import — di chuột vào để xem nhật ký chi tiết"
        >
          <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="min-w-0 text-xs font-semibold text-gray-800">Đang gửi dữ liệu</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums font-bold text-[#a1001f]">{importProgress}%</span>
                <button
                  type="button"
                  onClick={() => setConfirmStopImportOpen(true)}
                  className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 hover:border-[#a1001f] hover:bg-red-50 hover:text-[#a1001f]"
                >
                  Dừng
                </button>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#a1001f] transition-[width] duration-300 ease-out"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-tight text-gray-500">Di chuột vào đây để xem log từng bước</p>
          </div>
          <div
            role="log"
            aria-live="polite"
            className="pointer-events-none invisible absolute bottom-full right-0 z-[9981] mb-1 max-h-52 w-[min(calc(100vw-1rem),22rem)] overflow-hidden rounded-lg border border-gray-200 bg-white p-2 opacity-0 shadow-xl transition-opacity duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100"
          >
            <p className="mb-1 border-b border-gray-100 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Nhật ký import
            </p>
            <div
              ref={importActivityLogRef}
              className="max-h-44 overflow-y-auto font-mono text-[10px] leading-snug text-gray-800"
            >
              {importActivityLog.length === 0 ? (
                <span className="text-gray-400">Đang khởi tạo…</span>
              ) : (
                importActivityLog.map((line, i) => (
                  <div key={i} className="border-b border-gray-50 py-0.5 last:border-0">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      <PageContainer
        title="Danh sách đăng ký đánh giá chuyên môn"
        description="Tổng hợp toàn bộ thông tin đăng ký kiểm tra chuyên môn của giáo viên"
      >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <ClipboardList className="h-5 w-5 shrink-0 text-[#a1001f]" />
            <h2 className="text-base font-bold text-gray-900">Danh sách đăng ký</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
              {total > 0 ? total : rows.length} bản ghi
            </span>
            {activeAdvancedFilterCount > 0 ? (
              <span className="rounded-full border border-[#a1001f]/30 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-[#a1001f]">
                {activeAdvancedFilterCount} bộ lọc đang bật
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => void fetchRows(1)}
              disabled={listFetchBusy}
              aria-busy={listFetchBusy}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#a1001f] px-3 py-2 text-sm font-medium text-white hover:bg-[#8a0019] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${listFetchBusy ? "animate-spin" : ""}`} aria-hidden />
              {silentListLoading && !loading ? "Đang cập nhật…" : "Làm mới"}
            </button>
            <button
              type="button"
              onClick={() => void exportCsv()}
              disabled={rows.length === 0 && total === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Xuất dữ liệu
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown className="h-4 w-4" />
              File mẫu
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#a1001f] bg-red-50/50 px-3 py-2 text-sm font-medium text-[#a1001f] hover:bg-red-50 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {importing ? "Đang import…" : "Import CSV / Excel"}
            </button>
            <div className="group relative shrink-0 self-end sm:self-center">
              <button
                type="button"
                className="inline-flex cursor-help items-center justify-center rounded-md border border-gray-200 bg-gray-50/80 p-1.5 text-gray-600 hover:border-[#a1001f]/30 hover:bg-red-50/60"
                aria-label="Hướng dẫn import"
                title="Di chuột để xem hướng dẫn import"
              >
                <Info className="h-3.5 w-3.5 shrink-0 text-[#a1001f]" aria-hidden />
              </button>
              <div
                role="tooltip"
                className="pointer-events-none invisible absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,28rem)] rounded-lg border border-gray-200 bg-white p-3 text-left text-xs leading-relaxed text-gray-700 shadow-lg opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100"
              >
                <p className="m-0">
                  <strong>Import CSV hoặc Excel (.xlsx):</strong> cột giống <strong>Xuất dữ liệu</strong> (Mã GV, Loại đăng ký, Khối, Mã môn, Môn, <strong>Lịch thi</strong>:{" "}
                  <code className="bg-gray-100 px-1 rounded">HH:mm dd/MM/yyyy</code> hoặc chỉ ngày{" "}
                  <code className="bg-gray-100 px-1 rounded">d/M/yyyy</code> — nếu không có giờ thì hệ thống dùng mặc định 19:00 theo ngày trong ô). Tải{" "}
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="text-[#a1001f] font-semibold underline underline-offset-2"
                  >
                    file mẫu Excel
                  </button>{" "}
                  (3 sheet: <strong>Đăng ký</strong> — dữ liệu import; <strong>Tham chiếu môn</strong>; <strong>Khối &amp; môn</strong> — Khối / Mã môn / Môn để đối chiếu; chỉ sheet Đăng ký được đưa vào hệ thống) hoặc xuất danh sách rồi sửa. Với CSV, dòng bắt đầu bằng{" "}
                  <code className="bg-gray-100 px-1">#</code> bị bỏ qua.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-3 p-0">
          <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-gray-900">Bộ lọc danh sách</h3>
              {filtersOpen ? (
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
                  Khối và môn: gõ ô tìm để thu hẹp danh sách, tick để chọn nhiều. Tháng/năm: chọn một ngày trong tháng cần lọc.
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
                  Đang ẩn — nhấn &quot;Hiện bộ lọc&quot; để lọc theo GV, tháng/năm, khối, môn…
                  {activeAdvancedFilterCount > 0 ? (
                    <span className="font-medium text-[#a1001f]">
                      {" "}
                      ({activeAdvancedFilterCount} điều kiện vẫn đang áp dụng)
                    </span>
                  ) : null}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className="inline-flex shrink-0 items-center justify-center gap-1 self-start rounded-md border border-gray-100 bg-gray-50/60 px-2 py-1 text-xs font-semibold text-gray-800 hover:border-[#a1001f]/25 hover:bg-red-50/50 hover:text-[#a1001f]"
            >
              {filtersOpen ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          </div>

          {filtersOpen ? (
          <>
          <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-700 lg:col-span-4">
              Mã GV (tìm gần đúng)
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchTeacherCode}
                  onChange={(e) => setSearchTeacherCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void fetchRows(1);
                  }}
                  placeholder="Một phần mã GV…"
                  className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-2 text-sm font-normal text-gray-900 shadow-sm focus:border-[#a1001f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                />
              </div>
            </label>
            <div className="flex flex-col gap-1.5 lg:col-span-8">
              <span className="text-xs font-medium text-gray-700">Tháng / năm đăng ký</span>
              <div className="flex max-w-md flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="VD 04/2026 — để trống = tất cả"
                  value={periodInput}
                  onChange={(e) => setPeriodInput(e.target.value)}
                  onFocus={() => {
                    periodFieldFocusedRef.current = true;
                  }}
                  onBlur={() => {
                    periodFieldFocusedRef.current = false;
                    commitPeriodInput();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#a1001f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                  aria-label="Tháng và năm đăng ký (gõ hoặc chọn lịch)"
                />
                <AnimatedCalendar
                  mode="single"
                  monthYearOnly
                  calendarTriggerVariant="iconOnly"
                  value={registrationMonthDate}
                  onChange={(d) => {
                    if (!d) {
                      setFilterYear("all");
                      setFilterMonth("all");
                      return;
                    }
                    setFilterYear(String(getYear(d)));
                    setFilterMonth(String(getMonth(d) + 1).padStart(2, "0"));
                  }}
                  placeholder="Chọn tháng/năm"
                  aria-label="Mở lịch chọn tháng và năm"
                  locale={vi}
                  localeStrings={REG_FILTER_CALENDAR_VI}
                  formatStr="LLLL yyyy"
                  size="sm"
                  weekStartsOn={1}
                  minDate={registrationPeriodBounds.minDate}
                  maxDate={registrationPeriodBounds.maxDate}
                  showTodayButton
                  showClearButton
                  className="h-9 shrink-0 rounded-lg border border-gray-200 bg-white font-normal text-gray-900 shadow-sm hover:bg-gray-50/80"
                />
              </div>
              <p className="text-[11px] leading-snug text-gray-500">
                Gõ <span className="font-mono">tháng/năm</span> (4/2026, 2026-04) hoặc nút lịch để chọn.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-gray-50/50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-800">Khối</span>
                <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-gray-600 ring-1 ring-gray-200/80">
                  {filterBlockCodes.length} đã chọn
                </span>
              </div>
              <p className="mb-2 text-[11px] text-gray-500">Gõ để lọc danh sách, tick để chọn.</p>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Nhanh</span>
                {QUICK_BLOCKS.map((b) => {
                  const on = filterBlockCodes.some((c) => c.toUpperCase() === b);
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBlockCode(b)}
                      className={
                        on
                          ? "rounded-full border border-[#a1001f] bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-[#a1001f]"
                          : "rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:border-[#a1001f]/30"
                      }
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  value={blockListQuery}
                  onChange={(e) => setBlockListQuery(e.target.value)}
                  placeholder="Tìm khối…"
                  className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#a1001f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                  aria-label="Tìm trong danh sách khối"
                />
              </div>
              <div className="max-h-44 min-h-[7rem] overflow-y-auto rounded-md border border-gray-200/80 bg-white p-1.5 custom-scrollbar">
                {filteredBlockOptions.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-gray-400">Không có khối khớp.</p>
                ) : (
                  filteredBlockOptions.map((b) => (
                    <label
                      key={b}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-900 hover:bg-[#a1001f]/8"
                    >
                      <input
                        type="checkbox"
                        checked={filterBlockCodes.some((c) => c.toUpperCase() === b.toUpperCase())}
                        onChange={() => toggleBlockCode(b)}
                        className="size-4 shrink-0 rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]"
                      />
                      <span className="min-w-0 font-medium">{b}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="mt-1.5 text-[10px] text-gray-400">
                Hiển thị {filteredBlockOptions.length}/{blockSelectOptions.length} khối
              </p>
            </div>

            <div className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-gray-50/50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-800">Mã môn / tên môn</span>
                <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-gray-600 ring-1 ring-gray-200/80">
                  {filterSubjectCodes.length} đã chọn
                </span>
              </div>
              <p className="mb-2 text-[11px] text-gray-500">Gõ để lọc theo mã hoặc tên, tick để chọn.</p>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  value={subjectListQuery}
                  onChange={(e) => setSubjectListQuery(e.target.value)}
                  placeholder="Tìm môn (mã hoặc tên)…"
                  className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#a1001f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                  aria-label="Tìm trong danh sách môn"
                />
              </div>
              <div className="max-h-44 min-h-[7rem] overflow-y-auto rounded-md border border-gray-200/80 bg-white p-1.5 custom-scrollbar">
                {filteredSubjectOptions.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-gray-400">Không có môn khớp.</p>
                ) : (
                  filteredSubjectOptions.map((s) => (
                    <label
                      key={s.key}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm text-gray-900 hover:bg-[#a1001f]/8"
                    >
                      <input
                        type="checkbox"
                        checked={filterSubjectCodes.some((c) => c.toUpperCase() === s.code.toUpperCase())}
                        onChange={() => toggleSubjectCode(s.code)}
                        className="mt-0.5 size-4 shrink-0 rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]"
                      />
                      <span className="min-w-0 flex-1 break-words leading-snug">{s.label}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="mt-1.5 text-[10px] text-gray-400">
                Hiển thị {filteredSubjectOptions.length}/{subjectSelectOptions.length} môn
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-700">
              Loại đăng ký
              <select
                value={filterRegType}
                onChange={(e) => setFilterRegType(e.target.value as "all" | "official" | "additional")}
                className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm font-normal text-gray-900 shadow-sm focus:border-[#a1001f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
              >
                <option value="all">Tất cả</option>
                <option value="official">Chính thức</option>
                <option value="additional">Bổ sung</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-700">
              Xử lý điểm
              <select
                value={filterXuLy}
                onChange={(e) =>
                  setFilterXuLy(
                    e.target.value as "all" | "chờ giải trình" | "đã duyệt" | "từ chối" | "đã hoàn thành",
                  )
                }
                className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm font-normal text-gray-900 shadow-sm focus:border-[#a1001f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
              >
                <option value="all">Tất cả</option>
                <option value="chờ giải trình">chờ giải trình</option>
                <option value="đã duyệt">đã duyệt</option>
                <option value="từ chối">từ chối</option>
                <option value="đã hoàn thành">đã hoàn thành</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-700 sm:col-span-2 xl:col-span-1">
              Cột điểm trong DB
              <select
                value={filterHasScore}
                onChange={(e) => setFilterHasScore(e.target.value as "all" | "has" | "none")}
                className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm font-normal text-gray-900 shadow-sm focus:border-[#a1001f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
              >
                <option value="all">Không lọc</option>
                <option value="has">Đã có điểm (NOT NULL)</option>
                <option value="none">Chưa có điểm (NULL)</option>
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => void fetchRows(1)}
              className="rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#8a0019]"
            >
              Áp dụng ngay
            </button>
            <button
              type="button"
              onClick={() => {
                clearAllFilters();
                void fetchRows(1);
              }}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Xóa lọc &amp; tải lại
            </button>
          </div>
          </>
          ) : null}
        </div>

        <>
          <div
            className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${listFetchBusy && rows.length > 0 ? "opacity-80" : ""}`}
          >
            <div className="max-h-[min(70vh,calc(100vh-14rem))] overflow-auto overscroll-y-contain">
            <Table className="min-w-[1100px]">
              <TableHeader className="sticky top-0 z-20 bg-gray-50 shadow-[0_1px_0_0_rgb(229_231_235)] [&_tr]:border-b-0">
                <TableRow>
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead className="text-center">Mã GV</TableHead>
                  <TableHead className="text-center">Loại đăng ký</TableHead>
                  <TableHead className="text-center">Khối / Môn</TableHead>
                  <TableHead className="text-center">Lịch thi</TableHead>
                  <TableHead className="text-center">Assignment</TableHead>
                  <TableHead className="text-center">Điểm</TableHead>
                  <TableHead className="text-center">Xử lý điểm</TableHead>
                  <TableHead className="text-center">Ngày đăng ký</TableHead>
                  <TableHead className="text-center">Thao tác HO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm text-gray-500">
                      Đang tải dữ liệu đăng ký...
                    </TableCell>
                  </TableRow>
                ) : !loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm text-gray-500">
                      {activeAdvancedFilterCount > 0
                        ? "Không có bản ghi khớp bộ lọc."
                        : "Chưa có dữ liệu đăng ký."}
                    </TableCell>
                  </TableRow>
                ) : (
                rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-center text-gray-600">
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-gray-900">{row.teacher_code}</TableCell>
                    <TableCell className="text-center">
                      <div className="text-gray-900 font-medium">{row.registration_type === "official" ? "Chính thức" : "Bổ sung"}</div>
                      <div className="text-xs text-gray-500">{row.exam_type}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-medium text-gray-900">{row.block_code}</div>
                      <div className="text-xs text-gray-600">{row.subject_name || row.subject_code}</div>
                    </TableCell>
                    <TableCell className="text-center text-xs text-gray-700">
                      {(() => {
                        const start = row.open_at ? new Date(row.open_at) : (row.scheduled_at ? new Date(row.scheduled_at) : null);
                        const end = row.close_at ? new Date(row.close_at) : null;
                        
                        if (!start) return <span className="text-gray-400">N/A</span>;
                        
                        const startTime = format(start, "HH:mm");
                        const endTime = end ? format(end, "HH:mm") : null;
                        const dateStr = format(start, "dd/MM/yyyy");
                        
                        return (
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-gray-900">
                              {startTime}{endTime ? ` - ${endTime}` : ""}
                            </span>
                            <span className="text-gray-500">{dateStr}</span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-center">{getAssignmentBadge(row)}</TableCell>
                    <TableCell className="text-center text-xs text-gray-700">
                      {row.xu_ly_diem === 'đã duyệt' ? (
                        <div className="font-semibold text-purple-700">Miễn (giải trình)</div>
                      ) : row.xu_ly_diem === 'từ chối' ? (
                        <>
                          <div className="font-semibold text-red-700">Từ chối GT</div>
                          {row.tong_diem_bi_tru != null && (
                            <div className="text-gray-500">Trừ: {row.tong_diem_bi_tru}</div>
                          )}
                        </>
                      ) : row.score === null ? (
                        <div className="text-gray-400">Chưa có</div>
                      ) : (
                        <div className="font-semibold text-gray-900">{row.score}</div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[10rem] whitespace-normal text-center text-xs text-gray-700">
                      <span className="line-clamp-2 break-words">{row.xu_ly_diem || "—"}</span>
                    </TableCell>
                    <TableCell className="text-center text-xs text-gray-600">
                      {new Date(row.dang_ky_luc || row.created_at).toLocaleDateString("vi-VN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const xu = row.xu_ly_diem || '';
                        const examGraded =
                          row.assignment_status === 'graded' ||
                          (row.score !== null && Number(row.score) > 0);
                        if (xu === 'đã duyệt') {
                          return <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">Accepted</span>;
                        }
                        if (xu === 'từ chối') {
                          return <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">Rejected</span>;
                        }
                        /* Đã chấm điểm / xong bài — hiển thị Done trước, không bị «chờ giải trình» che (GT là bước sau khi đã có điểm) */
                        if (examGraded || xu === 'đã hoàn thành') {
                          return <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700">Done</span>;
                        }
                        if (xu === 'chờ giải trình') {
                          return <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">Waiting</span>;
                        }
                        if (row.score !== null) {
                          return <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700">Done</span>;
                        }
                        return <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">Pending</span>;
                      })()}
                    </TableCell>
                  </TableRow>
                ))
                )}
              </TableBody>
            </Table>
            </div>
          </div>
          {total > 0 ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-xs text-gray-600 sm:text-left">
                Hiển thị{" "}
                <span className="font-semibold text-gray-800">
                  {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + rows.length}
                </span>{" "}
                trong{" "}
                <span className="font-semibold text-gray-800">{total}</span> bản ghi
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void fetchRows(1)}
                  disabled={page <= 1 || listFetchBusy}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Đầu
                </button>
                <button
                  type="button"
                  onClick={() => void fetchRows(page - 1)}
                  disabled={page <= 1 || listFetchBusy}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Trước
                </button>
                <span className="min-w-[8rem] text-center text-xs font-medium text-gray-700 tabular-nums">
                  Trang {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => void fetchRows(page + 1)}
                  disabled={page >= totalPages || listFetchBusy}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void fetchRows(totalPages)}
                  disabled={page >= totalPages || listFetchBusy}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Cuối
                </button>
              </div>
            </div>
          ) : null}
        </>
      </div>

      <Dialog open={importLogOpen} onOpenChange={setImportLogOpen}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Kết quả import từng dòng</DialogTitle>
            <p className="text-left text-sm text-gray-600">
              {importLog ? (
                <>
                  File: <span className="font-medium text-gray-900">{importLog.fileName}</span> — Thành công{" "}
                  <span className="font-semibold text-green-700">{importLog.imported}</span> / {importLog.total} dòng
                  {importLog.failedCount > 0 ? (
                    <>
                      , <span className="font-semibold text-red-700">{importLog.failedCount}</span> dòng không ghi được DB
                    </>
                  ) : null}
                  . Số dòng file = dòng tiêu đề (1) + dữ liệu; cột «Dòng» là số dòng trên file Excel/CSV.
                </>
              ) : null}
            </p>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-14 text-center">Dòng</TableHead>
                  <TableHead className="min-w-[180px]">Dữ liệu (tóm tắt)</TableHead>
                  <TableHead className="w-28 text-center">Trạng thái</TableHead>
                  <TableHead className="min-w-[220px]">Ghi chú / Lỗi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importLog?.results.map((res, idx) => {
                  const src = importLog.sourceRows[idx] ?? {};
                  const detailOk =
                    res.ok && res.id != null ? `Đã ghi DB — id đăng ký: ${String(res.id)}` : res.ok ? "Đã ghi DB" : "";
                  const detailErr = !res.ok
                    ? [
                        res.error ?? "Lỗi không xác định",
                        res.result_id != null ? `(id bản ghi liên quan: ${res.result_id})` : "",
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : "";
                  return (
                    <TableRow key={`${res.line}-${idx}`}>
                      <TableCell className="text-center font-mono text-sm text-gray-700">{res.line}</TableCell>
                      <TableCell className="max-w-[280px] text-xs text-gray-800 sm:max-w-md">
                        <span className="line-clamp-3 break-words" title={previewImportRow(src)}>
                          {previewImportRow(src)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {res.ok ? (
                          <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-green-700">
                            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-red-700">
                            <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                            Lỗi
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-800">
                        {res.ok ? (
                          <span className="text-green-800">{detailOk}</span>
                        ) : (
                          <span className="text-red-800">{detailErr}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <p className="mr-auto text-left text-xs text-gray-500">
              Nếu lỗi «Không tìm thấy môn học» hoặc «Thiếu Mã GV», kiểm tra đúng mã trong hệ thống và file mẫu.
            </p>
            <button
              type="button"
              onClick={() => setImportLogOpen(false)}
              className="rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-medium text-white hover:bg-[#8a0019]"
            >
              Đóng
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmStopImportOpen} onOpenChange={setConfirmStopImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dừng import?</DialogTitle>
            <DialogDescription className="text-left text-sm text-gray-600">
              Bạn có chắc muốn dừng? Các dòng đã gửi và ghi thành công vẫn được lưu. Các lô chưa gửi sẽ không được nhập.
              Request đang chạy (nếu có) sẽ bị hủy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmStopImportOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Tiếp tục import
            </button>
            <button
              type="button"
              onClick={confirmStopImport}
              className="rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-medium text-white hover:bg-[#8a0019]"
            >
              Dừng import
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
    </>
  );
}
