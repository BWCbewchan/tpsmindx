"use client";
import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";

const TeacherHomePage = () => {
  return (
    <PageContainer
      title="Trang chủ"
      description="Thông tin và lịch hoạt động của bạn"
    >
      <div className="space-y-6">
        {/* Carousel Tin tức mới nhất */}
        <Card title="📰 Tin tức mới nhất" hover>
          <div className="h-48 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
            <div className="text-center">
              <p className="text-gray-600 font-medium">Carousel tin tức sẽ hiển thị ở đây</p>
              <p className="text-sm text-gray-500 mt-2">Đang phát triển...</p>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
};

export default TeacherHomePage;
