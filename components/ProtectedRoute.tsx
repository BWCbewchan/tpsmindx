"use client";

import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only redirect once to prevent loop
    if (!isLoading && !user && pathname !== '/login' && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push('/login');
    }
    
    // Reset redirect flag when user logs in
    if (user) {
      hasRedirected.current = false;
    }
  }, [user, isLoading, pathname, router]);

  // Don't show loading screen anymore - let pages load immediately
  // and handle their own loading states
  if (isLoading) {
    return <>{children}</>;
  }

  // If not authenticated and not on login page, don't render
  if (!user && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
