"use client";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageContainer } from "@/components/PageContainer";
import { BookOpen } from "lucide-react";

export default function GiaoTrinhChuyenMonPage() {
  return (
    <PageContainer
      title="Giáo trình chuyên môn"
      description="Quản lý giáo trình chuyên môn dành cho giáo viên"
    >
      <Card>
        <EmptyState
          icon={BookOpen}
          title="Chưa có nội dung"
          description="Tính năng giáo trình chuyên môn đang được phát triển. Nội dung sẽ được cập nhật sớm."
        />
      </Card>
    </PageContainer>
  );
}