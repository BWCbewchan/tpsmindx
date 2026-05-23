/**
 * @deprecated Dùng `import { toast } from '@/lib/app-toast'` hoặc `useToast` từ `@/lib/use-toast`.
 */
export { AppToastBar, toast, type AppToastVariant } from "@/lib/app-toast";

export type ToastType = import("@/lib/app-toast").AppToastVariant;
