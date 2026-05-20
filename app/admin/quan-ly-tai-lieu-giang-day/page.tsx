"use client";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageContainer } from "@/components/PageContainer";
import { FileText } from "lucide-react";

export default function QuanLyTaiLieuGiangDayPage() {
  return (
    <PageContainer
      title="Quản lý tài liệu giảng dạy"
      description="Quản lý toàn bộ tài liệu giảng dạy của hệ thống"
    >
      <Card>
        <EmptyState
          icon={FileText}
          title="Chưa có nội dung"
          description="Tính năng quản lý tài liệu giảng dạy đang được phát triển. Nội dung sẽ được cập nhật sớm."
        />
      </Card>
    </PageContainer>
  );
}