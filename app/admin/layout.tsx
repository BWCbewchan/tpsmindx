"use client";

import AppLayout from "@/components/AppLayout";
import { ExamRegImportRecoveryHud } from "@/components/ExamRegImportRecoveryHud";
import { UploadVideoProvider } from "@/components/UploadVideoContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UploadVideoProvider>
      <AppLayout requireAuth={true} requireAdmin={true} redirectPath="/login">
        <ExamRegImportRecoveryHud />
        {children}
      </AppLayout>
    </UploadVideoProvider>
  );
}
