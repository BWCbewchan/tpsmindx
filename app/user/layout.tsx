"use client";

import AppLayout from "@/components/AppLayout";
import UserFeedbackWidget from "@/components/feedback/UserFeedbackWidget";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout requireAuth={true} requireAdmin={false} redirectPath="/login">
      {children}
      <UserFeedbackWidget />
    </AppLayout>
  );
}
