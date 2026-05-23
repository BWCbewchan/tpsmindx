'use client';

import { useAuth } from '@/lib/auth-context';
import {
  startTracker,
  stopTracker,
  trackPageView,
  trackSessionEnd,
  trackSessionStart,
} from '@/lib/tracker';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Wraps the app to auto-track page views and sessions for ALL users.
 * Place inside the root layout, after AuthProvider.
 */
export function TrackerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const hasStarted = useRef(false);

  // Start tracker + session once user is loaded
  useEffect(() => {
    if (!user) return;
    if (hasStarted.current) return;

    hasStarted.current = true;
    startTracker();
    trackSessionStart();

    return () => {
      trackSessionEnd();
      stopTracker();
      hasStarted.current = false;
    };
  }, [user]);

  // Track page views on route change
  useEffect(() => {
    if (!user) return;
    trackPageView(pathname);
  }, [pathname, user]);

  return <>{children}</>;
}
