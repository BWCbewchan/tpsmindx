"use client";

import { Badge, badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

interface StatusBadgeProps {
  status: string;
  className?: string;
}

// Mapping trạng thái tiếng Việt phổ biến → variant
const statusMap: Record<string, BadgeVariant> = {
  // Success states
  "Đã duyệt": "success",
  "Đã hoàn thành": "success",
  "Hoàn thành": "success",
  "Đạt": "success",
  "Approved": "success",
  "Completed": "success",
  "Active": "success",

  // Warning states
  "Chờ duyệt": "warning",
  "Đang xử lý": "warning",
  "Pending": "warning",
  "Processing": "warning",
  "Chờ xác nhận": "warning",

  // Danger states
  "Từ chối": "danger",
  "Không đạt": "danger",
  "Hết hạn": "danger",
  "Rejected": "danger",
  "Failed": "danger",
  "Expired": "danger",

  // Info states
  "Mới": "info",
  "Đang mở": "info",
  "New": "info",
  "Open": "info",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusMap[status] || "secondary";

  return (
    <Badge variant={variant} className={cn(className)}>
      {status}
    </Badge>
  );
}

// Allow custom status-to-variant mapping
export function createStatusBadge(customMap: Record<string, BadgeVariant>) {
  return function CustomStatusBadge({ status, className }: StatusBadgeProps) {
    const variant = customMap[status] || statusMap[status] || "secondary";
    return (
      <Badge variant={variant} className={cn(className)}>
        {status}
      </Badge>
    );
  };
}
