"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface SidebarContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
  // Dùng cho onboarding: yêu cầu sidebar mở rộng các submenu chứa label này
  requestExpandLabels: string[];
  setRequestExpandLabels: (labels: string[]) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [requestExpandLabels, setRequestExpandLabels] = useState<string[]>([]);

  // Auto-collapse on mobile with debounce
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const isMobile = window.innerWidth < 1024;
        const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        
        if (isMobile || isTablet) {
          setIsOpen(false);
        } else {
          // Auto-open on desktop if it was closed by mobile resize
          const wasClosedByMobile = localStorage.getItem('sidebarClosedByMobile') === 'true';
          if (wasClosedByMobile) {
            setIsOpen(true);
            localStorage.removeItem('sidebarClosedByMobile');
          }
        }
      }, 150);
    };
    
    // Store initial state
    if (window.innerWidth < 1024) {
      localStorage.setItem('sidebarClosedByMobile', 'true');
    }
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const toggle = () => setIsOpen(!isOpen);

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen, toggle, requestExpandLabels, setRequestExpandLabels }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}