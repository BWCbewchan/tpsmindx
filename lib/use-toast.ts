"use client";

/**
 * Hook + helper — cùng style với `@/lib/app-toast` (card trắng, border trái).
 */

import { toast } from "@/lib/app-toast";
import type { ToastOptions } from "react-hot-toast";

type OptToast = ToastOptions & { message?: string };

export const useToast = () => ({
  success: (message: string, opts?: OptToast) => toast.success(message, opts),

  error: (message: string, opts?: OptToast) => toast.error(message, opts),

  warning: (message: string, opts?: OptToast) => toast.warning(message, opts),

  info: (message: string, opts?: OptToast) => toast.info(message, opts),

  loading: toast.loading,

  promise: toast.promise,

  dismiss: toast.dismiss,
});

export const showToast = {
  success: (message: string, opts?: OptToast) => toast.success(message, opts),
  error: (message: string, opts?: OptToast) => toast.error(message, opts),
  warning: (message: string, opts?: OptToast) => toast.warning(message, opts),
  info: (message: string, opts?: OptToast) => toast.info(message, opts),
};

export { toast };
