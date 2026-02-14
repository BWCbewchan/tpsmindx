"use client";

import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { cn } from "@/lib/utils";
import { ChevronDown, FileText, GraduationCap, Home, LayoutDashboard, LogOut, Megaphone, Menu, MessageSquare, Settings, Sparkles, Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const adminMenuItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Home },
  { href: "/admin/page1", label: "Thông tin GV", icon: LayoutDashboard },
  { href: "/admin/page2", label: "màn hình 2", icon: Users },
  { href: "/admin/page3", label: "Màn hình 3", icon: Users },
  { href: "/admin/page4", label: "Màn hình 4", icon: Settings },
  {
    label: "Đào tạo nâng cao",
    icon: FileText,
    submenu: [
      { href: "/admin/page5", label: "Quản lý đào tạo nâng cao" },
      { href: "/admin/training-dashboard", label: "Thống kê" },
      { href: "/admin/assignments", label: "Quản lý Assignments" },
    ]
  },
  { href: "/admin/giaitrinh", label: "Quản lý Giải trình", icon: MessageSquare },
  { href: "/admin/truyenthong", label: "Quản lý truyền thông", icon: Megaphone },
];

const userMenuItems = [
  { href: "/user/truyenthong", label: "Thông tin mới", icon: Megaphone },
  { href: "/user/thongtingv", label: "Thông tin của tôi", icon: Home },
  { href: "/user/training", label: "Đào tạo nâng cao", icon: GraduationCap },
  { href: "/user/assignments", label: "My Assignments", icon: FileText },
  { href: "/user/giaitrinh", label: "Giải trình kiểm tra", icon: MessageSquare },
];

export function Sidebar() {
  const { isOpen, setIsOpen } = useSidebar();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Load expanded menus from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('expandedMenus');
    if (saved) {
      try {
        // eslint-disable-next-line
        setExpandedMenus(JSON.parse(saved));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Determine menu items based on current path (admin or user)
  const isUserArea = pathname.startsWith('/user');
  const menuItems = isUserArea ? userMenuItems : adminMenuItems;

  // Auto-expand submenu if current page is in it
  useEffect(() => {
    menuItems.forEach((item) => {
      if ('submenu' in item && item.submenu) {
        const isInSubmenu = item.submenu.some(sub => pathname === sub.href || pathname.startsWith(sub.href + '/'));
        if (isInSubmenu && !expandedMenus.includes(item.label)) {
          setExpandedMenus(prev => {
            const updated = [...prev, item.label];
            localStorage.setItem('expandedMenus', JSON.stringify(updated));
            return updated;
          });
        }
      }
    });
  }, [pathname, menuItems, expandedMenus]);

  const toggleSubmenu = (label: string) => {
    setExpandedMenus(prev => {
      const updated = prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label];
      
      // Save to localStorage
      localStorage.setItem('expandedMenus', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-sidebar-overlay-custom bg-black/50 backdrop-blur-sm lg:hidden transition-all duration-300 ease-in-out animate-in fade-in-0"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Toggle Button - Modern floating design */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-3 left-3 z-sidebar-toggle p-2 rounded-lg bg-white shadow-md border border-gray-200 hover:shadow-lg hover:scale-105 hover:bg-gradient-to-br hover:from-[#a1001f] hover:to-[#c41230] hover:text-white hover:border-[#a1001f] transition-all duration-300 group animate-in fade-in-0 slide-in-from-left-2"
        >
          <Menu className="h-4 w-4 transition-transform group-hover:rotate-180 duration-300" />
        </button>
      )}

      {/* Sidebar - Modern glass-morphism design */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-sidebar-custom h-screen backdrop-blur-xl bg-white/95 border-r border-gray-200 shadow-xl w-56",
          "transition-all duration-500 ease-in-out will-change-transform",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ transform: `translate3d(${isOpen ? '0' : '-100%'}, 0, 0)` }}
      >
        <div className="flex h-full flex-col">
          {/* Header - Gradient brand header */}
          <div className="relative h-14 flex items-center justify-between px-4 bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white shadow-md">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-wide">Teaching MS</h2>
                <p className="text-xs text-white/80">Quản lý giảng dạy</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-all duration-300 hover:rotate-90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation - Modern cards with smooth hover effects */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const hasSubmenu = 'submenu' in item;
              const isExpanded = expandedMenus.includes(item.label);
              const isActive = !hasSubmenu && (pathname === item.href || pathname.startsWith(item.href + '/'));
              const isSubmenuActive = hasSubmenu && item.submenu?.some(sub => pathname === sub.href || pathname.startsWith(sub.href + '/'));

              return (
                <div key={item.href || item.label} className="group">
                  {hasSubmenu ? (
                    <div className="space-y-1">
                      <button
                        onClick={() => toggleSubmenu(item.label)}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 group/item",
                          isSubmenuActive || isExpanded
                            ? "bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white shadow-md shadow-[#a1001f]/20 scale-[1.01]"
                            : "text-gray-700 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50 hover:shadow-sm hover:scale-[1.01]"
                        )}
                      >
                        <div className={cn(
                          "p-1.5 rounded-md transition-all duration-300",
                          isSubmenuActive || isExpanded
                            ? "bg-white/20"
                            : "bg-gray-100 group-hover/item:bg-white group-hover/item:shadow-sm"
                        )}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="flex-1 text-left">{item.label}</span>
                        <div className={cn(
                          "transition-transform duration-300",
                          isExpanded ? "rotate-180" : ""
                        )}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </div>
                      </button>
                      
                      {/* Submenu with slide animation */}
                      <div className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                      )}>
                        <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 pl-2">
                          {item.submenu?.map((subItem) => {
                            const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + '/');
                            return (
                              <a
                                key={subItem.href}
                                href={subItem.href}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-300 hover:scale-[1.01]",
                                  isSubActive
                                    ? "bg-gradient-to-r from-[#a1001f]/10 to-[#c41230]/10 text-[#a1001f] border-l-3 border-[#a1001f] shadow-sm"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-l-3 hover:border-gray-300"
                                )}
                              >
                                <span>{subItem.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <a
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 group/item",
                        isActive
                          ? "bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white shadow-md shadow-[#a1001f]/20 scale-[1.01]"
                          : "text-gray-700 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50 hover:shadow-sm hover:scale-[1.01]"
                      )}
                    >
                      <div className={cn(
                        "p-1.5 rounded-md transition-all duration-300",
                        isActive
                          ? "bg-white/20"
                          : "bg-gray-100 group-hover/item:bg-white group-hover/item:shadow-sm"
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span>{item.label}</span>
                    </a>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User Info and Logout - Modern card design */}
          {user && (
            <div className="border-t border-gray-200 p-3 bg-gradient-to-br from-gray-50 to-white">
              <div className="mb-2 p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#a1001f] to-[#c41230] flex items-center justify-center text-white font-bold text-xs shadow-md">
                    {user.displayName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{user.displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white text-xs rounded-full font-semibold shadow-sm">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>{user.role === 'teacher' ? 'Teacher' : 'Manager'}</span>
                </div>
              </div>
              <button
                className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold bg-white border-2 border-gray-200 text-gray-700 hover:border-[#a1001f] hover:bg-gradient-to-r hover:from-[#a1001f] hover:to-[#c41230] hover:text-white hover:shadow-md transition-all duration-300 group"
                onClick={logout}
              >
                <LogOut className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Overlay for mobile - smooth fade */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden transition-all duration-300 animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
