"use client";

import {
  IMPORT_RECOVERY_STORAGE_KEY,
  IMPORT_UI_STORAGE_KEY,
  clearImportRecoveryStorage,
  migrateRunningImportToRecovery,
  notifyImportRecoveryChanged,
  readImportRecoveryFromStorage,
  type ImportRecoveryStored,
} from "@/lib/exam-registration-import-storage";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

function isDanhSachDangKyPath(path: string): boolean {
  return path.includes("danh-sach-dang-ky");
}

/**
 * HUD "Import đã dừng" (amber) — hiển thị trên mọi màn admin cho đến khi Đóng hoặc import lại (trang danh sách).
 * Migrate `running` → recovery khi F5 hoặc khi rời trang danh sách (không migrate khi đang import trên đúng trang đó).
 */
export function ExamRegImportRecoveryHud() {
  const pathname = usePathname();
  const [recovery, setRecovery] = useState<ImportRecoveryStored | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef<string | null>(null);

  const applyRecoveryFromStorage = useCallback(() => {
    setRecovery(readImportRecoveryFromStorage());
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload") {
      migrateRunningImportToRecovery();
    }
    applyRecoveryFromStorage();
  }, [applyRecoveryFromStorage]);

  useEffect(() => {
    if (prevPathRef.current !== null) {
      const leftDanhSach =
        isDanhSachDangKyPath(prevPathRef.current) && !isDanhSachDangKyPath(pathname);
      if (leftDanhSach) {
        migrateRunningImportToRecovery();
      }
    }
    prevPathRef.current = pathname;
    applyRecoveryFromStorage();
  }, [pathname, applyRecoveryFromStorage]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === IMPORT_RECOVERY_STORAGE_KEY || e.key === IMPORT_UI_STORAGE_KEY) {
        applyRecoveryFromStorage();
      }
    };
    const onCustom = () => applyRecoveryFromStorage();
    window.addEventListener("storage", onStorage);
    window.addEventListener("exam-reg-import-recovery-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("exam-reg-import-recovery-changed", onCustom);
    };
  }, [applyRecoveryFromStorage]);

  useEffect(() => {
    const lines = recovery?.log ?? [];
    if (!lines.length || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [recovery]);

  if (!recovery) return null;

  const dismiss = () => {
    clearImportRecoveryStorage();
    setRecovery(null);
    notifyImportRecoveryChanged();
  };

  return (
    <div
      className="group fixed bottom-4 right-4 z-[9980] w-[min(calc(100vw-1rem),14rem)]"
      role="status"
      aria-live="polite"
      aria-label="Import đã dừng — xem nhật ký khi di chuột"
    >
      <div className="rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 shadow-lg backdrop-blur-sm">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="min-w-0 text-xs font-semibold text-gray-800">Import đã dừng</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="font-mono text-xs tabular-nums font-bold text-[#a1001f]">{recovery.progress}%</span>
            <button
              type="button"
              onClick={dismiss}
              className="rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100"
            >
              Đóng
            </button>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-amber-600 transition-[width] duration-300 ease-out"
            style={{ width: `${recovery.progress}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] leading-tight text-gray-500">
          Trang đã tải lại hoặc bạn đã rời màn hình — tiến trình gửi trước đó đã dừng. Chọn file để import lại. Di chuột
          để xem log đã lưu.
        </p>
      </div>
      <div
        role="log"
        aria-live="polite"
        className="pointer-events-none invisible absolute bottom-full right-0 z-[9981] mb-1 max-h-52 w-[min(calc(100vw-1rem),22rem)] overflow-hidden rounded-lg border border-gray-200 bg-white p-2 opacity-0 shadow-xl transition-opacity duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100"
      >
        <p className="mb-1 border-b border-gray-100 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Nhật ký import
        </p>
        <div ref={logRef} className="max-h-44 overflow-y-auto font-mono text-[10px] leading-snug text-gray-800">
          {recovery.log.length === 0 ? (
            <span className="text-gray-400">Không có dòng log.</span>
          ) : (
            recovery.log.map((line, i) => (
              <div key={i} className="border-b border-gray-50 py-0.5 last:border-0">
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
