"use client";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageContainer } from "@/components/PageContainer";
import { Settings } from "lucide-react";

export default function Page3() {
  return (
    <PageContainer
      title="Màn hình 3"
      description="Nội dung và quản lý màn hình 3"
    >
      <Card>
        <EmptyState
          icon={Settings}
          title="Chưa có nội dung"
          description="Màn hình này đang được phát triển. Nội dung sẽ được cập nhật sớm."
        />
      </Card>
    </PageContainer>
  );
}
