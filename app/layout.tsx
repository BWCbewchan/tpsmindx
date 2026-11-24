import { DevicePushProvider } from "@/components/notifications/DevicePushProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PersistentLayout } from "@/components/PersistentLayout";
import { PwaInstallProvider } from "@/components/pwa/PwaInstallProvider";
import { TrackerProvider } from "@/components/TrackerProvider";
import { AuthProvider } from "@/lib/auth-context";
import { TeacherProvider } from "@/lib/teacher-context";
import { Analytics } from "@vercel/analytics/react";
import type { Metadata, Viewport } from "next";
import { Toaster } from 'react-hot-toast';
import "./globals.css";
import StoreProvider from "./StoreProvider";

export const metadata: Metadata = {
  title: "Teaching Portal System (TPS)",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TPS",
  },
  description: "Hệ thống quản lý giảng dạy",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#a1001f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showAnalytics = process.env.NODE_ENV === 'production'
  return (
    <html lang="vi">
      <body className="bg-background text-foreground antialiased">
        <PwaInstallProvider>
          <ErrorBoundary>
            <StoreProvider>
              <AuthProvider>
                <DevicePushProvider>
                <TeacherProvider>
                  <TrackerProvider>
                    <PersistentLayout>
                      {children}
                    </PersistentLayout>
                  </TrackerProvider>
                </TeacherProvider>
                </DevicePushProvider>
              </AuthProvider>
            </StoreProvider>
          </ErrorBoundary>
        </PwaInstallProvider>
        <Toaster
          position="top-right"
          containerStyle={{ top: 24, right: 24, zIndex: 1700 }}
          gutter={12}
          toastOptions={{
            duration: 4000,
            style: {
              background: "transparent",
              boxShadow: "none",
              padding: 0,
              maxWidth: "none",
            },
          }}
        />
        {showAnalytics ? <Analytics /> : null}
      </body>
    </html>
  );
}
