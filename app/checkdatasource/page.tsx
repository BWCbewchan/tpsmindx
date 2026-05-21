"use client";

import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/auth-headers";
import { cn } from "@/lib/utils";
import { MessageSquareWarning, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ClipboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/app-toast";

type OnboardingData = Record<string, string>;
const HIDDEN_ONBOARDING_FIELDS = new Set(["No", "Course line", "Rank", "Teacher point"]);
const REQUIRED_PROFILE_FIELDS = [
  "Code",
  "Full name",
  "Work email",
  "Centers",
  "Khối final",
  "Role",
  "Status check",
  "BU check",
] as const;

function formatPhoneNumber(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "Chưa có";

  let local = digits;
  if (local.startsWith("84")) {
    local = `0${local.slice(2)}`;
  }

  if (local.length === 10) {
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  if (local.length === 11) {
    return `${local.slice(0, 4)} ${local.slice(4, 8)} ${local.slice(8)}`;
  }

  return local;
}

/** Parse money-like strings from sheets (US 120,000.00 or VN 120.000). */
function parseSheetMoneyToNumber(raw: string): number | null {
  const t = raw.replace(/\s/g, "").replace(/\u00A0/g, "");
  if (!t) return null;

  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(t)) {
    const n = Number.parseFloat(t.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    const n = Number.parseFloat(t.replace(/\./g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d{1,3}(\.\d{3})*,\d+$/.test(t)) {
    const n = Number.parseFloat(t.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  const n = Number.parseFloat(t.replace(/,/g, "."));
  return Number.isFinite(n) ? n : null;
}

function formatRateK12CheckVnd(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "Chưa có";

  const n = parseSheetMoneyToNumber(trimmed);
  if (n === null) return trimmed;

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

const DB_TO_DISPLAY_MAP: Record<string, string> = {
  full_name: "Full name",
  code: "Code",
  user_name: "User name",
  work_email: "Work email",
  main_centre: "Main centre",
  course_line: "Course line",
  status: "Status check",
  teacher_code: "Code",
};

function mapTeacherRecordToOnboardingData(record: Record<string, unknown>): OnboardingData {
  const result: OnboardingData = {};

  for (const [key, value] of Object.entries(record)) {
    const text = toText(value);
    if (!text) continue;

    // Skip internal/meta fields
    if (["id", "created_at", "updated_at", "onboarding_snapshot"].includes(key)) continue;

    const displayKey = DB_TO_DISPLAY_MAP[key] || key;
    if (!result[displayKey]) {
      result[displayKey] = text;
    }
  }

  return result;
}

/** Fallback: map legacy Teacher interface → onboardingData display keys (partial fields). */
function mapTeacherToOnboardingData(t: Record<string, unknown>): OnboardingData {
  const s = (k: string) => toText(t[k]);
  const result: OnboardingData = {};
  const mapping: Record<string, string> = {
    code: "Code",
    name: "Full name",
    emailMindx: "Work email",
    emailPersonal: "Personal email",
    status: "Status check",
    branchIn: "Centers",
    programIn: "Khối final",
    branchCurrent: "BU check",
    programCurrent: "Khối check",
    manager: "Leader quản lý",
    responsible: "TE quản lý",
    position: "Role",
    startDate: "Joined date",
    onboardBy: "Data HR (Raw)",
  };
  for (const [tKey, displayKey] of Object.entries(mapping)) {
    const v = s(tKey);
    if (v) result[displayKey] = v;
  }
  return result;
}

const MAX_FEEDBACK_IMAGES = 6;

function FeedbackImageThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
    };
  }, [file]);

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-sm">
      {url ? (

        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full animate-pulse bg-gray-200" aria-hidden />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-gray-900/75 text-white shadow backdrop-blur-sm transition hover:bg-gray-900"
        aria-label="Xóa ảnh"
      >
        <span className="text-lg leading-none">×</span>
      </button>
    </div>
  );
}

function CheckDataSourceContent() {
  const { user, logout, token } = useAuth();
  const router = useRouter();
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [feedbackImages, setFeedbackImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userEmail = useMemo(() => (user?.email || "").trim().toLowerCase(), [user?.email]);
  const profileCompletion = useMemo(() => {
    if (!onboardingData) return { completed: 0, total: REQUIRED_PROFILE_FIELDS.length, percent: 0 };

    const completed = REQUIRED_PROFILE_FIELDS.filter((field) => {
      const value = onboardingData[field];
      return !!String(value || "").trim();
    }).length;
    const total = REQUIRED_PROFILE_FIELDS.length;
    const percent = Math.round((completed / total) * 100);
    return { completed, total, percent };
  }, [onboardingData]);

  /** Đã có bất kỳ thông tin GV trong hệ thống là đủ để vào (không cần đủ 8/8 trường). */
  const hasProfileInfo = useMemo(() => {
    if (!onboardingData) return false;
    return Object.values(onboardingData).some((v) => String(v ?? "").trim().length > 0);
  }, [onboardingData]);

  const canEnterSystem = !loading && hasProfileInfo;

  const appendImageFiles = useCallback((files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      toast.error("Chỉ hỗ trợ file ảnh.");
      return;
    }
    setFeedbackImages((prev) => {
      const room = MAX_FEEDBACK_IMAGES - prev.length;
      if (room <= 0) {
        toast.error(`Tối đa ${MAX_FEEDBACK_IMAGES} ảnh.`);
        return prev;
      }
      const toAdd = images.slice(0, room);
      if (images.length > room) {
        toast(`Đã thêm ${toAdd.length} ảnh (giới hạn ${MAX_FEEDBACK_IMAGES} ảnh).`);
      }
      return [...prev, ...toAdd];
    });
  }, []);

  const handlePasteImages = useCallback(
    (e: ClipboardEvent<HTMLElement>) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        appendImageFiles(files);
        toast.success(`Đã dán ${files.length} ảnh.`, { duration: 2000 });
      }
    },
    [appendImageFiles]
  );

  useEffect(() => {
    if (!user) return;
    if (user.role !== "teacher") {
      router.replace("/user/truyenthong");
      return;
    }

    const fetchTeacherByEmail = async () => {
      setLoading(true);
      try {
        const headers: HeadersInit = {
          ...authHeaders(token),
        };

        // Run both requests in parallel:
        // - DB first for reliability after user has been synced.
        // - Sheets to support onboarding sync source when available.
        const [dbResult, sheetResult] = await Promise.allSettled([
          fetch(`/api/teachers/info?email=${encodeURIComponent(user.email)}`, { headers }),
          fetch(`/api/teachers?email=${encodeURIComponent(user.email)}&basic=true`, { headers }),
        ]);

        let dbData: any = null;
        if (dbResult.status === "fulfilled" && dbResult.value.ok) {
          dbData = await dbResult.value.json().catch(() => null);
          if (dbData?.success && dbData?.teacher) {
            // Đã có hồ sơ trong bảng teachers → không cần xem màn check nữa, vào Truyền thông luôn
            try {
              localStorage.setItem("tps_profile_check_done_email", userEmail);
            } catch {
              /* ignore */
            }
            router.replace("/user/truyenthong");
            return;
          }
        }

        if (sheetResult.status === "fulfilled" && sheetResult.value.ok) {
          const sheetData = await sheetResult.value.json().catch(() => null);
          if (sheetData?.onboardingData && Object.keys(sheetData.onboardingData).length > 0) {
            setOnboardingData(sheetData.onboardingData as OnboardingData);
            return;
          }
          if (sheetData?.teacher) {
            const mapped = mapTeacherToOnboardingData(
              sheetData.teacher as Record<string, unknown>
            );
            if (Object.keys(mapped).length > 0) {
              setOnboardingData(mapped);
              return;
            }
          }
        }

        setOnboardingData(null);
      } catch {
        setOnboardingData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTeacherByEmail();
  }, [user, router, logout, userEmail, token]);

  const continueToApp = async () => {
    if (!user?.email) return;
    const nextPath = "/user/truyenthong";
    try {
      const response = await fetch("/api/checkdatasource/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token),
        },
        body: JSON.stringify({
          userEmail: user.email,
          userName: user.displayName,
          userCode: onboardingData?.["Code"] || user.email.split("@")[0],
          onboardingData: onboardingData || {},
        }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        dbUnavailable?: boolean;
        warning?: string;
      };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Không thể lưu xác nhận");
      }
      if (data.dbUnavailable && data.warning) {
        toast(data.warning, { duration: 5500 });
      }
      // Mark profile as done so AppLayout guard allows /user/* access
      localStorage.setItem("tps_profile_check_done_email", userEmail);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Lưu xác nhận thất bại.";
      toast.error(`Không lưu được xác nhận: ${message}`);
      console.warn("checkdatasource confirm failed:", message);
      // Still set localStorage so user can proceed even if DB had transient issue
      localStorage.setItem("tps_profile_check_done_email", userEmail);
    }

    router.replace(nextPath);
  };

  const backToLogin = useCallback(() => {
    logout();
    router.replace("/login");
  }, [logout, router]);

  const submitFeedback = async () => {
    const text = feedback.trim();
    if (!text && feedbackImages.length === 0) {
      return toast.error("Vui lòng mô tả lỗi hoặc đính kèm ít nhất một ảnh.");
    }
    if (!user?.email) return;

    const contentForApi = text || "Phản ánh kèm ảnh (chưa có mô tả).";

    setSubmitting(true);
    try {
      const uploadedImages = await Promise.all(
        feedbackImages.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          const uploadResponse = await fetch("/api/feedback/upload-image", {
            method: "POST",
            body: formData,
          });
          const uploadData = await uploadResponse.json();
          if (!uploadResponse.ok || !uploadData.success) {
            throw new Error(uploadData.error || "Không thể upload ảnh");
          }
          return uploadData.storagePath || uploadData.url;
        })
      );

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestEmail: user.email,
          userName: user.displayName,
          userCode: onboardingData?.["Code"] || user.email.split("@")[0],
          screenPath: "/checkdatasource",
          content: contentForApi,
          suggestion: "Check datasource before entering sidebar",
          imageUrls: uploadedImages.filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error("submit_failed");

      toast.success("Đã gửi feedback cho admin.");
      setFeedback("");
      setFeedbackImages([]);
    } catch {
      toast.error("Không gửi được feedback. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "box-border w-full overflow-x-hidden",
        "px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]",
        "sm:px-4 sm:py-4",
        "min-h-[100dvh] min-h-[100svh]",
        "lg:flex lg:min-h-0 lg:h-[100dvh] lg:max-h-[100dvh] lg:flex-col lg:overflow-hidden lg:py-3"
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1500px] flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm",
          "sm:gap-4 sm:p-4",
          "lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:p-4"
        )}
      >
        <header className="flex shrink-0 flex-col gap-3 border-b border-gray-200 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pb-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            { }
            <img src="/logo.svg" alt="MindX" className="h-8 w-auto shrink-0 sm:h-9" />
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-bold text-[#a1001f]">TPS</p>
              <p className="truncate text-xs text-gray-600 sm:whitespace-normal">Teaching Portal System</p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={backToLogin}
              className="w-full touch-manipulation rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:w-auto sm:py-2 sm:text-xs"
            >
              Quay về đăng nhập
            </button>
            <button
              type="button"
              onClick={continueToApp}
              disabled={!canEnterSystem}
              className={cn(
                "w-full touch-manipulation rounded-lg px-4 py-2.5 text-sm font-semibold text-white sm:w-auto sm:py-2 sm:text-xs transition-colors",
                canEnterSystem
                  ? "animate-cta-glow bg-[#a1001f] hover:bg-[#870019]"
                  : "bg-gray-300 cursor-not-allowed",
              )}
            >
              Vào hệ thống
            </button>
          </div>
        </header>

        <div
          className={cn(
            "grid min-h-0 flex-1 grid-cols-1 gap-4",
            "max-lg:content-start",
            "lg:min-h-0 lg:grid-cols-[1fr_minmax(260px,38%)] lg:gap-4 lg:overflow-hidden",
            "xl:grid-cols-[1fr_minmax(300px,400px)]"
          )}
        >
          <section
            aria-label="Dữ liệu nguồn"
            className={cn(
              "min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm",
              "sm:p-4",
              "lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain"
            )}
          >
            <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700">Mức độ hoàn thiện hồ sơ</span>
                <span className="font-semibold text-[#a1001f]">
                  {profileCompletion.percent}% ({profileCompletion.completed}/{profileCompletion.total})
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-linear-to-r from-[#a1001f] to-[#d83f63] transition-all duration-500"
                  style={{ width: `${profileCompletion.percent}%` }}
                />
              </div>
              {!loading && hasProfileInfo && profileCompletion.percent < 100 && (
                <p className="mt-2 text-xs text-gray-500">
                  Một số mục gợi ý còn trống — bạn vẫn có thể <strong>Vào hệ thống</strong> và cập nhật sau.
                </p>
              )}
              {!loading && !hasProfileInfo && (
                <p className="mt-2 text-xs text-gray-500">
                  Khi hệ thống đã có ít nhất một thông tin giáo viên, nút <strong>Vào hệ thống</strong> sẽ bật.
                </p>
              )}
            </div>
            {loading ? (
              <div className="grid auto-rows-min grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 20 }).map((_, idx) => (
                  <div key={`skeleton-field-${idx}`} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 animate-pulse">
                    <div className="h-3 w-20 rounded bg-gray-200" />
                    <div className="mt-1 h-4 w-24 rounded bg-gray-300" />
                  </div>
                ))}
              </div>
            ) : onboardingData && Object.keys(onboardingData).length > 0 ? (
              <div className="grid auto-rows-min grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {Object.entries(onboardingData)
                  .filter(([key]) => !HIDDEN_ONBOARDING_FIELDS.has(key))
                  .map(([key, value]) => {
                    const displayValue =
                      key === "Phone number"
                        ? formatPhoneNumber(value || "")
                        : key === "Rate K12 check"
                          ? formatRateK12CheckVnd(value || "")
                          : value || "Chưa có";
                    return <InfoRow key={key} label={key} value={displayValue} />;
                  })}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-gray-700">
                Chưa có dữ liệu giáo viên trong hệ thống. Vui lòng gửi góp ý bên cạnh nếu cần hỗ trợ đồng bộ, hoặc liên hệ quản trị để được thêm hồ sơ.
              </div>
            )}
          </section>

          <section
            aria-label="Góp ý"
            className={cn(
              "flex min-w-0 flex-col gap-3 rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50 to-white p-3 shadow-sm",
              "sm:p-4",
              "lg:min-h-0 lg:max-h-full lg:overflow-y-auto lg:overscroll-contain"
            )}
          >
            {loading ? (
              <div className="flex flex-1 flex-col space-y-3 animate-pulse">
                <div className="h-20 rounded-lg bg-white/80" />
                <div className="min-h-[100px] flex-1 rounded-lg border border-dashed border-amber-200 bg-white/60" />
                <div className="h-10 rounded-lg bg-gray-200" />
              </div>
            ) : (
              <>
                <div className="shrink-0">
                  <div className="flex items-start gap-2">
                    <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Góp ý dữ liệu</h2>
                      <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
                        Mô tả sai lệch hoặc dán ảnh chụp màn hình ngay trong ô bên dưới (
                        <kbd className="rounded border border-gray-300 bg-gray-100 px-1 font-mono text-[10px]">Ctrl</kbd>
                        {" + "}
                        <kbd className="rounded border border-gray-300 bg-gray-100 px-1 font-mono text-[10px]">V</kbd>
                        ).
                      </p>
                    </div>
                  </div>
                </div>

                <label htmlFor="checkdatasource-feedback" className="sr-only">
                  Nội dung phản ánh
                </label>
                <textarea
                  id="checkdatasource-feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onPaste={handlePasteImages}
                  rows={5}
                  placeholder="Ví dụ: Khối final đang hiển thị sai so với sheet…"
                  className="min-h-[120px] w-full shrink-0 resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20"
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  aria-hidden
                  tabIndex={-1}
                  onChange={(e) => {
                    const list = e.target.files;
                    if (list?.length) appendImageFiles(Array.from(list));
                    e.target.value = "";
                  }}
                />

                <div
                  role="button"
                  tabIndex={0}
                  onPaste={handlePasteImages}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDropActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    const next = e.relatedTarget as Node | null;
                    if (next && e.currentTarget.contains(next)) return;
                    setDropActive(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropActive(false);
                    appendImageFiles(Array.from(e.dataTransfer.files));
                  }}
                  aria-label="Khu vực đính kèm ảnh: bấm để chọn, kéo thả hoặc dán ảnh"
                  className={cn(
                    "flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-2 py-3 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f]/30 sm:min-h-[104px] sm:px-3 sm:py-4",
                    dropActive
                      ? "border-[#a1001f] bg-[#a1001f]/5"
                      : "border-gray-300 bg-white/90 hover:border-[#a1001f]/50 hover:bg-amber-50/50"
                  )}
                >
                  <Upload className="h-7 w-7 shrink-0 text-gray-400 sm:h-8 sm:w-8" strokeWidth={1.5} aria-hidden />
                  <div className="flex flex-col gap-0.5 text-xs text-gray-700 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-0">
                    <span className="font-medium text-gray-900">Kéo thả ảnh vào đây</span>
                    <span className="hidden text-gray-400 sm:inline">·</span>
                    <span>hoặc bấm để chọn file</span>
                  </div>
                  <p className="max-w-[min(100%,240px)] px-1 text-[11px] leading-snug text-gray-500">
                    Cũng có thể dán ảnh khi đang gõ ở ô mô tả phía trên. Tối đa {MAX_FEEDBACK_IMAGES} ảnh.
                  </p>
                </div>

                {feedbackImages.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-gray-700">
                      Ảnh đính kèm ({feedbackImages.length}/{MAX_FEEDBACK_IMAGES})
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {feedbackImages.map((file, idx) => (
                        <FeedbackImageThumb
                          key={`${file.name}-${file.size}-${file.lastModified}-${idx}`}
                          file={file}
                          onRemove={() => setFeedbackImages((prev) => prev.filter((_, i) => i !== idx))}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={submitFeedback}
                  disabled={submitting}
                  className="mt-auto w-full shrink-0 touch-manipulation rounded-lg bg-[#a1001f] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#870019] disabled:opacity-60 sm:w-auto sm:self-start sm:py-2.5"
                  type="button"
                >
                  {submitting ? "Đang gửi…" : "Gửi cho admin"}
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 sm:px-2.5 sm:py-2">
      <p className="text-xs leading-tight text-gray-500">{label}</p>
      <p className="mt-0.5 break-words text-sm leading-tight font-medium text-gray-900">{value}</p>
    </div>
  );
}

export default function CheckDataSourcePage() {
  return (
    <AppLayout requireAuth={true} requireAdmin={false} redirectPath="/login">
      <CheckDataSourceContent />
    </AppLayout>
  );
}
