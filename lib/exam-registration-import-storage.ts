/** sessionStorage keys — import tiến độ (danh sách đăng ký) */

export const IMPORT_UI_STORAGE_KEY = "exam-reg-import-ui-v1";
export const IMPORT_RECOVERY_STORAGE_KEY = "exam-reg-import-recovery-v1";

export const IMPORT_LOG_STORAGE_MAX = 80;

export type ImportUiStored = {
  v: 1;
  phase: "running";
  progress: number;
  log: string[];
  updatedAt: number;
};

export type ImportRecoveryStored = {
  v: 1;
  progress: number;
  log: string[];
  updatedAt: number;
};

export function readImportRecoveryFromStorage(): ImportRecoveryStored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(IMPORT_RECOVERY_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ImportRecoveryStored>;
    if (data?.v !== 1) return null;
    return {
      v: 1,
      progress: typeof data.progress === "number" ? data.progress : 0,
      log: Array.isArray(data.log) ? data.log : [],
      updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

/** Đọc IMPORT_UI `running` → ghi RECOVERY, xóa UI key. Trả về snapshot sau migrate hoặc null. */
export function migrateRunningImportToRecovery(): ImportRecoveryStored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(IMPORT_UI_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ImportUiStored>;
    if (data?.phase !== "running") return null;
    const log = Array.isArray(data.log) ? data.log : [];
    const slice = log.length > IMPORT_LOG_STORAGE_MAX ? log.slice(-IMPORT_LOG_STORAGE_MAX) : log;
    const recovery: ImportRecoveryStored = {
      v: 1,
      progress: typeof data.progress === "number" ? data.progress : 0,
      log: slice,
      updatedAt: Date.now(),
    };
    sessionStorage.removeItem(IMPORT_UI_STORAGE_KEY);
    sessionStorage.setItem(IMPORT_RECOVERY_STORAGE_KEY, JSON.stringify(recovery));
    return recovery;
  } catch {
    return null;
  }
}

export function clearImportRecoveryStorage(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(IMPORT_RECOVERY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function notifyImportRecoveryChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("exam-reg-import-recovery-changed"));
}
