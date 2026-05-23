"use client";

import AppLayout from "@/components/AppLayout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout requireAuth={true} requireAdmin={false} redirectPath="/login">
      {children}
    </AppLayout>
  );
}
