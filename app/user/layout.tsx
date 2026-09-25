"use client";

import AppLayout from "@/components/AppLayout";
import UserFeedbackWidget from "@/components/feedback/UserFeedbackWidget";
import { AdminPortfolioFeaturePopup } from "@/components/portfolio/AdminPortfolioFeaturePopup";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout requireAuth={true} requireAdmin={false} redirectPath="/login">
      <AdminPortfolioFeaturePopup />
      {children}
      <UserFeedbackWidget />
    </AppLayout>
  );
}
