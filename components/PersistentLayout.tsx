"use client";

import UserFirstLoginOnboarding from '@/components/onboarding/UserFirstLoginOnboarding'
import { Sidebar } from '@/components/sidebar'
import { useAuth } from '@/lib/auth-context'
import { SidebarProvider, useSidebar } from '@/lib/sidebar-context'
import { usePathname } from 'next/navigation'
import { Suspense } from 'react'

function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isOpen } = useSidebar();
  const { user } = useAuth();

  // Don't show sidebar on login/root/checkdatasource/maintenance pages
  const noSidebarPaths =
    pathname.startsWith('/login') ||
    pathname === '/' ||
    pathname.startsWith('/checkdatasource') ||
    pathname.startsWith('/bao-tri')
  let shouldShowSidebar = !noSidebarPaths

  // Hide sidebar if admin user has no permissions
  if (shouldShowSidebar && pathname.startsWith("/admin")) {
    const isSuperAdmin = user?.role === "super_admin";
    const isAdminUser =
      user?.isAdmin ||
      ["super_admin", "admin", "manager"].includes(user?.role || "");

    if (
      isAdminUser &&
      !isSuperAdmin &&
      (!user?.permissions || user.permissions.length === 0)
    ) {
      shouldShowSidebar = false;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {shouldShowSidebar && (
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      )}
      <main
        data-tour="tour-content"
        className={`
          transition-all duration-500 ease-in-out min-h-screen lg:will-change-transform
          ${
            shouldShowSidebar
              ? isOpen
                ? 'lg:ml-56' // Desktop with sidebar
                : 'lg:ml-0' // Desktop without sidebar
              : ''
          }
          ${shouldShowSidebar ? 'relative' : ''}
        `}
      >
        <div className="w-full min-h-screen lg:h-screen">
          <div className="min-h-screen lg:h-full lg:overflow-y-auto custom-scrollbar">
            <div
              className={`w-full px-0 py-1.25 sm:px-[1.5%] sm:py-2 lg:px-[2%] lg:py-3 xl:px-[2.5%] xl:py-3 ${
                shouldShowSidebar && !isOpen ? 'pt-14 sm:pt-16 lg:pt-3' : ''
              }`}
            >
              {children}
            </div>
          </div>
        </div>
      </main>
      {!pathname.startsWith('/bao-tri') && <UserFirstLoginOnboarding />}
    </div>
  );
}

export function PersistentLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Layout>{children}</Layout>
    </SidebarProvider>
  );
}
