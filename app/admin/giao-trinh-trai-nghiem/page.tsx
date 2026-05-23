"use client";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageContainer } from "@/components/PageContainer";
import { BookOpen } from "lucide-react";

export default function GiaoTrinhTraiNghiemPage() {
  return (
    <PageContainer
      title="Giáo trình trải nghiệm"
      description="Quản lý giáo trình trải nghiệm dành cho giáo viên"
    >
      <Card>
        <EmptyState
          icon={BookOpen}
          title="Chưa có nội dung"
          description="Tính năng giáo trình trải nghiệm đang được phát triển. Nội dung sẽ được cập nhật sớm."
        />
      </Card>
    </PageContainer>
  );
}