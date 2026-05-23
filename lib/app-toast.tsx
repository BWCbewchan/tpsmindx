"use client";

/**
 * Toast thống nhất (card trắng, border trái màu, icon lucide) — mọi chỗ import `toast` từ đây.
 * Dựa trên tieuchuan / Toast: title + message tùy chọn; react-hot-toast chỉ làm hàng đợi.
 */

import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  X,
} from "lucide-react";
import hotToast, {
  type Toast as RHTHandle,
  type ToastOptions,
} from "react-hot-toast";

export type AppToastVariant = "success" | "error" | "warning" | "info";

type BarProps = {
  t: RHTHandle;
  variant: AppToastVariant;
  title: string;
  message?: string;
};

export function AppToastBar({ t, variant, title, message }: BarProps) {
  const icons = {
    success: (
      <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
    ),
    error: <AlertCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />,
    warning: (
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
    ),
    info: <Info className="h-5 w-5 shrink-0 text-[#a1001f]" aria-hidden />,
  };

  const borderColors = {
    success: "border-l-emerald-600",
    error: "border-l-red-600",
    warning: "border-l-amber-500",
    info: "border-l-[#a1001f]",
  };

  return (
    <div
      className={cn(
        "pointer-events-auto w-[340px] max-w-[calc(100vw-2rem)] rounded-lg border border-gray-100 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
        "border-l-4",
        borderColors[variant],
        t.visible ? "animate-slide-in-right" : "animate-slide-out-right",
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex gap-3 p-4">
        <div className="mt-0.5 shrink-0">{icons[variant]}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {message ? (
            <p className="mt-1 text-xs text-slate-500">{message}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => hotToast.dismiss(t.id)}
          className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function stripIcon(opts?: ToastOptions): ToastOptions {
  if (!opts) return {};
  const { icon: _i, ...rest } = opts as ToastOptions & { icon?: unknown };
  return rest;
}

function push(
  variant: AppToastVariant,
  title: string,
  message: string | undefined,
  opts?: ToastOptions,
) {
  return hotToast.custom(
    (t) => (
      <AppToastBar t={t} variant={variant} title={title} message={message} />
    ),
    { duration: 4000, ...stripIcon(opts) },
  );
}

const asDefault = (message: string, opts?: ToastOptions) =>
  push("info", message, undefined, { duration: 4000, ...stripIcon(opts) });

export const toast = Object.assign(asDefault, {
  success: (
    title: string,
    opts?: ToastOptions & { message?: string },
  ) => {
    const { message, ...rest } = opts || {};
    return push("success", title, message, {
      duration: 4000,
      ...stripIcon(rest),
    });
  },

  error: (title: string, opts?: ToastOptions & { message?: string }) => {
    const { message, ...rest } = opts || {};
    return push("error", title, message, {
      duration: 5000,
      ...stripIcon(rest),
    });
  },

  warning: (title: string, opts?: ToastOptions & { message?: string }) => {
    const { message, ...rest } = opts || {};
    return push("warning", title, message, {
      duration: 4500,
      ...stripIcon(rest),
    });
  },

  info: (title: string, opts?: ToastOptions & { message?: string }) => {
    const { message, ...rest } = opts || {};
    return push("info", title, message, {
      duration: 4000,
      ...stripIcon(rest),
    });
  },

  loading: (title: string, opts?: ToastOptions) =>
    hotToast.custom(
      (t) => (
        <div
          className={cn(
            "pointer-events-auto flex w-[340px] max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-gray-100 border-l-4 border-l-slate-400 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
            t.visible ? "animate-slide-in-right" : "animate-slide-out-right",
          )}
          role="status"
          aria-live="polite"
        >
          <Loader2
            className="h-5 w-5 shrink-0 animate-spin text-[#a1001f]"
            aria-hidden
          />
          <p className="min-w-0 flex-1 text-sm font-medium text-slate-800">
            {title}
          </p>
          <button
            type="button"
            onClick={() => hotToast.dismiss(t.id)}
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ),
      { duration: Infinity, ...opts },
    ),

  promise: hotToast.promise,
  dismiss: hotToast.dismiss,
  remove: hotToast.remove,
  custom: hotToast.custom,
});
