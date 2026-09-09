"use client";

import UserFirstLoginOnboarding from '@/components/onboarding/UserFirstLoginOnboarding'
import { Sidebar } from '@/components/sidebar'
import { DockNav } from '@/components/dock-nav'
import NotificationBell from '@/components/NotificationBell'
import { useAuth } from '@/lib/auth-context'
import { SidebarProvider, useSidebar } from '@/lib/sidebar-context'
import { usePathname } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'

function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isOpen, navMode } = useSidebar();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const isCandidatePortal = pathname.startsWith('/candidate-portal');
  const isPublicPortfolio = pathname.startsWith('/public/portfolio');
  const isPublicCheckout = pathname.startsWith('/public/checkout');
  const isStandaloneLesson =
    pathname.startsWith('/admin/hr-onboarding/videos/lesson') ||
    pathname.startsWith('/candidate-portal/videos/lesson');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't show sidebar on login/root/checkdatasource/maintenance pages
  const noSidebarPaths =
    pathname.startsWith('/login') ||
    pathname === '/' ||
    pathname.startsWith('/checkdatasource') ||
    pathname.startsWith('/public/portfolio') ||
    pathname.startsWith('/public/checkout') ||
    pathname.startsWith('/bao-tri') ||
    pathname.startsWith('/hr-candidate-application') ||
    isCandidatePortal ||
    isStandaloneLesson
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

  const isDockMode = navMode === 'dock'

  return (
    <div className="min-h-screen bg-background text-foreground">
      {mounted && shouldShowSidebar && (
        <>
          {/* Always render Sidebar (it handles its own open/close state) */}
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>

          {/* Notification Bell — only in sidebar mode on desktop (dock mode has it in dock) */}
          {!isDockMode && (
            <Suspense fallback={null}>
              <div className="hidden lg:block">
                <NotificationBell />
              </div>
            </Suspense>
          )}

          {/* Dock navigation — shown only in dock mode */}
          {isDockMode && (
            <Suspense fallback={null}>
              <DockNav />
            </Suspense>
          )}
        </>
      )}
      <main
        data-tour="tour-content"
        className={`
          transition-all duration-500 ease-in-out min-h-screen lg:will-change-transform
          ${
            mounted && shouldShowSidebar && !isDockMode
              ? isOpen
                ? 'lg:ml-56' // Desktop with sidebar open
                : 'lg:ml-0' // Desktop without sidebar
              : ''
          }
          ${shouldShowSidebar ? 'relative' : ''}
        `}
      >
        <div className="w-full min-h-screen lg:h-screen">
          <div id="main-scroll-container" className={`min-h-screen lg:h-full custom-scrollbar ${isStandaloneLesson ? 'overflow-y-auto' : 'lg:overflow-y-auto'}`}>
            <div
              className={
                isStandaloneLesson || isPublicPortfolio || isPublicCheckout
                  ? 'w-full p-0'
                  : `w-full px-0 py-1.25 sm:px-[1.5%] sm:py-2 lg:px-[2%] lg:py-3 xl:px-[2.5%] xl:py-3 ${
                      mounted && shouldShowSidebar && !isDockMode && !isOpen ? 'pt-14 sm:pt-16 lg:pt-3' : ''
                    } ${
                      // Add bottom padding in dock mode so content isn't hidden behind the dock
                      mounted && shouldShowSidebar && isDockMode ? 'pb-24' : ''
                    }`
              }
            >
              {children}
            </div>
          </div>
        </div>
      </main>
      {!pathname.startsWith('/bao-tri') && !isCandidatePortal && !isStandaloneLesson && !isPublicCheckout && <UserFirstLoginOnboarding />}
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
