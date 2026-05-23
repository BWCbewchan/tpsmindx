"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";

export default function Dashboard() {
  return (
    <PageContainer
      title="Dashboard"
      description="Chọn một màn hình từ sidebar bên trái để bắt đầu"
    >
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="text-center max-w-md" padding="lg" hover>
          <div className="flex flex-col items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#a1001f] to-[#c41230] flex items-center justify-center">
              <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Chào mừng đến trang chủ
              </h2>
              <p className="text-sm text-gray-600">
                Sử dụng menu bên trái để điều hướng
              </p>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
