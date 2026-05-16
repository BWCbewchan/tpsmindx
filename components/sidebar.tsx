'use client'

import { useAuth } from '@/lib/auth-context'
import { useSidebar } from '@/lib/sidebar-context'
import { isTempHiddenUserRoute } from '@/lib/temp-hidden-user-routes'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  DollarSign,
  FileText,
  GraduationCap,
  Home,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/primitives/icon'

export function Sidebar() {
  const { isOpen, setIsOpen, requestExpandLabels } = useSidebar()
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const closeSidebarOnMobile = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsOpen(false)
    }
  }, [setIsOpen])

  const normalizeRoleToken = (value?: string) =>
    (value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')

  const toTitleCase = (value?: string) => {
    if (!value) return ''

    return value
      .trim()
      .split(/\s+/)
      .map((word) => {
        if (!word) return word
        if (/^[A-Z0-9&()+/.-]+$/.test(word)) return word
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      })
      .join(' ')
  }

  const isNavLinkActive = useCallback(
    (href?: string) => {
      if (!href) return false

      const [targetPath, targetQuery] = href.split('?')
      const pathMatched =
        pathname === targetPath || pathname.startsWith(`${targetPath}/`)
      if (!pathMatched) return false
      if (!targetQuery) return true

      const queryParams = new URLSearchParams(targetQuery)
      for (const [key, value] of queryParams.entries()) {
        if (searchParams.get(key) !== value) return false
      }

      return true
    },
    [pathname, searchParams],
  )

  // Load expanded menus from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('expandedMenus')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed && Array.isArray(parsed)) {
          // Use setTimeout to avoid synchronous setState during effect execution
          const timer = setTimeout(() => {
            setExpandedMenus(parsed)
          }, 0)
          return () => clearTimeout(timer)
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  const isOnboardingActive =
    typeof document !== 'undefined' &&
    document.documentElement.dataset.onboarding === '1'

  // Determine menu items based on current path (admin or user)
  const isUserArea = pathname.startsWith('/user')

  const adminMenuItems = [
    { href: '/admin/dashboard', label: 'Bảng Điều Khiển', icon: Home },
    {
      href: '/admin/truyenthong',
      label: 'Quản Lý Truyền Thông',
      icon: Megaphone,
    },
    {
      href: '/admin/hr-candidates',
      label: 'Đào tạo đầu vào',
      icon: Users,
      submenu: [
        {
          href: '/admin/hr-candidates/gen-planner?region=south',
          label: 'Miền Nam (HCM + Tỉnh Nam)',
        },
        {
          href: '/admin/hr-candidates/gen-planner?region=north',
          label: 'Miền Bắc (HN + Tỉnh Bắc + Tỉnh Trung)',
        },
      ],
    },
    {
      label: 'Quản lý Giáo viên & Vận hành',
      icon: Users,
      submenu: [
        { href: '/admin/page1', label: 'Hồ sơ Giáo viên' },
        {
          href: '/admin/page4/quan-ly-lich-lam-viec',
          label: 'Quản lý lịch làm việc',
        },
        { href: '/admin/page4/lich-danh-gia', label: 'Lịch sự kiện' },
        {
          href: '/admin/xin-nghi-mot-buoi',
          label: 'Tiếp nhận xin nghỉ 1 buổi',
        },
        {
          label: 'Quản lý điều phối',
          submenu: [
            {
              href: '/admin/xin-nghi-mot-buoi',
              label: 'Danh sách yêu cầu xin nghỉ 1 buổi',
            },
          ],
        },
        {
          label: 'Quản lý Nâng/Hạ Lương',
          icon: DollarSign,
          submenu: [
            {
              href: '/admin/deal-luong?type=salary_deal',
              label: 'Thỏa thuận lương',
            },
            {
              href: '/admin/deal-luong?type=salary_reduction',
              label: 'Hạ lương',
            },
            { href: '/admin/deal-luong?type=bonus', label: 'Nâng lương' },
          ],
        },
      ],
    },
    {
      label: 'Đào tạo & Khảo thí',
      icon: GraduationCap,
      submenu: [
        {
          label: 'Đào Tạo Nâng Cao',
          icon: FileText,
          submenu: [
            { href: '/admin/page5', label: 'Thư viện video nâng cao' },
            { href: '/admin/assignments', label: 'Thư viện đề nâng cao' },
            { href: '/admin/training-dashboard', label: 'Thống kê' },
          ],
        },
        {
          label: 'Kiểm Tra Chuyên Môn/Trải Nghiệm',
          icon: Settings,
          submenu: [
            // { href: "/admin/page4/form-dang-ky", label: "Form đăng ký kiểm tra" },
            {
              href: '/admin/page4/danh-sach-dang-ky',
              label: 'Danh sách Giáo viên đăng ký',
            },
            { href: '/admin/giaitrinh', label: 'Quản lý Giải trình' },
            { href: '/admin/thu-vien-de', label: 'Thư viện đề chuyên môn' },
          ],
        },
        {
          label: 'Quy Trình, Quy Định K12 Teaching',
          icon: BookOpen,
          submenu: [
            { href: '/admin/page2', label: 'Xem Tài Liệu' },
            { href: '/admin/page2/manage', label: 'Quản Lý Tài Liệu' },
          ],
        },
      ],
    },
    {
      label: 'Cấu Hình Hệ Thống',
      icon: Settings,
      submenu: [
        { href: '/admin/user-management', label: 'Quản lý tài khoản' },
        { href: '/admin/feedback', label: 'Feedback Manager' },
        {
          href: '/admin/feedback?source=datasource',
          label: 'Feedback Datasource Manager',
        },
        { href: '/admin/database', label: 'Database Manager' },
        { href: '/admin/cloudinary', label: 'Cloudinary Manager' },
        { href: '/admin/s3-supabase-manager', label: 'S3 Supabase Manager' },
      ],
    },
    {
      href: '/admin/system-metrics',
      label: 'Quản lý chỉ số hệ thống',
      icon: BarChart3,
    },
  ]

  const userMenuItems = [
    {
      href: '/user/truyenthong',
      label: 'Truyền thông nội bộ',
      icon: Megaphone,
    },
    {
      href: '/user/thong-tin-giao-vien',
      label: 'Thông tin của tôi',
      icon: Home,
    },
    {
      label: 'Lịch & Hoạt động',
      icon: CalendarDays,
      submenu: [
        { href: '/user/hoat-dong-hang-thang', label: 'Hoạt động hàng tháng' },
        { href: '/user/lich-cua-toi', label: 'Lịch cá nhân' },
      ].filter((item) => !isTempHiddenUserRoute(item.href)),
    },
    {
      label: 'Đào tạo & Khảo thí',
      icon: GraduationCap,
      submenu: [
        { href: '/user/dao-tao-nang-cao', label: 'Đào tạo nâng cao' },
        {
          label: 'Kiểm Tra Chuyên Môn/Trải Nghiệm',
          submenu: [
            { href: '/user/assignments', label: 'Quản lý kiểm tra' },
            { href: '/user/giaitrinh', label: 'Giải trình điểm kiểm tra' },
          ],
        },
      ],
    },
    {
      label: 'Tài liệu nội bộ',
      icon: BookOpen,
      submenu: [
        { href: '/user/quy-trinh-quy-dinh', label: 'Quy trình & Quy định' },
      ],
    },
    {
      href: '/user/quan-ly-phan-hoi',
      label: 'Trung tâm phản hồi',
      icon: FileText,
    },
  ]

  const isPathMatch = (href?: string) => {
    if (!href) return false
    if (href.includes('?')) {
      const [hrefPath, hrefSearch] = href.split('?')
      return pathname === hrefPath && searchParams.toString() === hrefSearch
    }
    // Sibling routes in submenu: only exact match, not startsWith
    // So /admin/page2 only matches /admin/page2, NOT /admin/page2/manage
    return pathname === href
  }

  const getRoutePermissionAliases = (path: string) => {
    if (path === '/admin/thu-vien-de') {
      return ['/admin/thu-vien-de', '/admin/page4/thu-vien-de']
    }
    if (path === '/admin/page4/thu-vien-de') {
      return ['/admin/page4/thu-vien-de', '/admin/thu-vien-de']
    }
    return [path]
  }

  const isMenuItemActive = (item: any): boolean => {
    if (item?.submenu && Array.isArray(item.submenu)) {
      return item.submenu.some((child: any) => isMenuItemActive(child))
    }
    return isPathMatch(item?.href)
  }

  // Filter admin menu items based on user permissions
  const getFilteredAdminMenuItems = () => {
    if (!user) return []

    const normalizedRole = normalizeRoleToken(user.role)
    const isSuperAdmin =
      normalizedRole === 'super_admin' ||
      (user.userRoles || []).some(
        (code) => normalizeRoleToken(code) === 'super_admin',
      )

    if (isSuperAdmin) return adminMenuItems

    // manager và admin luôn có quyền truy cập deal-luong
    const DEAL_LUONG_ROUTES = ['/admin/deal-luong', '/admin/tao-deal-luong']
    const basePermissions = user.permissions || []
    const permissions = ['manager', 'admin'].includes(normalizedRole)
      ? Array.from(new Set([...basePermissions, ...DEAL_LUONG_ROUTES]))
      : basePermissions

    const hasAnyK12Access = permissions.some((p) => {
      const normalizedPath = p.split('?')[0]
      return (
        normalizedPath === '/admin/page2' ||
        normalizedPath.startsWith('/admin/page2/')
      )
    })

    const effectivePermissions = hasAnyK12Access
      ? Array.from(
        new Set([...permissions, '/admin/page2', '/admin/page2/manage']),
      )
      : permissions

    const roleCodes = (user.userRoles || []).map((code) =>
      normalizeRoleToken(code),
    )
    const hasTrainingInputRole = roleCodes.some(
      (code) => code === 'hr' || code === 'te' || code === 'tf',
    )
    if (effectivePermissions.length === 0 && !hasTrainingInputRole) return []

    const hasPermissionForHref = (href: string) => {
      const targetPath = href.split('?')[0]
      return permissions.some(
        (p) =>
          targetPath === p ||
          targetPath.startsWith(`${p}/`) ||
          p.startsWith(`${targetPath}/`),
      )
    }

    const filterMenuItemsByPermissions = (items: any[]): any[] => {
      return items
        .map((item) => {
          const isK12PolicyGroup =
            item?.label === 'Quy Trình, Quy Định K12 Teaching'
          if (
            isK12PolicyGroup &&
            item?.submenu &&
            Array.isArray(item.submenu)
          ) {
            const canOpenK12Group =
              hasPermissionForHref('/admin/page2') ||
              hasPermissionForHref('/admin/page2/manage') ||
              pathname.startsWith('/admin/page2')

            if (canOpenK12Group) {
              return item
            }
          }

          const isTrainingInputMenu = item?.href === '/admin/hr-candidates'
          if (isTrainingInputMenu && hasTrainingInputRole) {
            return item
          }

          if (item?.href === '/admin/system-metrics') {
            return null
          }

          if (item?.submenu && Array.isArray(item.submenu)) {
            const filteredChildren = filterMenuItemsByPermissions(item.submenu)
            if (filteredChildren.length > 0) {
              return { ...item, submenu: filteredChildren }
            }
          }

          if (item?.href && hasPermissionForHref(item.href)) {
            return item
          }

          return null
        })
        .filter(Boolean)
    }

    return filterMenuItemsByPermissions(adminMenuItems)
  }

  const menuItems = isUserArea ? userMenuItems : getFilteredAdminMenuItems()

  const hasActiveDescendant = useCallback(
    (menuItem: any): boolean => {
      const checkDescendant = (item: any): boolean => {
        if (item?.href && isNavLinkActive(item.href)) {
          return true
        }

        if (item?.submenu && Array.isArray(item.submenu)) {
          return item.submenu.some((child: any) => checkDescendant(child))
        }

        return false
      }

      return checkDescendant(menuItem)
    },
    [isNavLinkActive],
  )

  // Auto-expand submenu if current page is in it (including nested submenu items)
  useEffect(() => {
    if (isOnboardingActive) {
      const labelsToExpand = menuItems
        .filter((item: any) => item?.submenu && Array.isArray(item.submenu))
        .map((item: any) => item.label)
      setExpandedMenus((prev) => {
        const next = Array.from(new Set([...prev, ...labelsToExpand]))
        // Avoid infinite loops by not updating when unchanged.
        if (
          next.length === prev.length &&
          next.every((v, i) => v === prev[i])
        ) {
          return prev
        }
        return next
      })
      return
    }

    menuItems.forEach((item) => {
      if ('submenu' in item && item.submenu) {
        const isInSubmenu = hasActiveDescendant(item)
        if (isInSubmenu && !expandedMenus.includes(item.label)) {
          setExpandedMenus((prev) => {
            const updated = [...prev, item.label]
            localStorage.setItem('expandedMenus', JSON.stringify(updated))
            return updated
          })
        }
      }
    })
  }, [
    menuItems,
    pathname,
    searchParams,
    expandedMenus,
    hasActiveDescendant,
    isOnboardingActive,
  ])

  useEffect(() => {
    closeSidebarOnMobile()
  }, [pathname, closeSidebarOnMobile])

  // Onboarding: tự động mở submenu khi được yêu cầu
  useEffect(() => {
    if (!requestExpandLabels || requestExpandLabels.length === 0) return
    setExpandedMenus((prev) => {
      const next = Array.from(new Set([...prev, ...requestExpandLabels]))
      return next
    })
  }, [requestExpandLabels])

  const toggleSubmenu = (label: string) => {
    setExpandedMenus((prev) => {
      const updated = prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
      return updated
    })
  }

  const handleTopLevelTabNavigation = () => {
    setExpandedMenus([])
  }

  const getRoleDisplay = () => {
    if (!user) return ''

    switch (user.role) {
      case 'super_admin':
        return 'Super Admin'
      case 'admin':
        return 'Admin'
      case 'manager':
        return 'Manager'
      case 'teacher':
        return 'Teacher'
      default:
        return user.role
    }
  }

  const getTourTargetForHref = (href?: string) => {
    if (!href) return undefined
    const path = href.split('?')[0]
    if (path === '/user/truyenthong') return 'tour-nav-truyenthong'
    if (path === '/user/thong-tin-giao-vien') return 'tour-nav-thongtin'
    if (path === '/user/hoat-dong-hang-thang') return 'tour-nav-hoatdong'
    if (path === '/user/nhan-lop-1-buoi') return 'tour-nav-nhanlop'
    if (path === '/user/dao-tao-nang-cao') return 'tour-nav-training'
    if (path === '/user/assignments') return 'tour-nav-assignments'
    if (path === '/user/giaitrinh') return 'tour-nav-giaitrinh'
    if (path === '/user/quy-trinh-quy-dinh') return 'tour-nav-quytrinh'
    if (path === '/user/quan-ly-phan-hoi') return 'tour-nav-quanlyphanho'
    return undefined
  }

  return (
    <>
      {/* Mobile header: visible on pages, hidden while sidebar is open */}
      {!isOpen && (
        <div className="fixed left-0 right-0 top-0 z-sidebar-toggle lg:hidden">
          <div className="flex h-14 items-center justify-between border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <Link
              href={isUserArea ? '/user/truyenthong' : '/admin/truyenthong'}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Image
                src="/logo.svg"
                alt="MindX Technology School"
                width={92}
                height={40}
                className="h-7 w-auto"
                priority
              />
              <div className="flex flex-col justify-center leading-tight">
                <p className="text-sm font-bold tracking-wide text-[#2c2b2b]">
                  Teaching Portal System
                </p>
                <p className="text-[11px] font-medium text-[#6a6a6a]">
                  Quản Lý Giảng Dạy
                </p>
              </div>
            </Link>
            <button
              onClick={() => setIsOpen(true)}
              aria-label="Mở sidebar"
              className="rounded-md p-1.5 text-[#1f1f1f] transition-all duration-200 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2"
            >
              <Menu className="h-3 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-sidebar-overlay-custom bg-black/50 backdrop-blur-sm lg:hidden transition-all duration-300 ease-in-out animate-in fade-in-0"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Desktop toggle button when sidebar is collapsed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-3 left-3 z-sidebar-toggle hidden rounded-lg border border-gray-200 bg-white p-2 shadow-md transition-all duration-300 group animate-in fade-in-0 slide-in-from-left-2 hover:scale-105 hover:border-[#a1001f] hover:bg-[#a1001f] hover:text-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2 lg:block"
          aria-label="Mở sidebar"
        >
          <Menu className="h-4 w-4 transition-transform group-hover:rotate-180 duration-300" />
        </button>
      )}

      {/* Sidebar - Modern glass-morphism design */}
      <aside
        data-tour="tour-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-sidebar-custom h-dvh max-h-dvh overflow-hidden backdrop-blur-xl bg-white/95 border-r border-gray-200 shadow-xl w-56',
          'transition-all duration-500 ease-in-out will-change-transform',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ transform: `translate3d(${isOpen ? '0' : '-100%'}, 0, 0)` }}
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* Header - Solid brand header */}
          <div className="relative flex h-14 items-center justify-between bg-[#a1001f] px-4 text-white shadow-md py-2">
            <Link
              href={isUserArea ? '/user/truyenthong' : '/admin/truyenthong'}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                <Image
                  src="/x_white.svg"
                  alt="X White"
                  width={16}
                  height={16}
                  className="h-4 w-4"
                  priority
                />
              </div>
              <div className="flex flex-col justify-center leading-tight">
                <h2 className="text-sm font-bold tracking-wide">TPS</h2>
                <p className="text-[11px] text-white/80">Quản Lý Giảng Dạy</p>
              </div>
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 transition-all duration-300 hover:rotate-90 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#a1001f]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation - Modern cards with smooth hover effects */}
          <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1 pb-4 custom-scrollbar">
            {menuItems.map((item) => {
              const Icon = item.icon
              const hasSubmenu = 'submenu' in item
              const isExpanded = expandedMenus.includes(item.label)
              const isActive = !hasSubmenu && isPathMatch(item.href)
              const isSubmenuActive = hasSubmenu && isMenuItemActive(item)

              return (
                <div key={item.href || item.label} className="group">
                  {hasSubmenu ? (
                    <div className="space-y-1">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleSubmenu(item.label)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleSubmenu(item.label)
                          }
                        }}
                        aria-expanded={isExpanded}
                        className={cn(
                          'w-full flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold tracking-wide transition-all duration-300 group/item focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2',
                          isSubmenuActive
                            ? 'bg-[#a1001f] text-white shadow-md shadow-[#a1001f]/20 scale-[1.01]'
                            : isExpanded
                              ? 'bg-gray-100 text-gray-800 shadow-sm scale-[1.01]'
                              : 'text-gray-700 hover:bg-gray-100 hover:shadow-sm hover:scale-[1.01]',
                        )}
                      >
                        <div
                          className={cn(
                            'p-1.5 rounded-md transition-all duration-300',
                            isSubmenuActive
                              ? 'bg-white/20'
                              : isExpanded
                                ? 'bg-gray-100'
                                : 'bg-gray-100 group-hover/item:bg-white group-hover/item:shadow-sm',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        {item.href ? (
                          <Link
                            href={item.href}
                            data-tour={getTourTargetForHref(item.href)}
                            onClick={() => {
                              toggleSubmenu(item.label)
                              closeSidebarOnMobile()
                            }}
                            className="flex-1 text-left"
                          >
                            {toTitleCase(item.label)}
                          </Link>
                        ) : (
                          <span className="flex-1 text-left">
                            {toTitleCase(item.label)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSubmenu(item.label)
                          }}
                          className={cn(
                            'rounded-md p-1 transition-transform duration-300',
                            isSubmenuActive
                              ? 'hover:bg-white/20'
                              : 'hover:bg-gray-300/60',
                            isExpanded ? 'rotate-180' : '',
                          )}
                          aria-label={`Mở submenu ${toTitleCase(item.label)}`}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Submenu with slide animation */}
                      <div
                        className={cn(
                          'transition-all duration-300 ease-in-out',
                          isExpanded
                            ? 'max-h-[70vh] overflow-y-auto opacity-100 pr-1 custom-scrollbar'
                            : 'max-h-0 overflow-hidden opacity-0',
                        )}
                      >
                        <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 pl-2">
                          {item.submenu?.map((subItem: any) => {
                            const subHasSubmenu =
                              'submenu' in subItem &&
                              Array.isArray(subItem.submenu)
                            const isSubActive = isMenuItemActive(subItem)

                            if (subHasSubmenu) {
                              const isK12PolicyGroup =
                                subItem.label ===
                                'Quy Trình, Quy Định K12 Teaching'
                              const nestedItems = isK12PolicyGroup
                                ? (() => {
                                  const current = Array.isArray(
                                    subItem.submenu,
                                  )
                                    ? [...subItem.submenu]
                                    : []
                                  const hasManageItem = current.some(
                                    (entry: any) =>
                                      entry?.href === '/admin/page2/manage',
                                  )
                                  if (!hasManageItem) {
                                    current.push({
                                      href: '/admin/page2/manage',
                                      label: 'Quản Lý Tài Liệu',
                                    })
                                  }
                                    // Hide "Quản Lý Tài Liệu" for te/leader/tc roles
                                    const roleCodes = (user?.userRoles || []).map((code) =>
                                      normalizeRoleToken(code),
                                    )
                                    const hasRestrictedRole = roleCodes.some(
                                      (code) => code === 'te' || code === 'leader' || code === 'tc',
                                    )
                  
                                    if (hasRestrictedRole) {
                                      return current.filter(
                                        (item: any) => item?.href !== '/admin/page2/manage'
                                      )
                                    }
                  
                                    return current
                                })()
                                : subItem.submenu

                              return (
                                <div
                                  key={subItem.label}
                                  className="space-y-1 py-1"
                                >
                                  <div
                                    className={cn(
                                      'px-2 py-1 text-[11px] font-semibold tracking-wide text-gray-500',
                                      subItem.label !==
                                      'Kiểm Tra Chuyên Môn/Trải Nghiệm' &&
                                      'uppercase',
                                    )}
                                  >
                                    {toTitleCase(subItem.label)}
                                  </div>
                                  <div className="ml-2 space-y-0.5 border-l border-gray-200 pl-2">
                                    {nestedItems?.map((nestedItem: any) => {
                                      const isNestedActive = isPathMatch(
                                        nestedItem.href,
                                      )
                                      if (!nestedItem.href) return null

                                      return (
                                        <Link
                                          key={nestedItem.href}
                                          href={nestedItem.href}
                                          data-tour={getTourTargetForHref(
                                            nestedItem.href,
                                          )}
                                          onClick={closeSidebarOnMobile}
                                          className={cn(
                                            'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium tracking-wide transition-all duration-300 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-1',
                                            isNestedActive
                                              ? 'bg-[#a1001f]/10 text-[#a1001f] border-l-3 border-[#a1001f] shadow-sm'
                                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-l-3 hover:border-gray-300',
                                          )}
                                        >
                                          <span>
                                            {toTitleCase(nestedItem.label)}
                                          </span>
                                        </Link>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            }

                            if (!subItem.href) {
                              return null
                            }
                            return (
                              <Link
                                key={subItem.href}
                                href={subItem.href}
                                data-tour={getTourTargetForHref(subItem.href)}
                                onClick={closeSidebarOnMobile}
                                className={cn(
                                  'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium tracking-wide transition-all duration-300 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-1',
                                  isSubActive
                                    ? 'bg-[#a1001f]/15 text-[#a1001f] border-l-3 border-[#a1001f] shadow-sm ring-1 ring-[#a1001f]/20'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-l-3 hover:border-gray-300',
                                )}
                              >
                                <span>{toTitleCase(subItem.label)}</span>
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      data-tour={getTourTargetForHref(item.href)}
                      onClick={() => {
                        handleTopLevelTabNavigation()
                        closeSidebarOnMobile()
                      }}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold tracking-wide transition-all duration-300 group/item focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2',
                        isActive
                          ? 'bg-[#a1001f] text-white shadow-md shadow-[#a1001f]/20 scale-[1.01]'
                          : 'text-gray-700 hover:bg-gray-100 hover:shadow-sm hover:scale-[1.01]',
                      )}
                    >
                      <div
                        className={cn(
                          'p-1.5 rounded-md transition-all duration-300',
                          isActive
                            ? 'bg-white/20'
                            : 'bg-gray-100 group-hover/item:bg-white group-hover/item:shadow-sm',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span>{toTitleCase(item.label)}</span>
                    </Link>
                  )}
                </div>
              )
            })}
          </nav>

          {/* User Info and Logout - Modern card design */}
          {user && (
            <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <Link
                href={user.isAdmin ? '/admin/profile' : '/user/profile'}
                onClick={closeSidebarOnMobile}
                className={cn(
                  'mb-2 block cursor-pointer rounded-lg border p-2 shadow-sm transition-all duration-300 hover:scale-[1.01] hover:border-[#a1001f]/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2',
                  pathname === '/user/profile' || pathname === '/admin/profile'
                    ? 'bg-[#a1001f]/5 border-[#a1001f]'
                    : 'bg-white border-gray-100 hover:border-[#a1001f]/30',
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#a1001f] text-xs font-bold text-white shadow-md">
                    {user.displayName
                      ? user.displayName.charAt(0).toUpperCase()
                      : user.email
                        ? user.email.charAt(0).toUpperCase()
                        : ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 break-words leading-snug line-clamp-2">
                      {user.displayName || user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-500 break-all leading-snug line-clamp-2">
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-[#a1001f] px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>{getRoleDisplay()}</span>
                </div>
              </Link>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  closeSidebarOnMobile()
                  logout()
                }}
              >
                <Icon icon={LogOut} size="sm" />
                Đăng xuất
              </Button>
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
  )
}
