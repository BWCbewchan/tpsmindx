'use client'

import { useAuth } from '@/lib/auth-context'
import { filterManagementPermissions } from '@/lib/admin-permission-routes'
import { useSidebar } from '@/lib/sidebar-context'
import { getFilteredAdminMenuItems as getFilteredAdminMenuItemsUtil } from '@/lib/menu-permissions'
import { isTempHiddenUserRoute } from '@/lib/temp-hidden-user-routes'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  DollarSign,
  FileText,
  GraduationCap,
  Home,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  PanelBottom,
  Search,
  Settings,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/primitives/icon'
import { authHeaders } from '@/lib/auth-headers'
import useSWR from 'swr'
import NotificationBell from '@/components/NotificationBell'
import GlobalSearch from '@/components/GlobalSearch'

const NOTIFICATION_COUNT_REFRESH_MS = 180_000
const NOTIFICATION_DEDUPING_MS = 60_000

export function Sidebar() {
  const { isOpen, setIsOpen, requestExpandLabels, navMode, setNavMode } = useSidebar()
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const { user, token, logout } = useAuth()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || navigator.platform || ''
      setIsMac(/Mac|iPod|iPhone|iPad/.test(ua))
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isK = e.key === 'k' || e.key === 'K'
      const isShortcut = ((isMac ? e.metaKey : e.ctrlKey) || e.ctrlKey || e.metaKey) && isK
      if (isShortcut) {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMac])

  const fetcher = useMemo(
    () => (url: string) =>
      fetch(url, { headers: authHeaders(token) }).then((r) => r.json()),
    [token],
  )

  const { data: avatarData } = useSWR(
    user?.email ? '/api/teacher-avatar' : null,
    fetcher,
  )
  const avatarUrl = avatarData?.data?.avatar_url || null

  const { data: unreadData } = useSWR(
    user?.email ? '/api/notifications/unread-count' : null,
    fetcher,
    {
      refreshInterval: NOTIFICATION_COUNT_REFRESH_MS,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      revalidateOnFocus: true,
      dedupingInterval: NOTIFICATION_DEDUPING_MS,
    },
  )
  const unreadCount = unreadData?.count || 0

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

  const KNOWN_UPPERCASE_TOKENS = useMemo(
    () =>
      new Set([
        'TE',
        'TC',
        'HR',
        'TF',
        'GEN',
        'K12',
        'TPS',
        'GV',
        'HĐ',
        'QL',
        'BU',
        'S3',
      ]),
    [],
  )

  const toTitleCase = useCallback(
    (value?: string) => {
      if (!value) return ''

      return value
        .trim()
        .split(/\s+/)
        .map((word) => {
          if (!word) return word
          if (/^[A-Z0-9&()+/.-]+$/.test(word)) return word
          if (word.includes('/')) {
            return word
              .split('/')
              .map((part) => {
                const upperPart = part.toUpperCase()
                if (KNOWN_UPPERCASE_TOKENS.has(upperPart)) return upperPart
                if (/^[A-Z0-9&()+.-]+$/.test(part)) return part
                return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
              })
              .join('/')
          }
          const cleanUpper = word.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
          if (KNOWN_UPPERCASE_TOKENS.has(cleanUpper)) {
            return word.toUpperCase()
          }
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        })
        .join(' ')
    },
    [KNOWN_UPPERCASE_TOKENS],
  )

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
  const isCandidatePortalArea = pathname.startsWith('/candidate-portal')
  const isUserArea = pathname.startsWith('/user') || isCandidatePortalArea
  const trainingDocsBasePath = isCandidatePortalArea
    ? '/candidate-portal'
    : '/user'

  const adminMenuItems = [
    { href: '/admin/dashboard', label: 'Bảng Điều Khiển', icon: Home },
    { href: '/admin/thong-bao', label: 'Thông báo', icon: Bell },
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
          href: '/admin/hr-candidates',
          label: 'Thông tin ứng viên sau phỏng vấn',
        },
        {
          label: 'Sắp xếp GEN',
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
          href: '/admin/hr-candidates/training-calendar',
          label: 'Lịch đào tạo',
        },
        {
          href: '/admin/hr-onboarding/videos',
          label: 'Quản lý video đào tạo',
        },
        {
          href: '/admin/hr-candidates/input-assessment',
          label: 'Cấu hình bảng điểm',
        },
        {
          href: '/admin/hr-candidates/input-training-tests',
          label: 'Thư viện bài kiểm tra',
        },
        {
          href: '/admin/hr-candidates/pedagogy-training',
          label: 'Tập huấn sư phạm',
        },
      ],
    },
    {
      label: 'Quản lý Giáo viên & Vận hành',
      icon: Users,
      submenu: [
        { href: '/admin/page1', label: 'Hồ sơ Giáo viên' },
        {
          href: '/admin/quan-ly-qc',
          label: 'Quản Lý Kiểm Tra Chất Lượng',
          icon: ClipboardCheck,
        },
        { href: '/admin/check-cong', label: 'Kiểm tra công' },
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
            { href: '/admin/xu-ly-tinh-huong', label: 'Bộ tham khảo xử lý tình huống', rawLabel: 'Bộ tham khảo xử lý tình huống' },
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
      ],
    },
    {
      label: 'Tài liệu nội bộ',
      icon: BookOpen,
      submenu: [
        {
          label: 'Quy Trình, Quy Định K12 Teaching (Giáo Viên)',
          submenu: [
            { href: '/admin/page2', label: 'Xem Tài Liệu' },
            { href: '/admin/page2/manage', label: 'Quản Lý Tài Liệu' },
          ],
        },
        {
          label: 'Quy Trình, Quy Định K12 Teaching - Leader/TE/TC',
          submenu: [
            { href: '/admin/quy-trinh-quy-dinh-leader', label: 'Xem Tài Liệu' },
            { href: '/admin/quy-trinh-quy-dinh-leader/manage', label: 'Quản Lý Tài Liệu' },
          ],
        },
        {
          label: 'Tài Liệu Giảng Dạy',
          submenu: [
            { href: '/admin/giao-trinh-trai-nghiem', label: 'Giáo trình trải nghiệm' },
            { href: '/admin/giao-trinh-chuyen-mon', label: 'Giáo trình chuyên môn' },
            { href: '/admin/quan-ly-tai-lieu-giang-day', label: 'Quản lý giáo trình' },
          ],
        },
      ],
    },
    {
      href: '/admin/portfolio-qc',
      label: 'Quản lý nộp SPCK',
      icon: Sparkles,
    },
    {
      href: '/admin/portfolio',
      label: 'Quản lý Portfolio',
      icon: FileText,
    },
    {
      label: 'Cấu Hình Hệ Thống',
      icon: Settings,
      submenu: [
        { href: '/admin/user-management', label: 'Quản lý tài khoản' },
        { href: '/admin/quan-ly-be-mai', label: 'Quản lý bé Mai' },
        { href: '/admin/feedback', label: 'Feedback Manager' },
        {
          href: '/admin/feedback?source=datasource',
          label: 'Feedback Datasource Manager',
        },
        { href: '/admin/database', label: 'Database Manager' },
        { href: '/admin/cloudinary', label: 'Cloudinary Manager' },
        { href: '/admin/s3-supabase-manager', label: 'S3 Supabase Manager' },
        { href: '/admin/email-monitor', label: 'Giám sát Email', icon: Mail },
      ],
    },
    {
      href: '/admin/system-metrics',
      label: 'Quản lý chỉ số hệ thống',
      icon: BarChart3,
    },
  ]

  const roleCodes = useMemo(
    () => (user?.userRoles || []).map((code) => normalizeRoleToken(code)),
    [user?.userRoles],
  )
  const hasManagementRole = useMemo(
    () =>
      ['manager', 'admin', 'super_admin'].includes(
        normalizeRoleToken(user?.role),
      ) ||
      roleCodes.some((code) =>
        ['leader', 'te', 'tc', 'manager', 'admin', 'super_admin'].includes(
          code,
        ),
      ),
    [user?.role, roleCodes],
  )

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
    { href: '/user/thong-bao', label: 'Thông báo', icon: Bell },
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
        ...(hasManagementRole
          ? [
              {
                href: '/user/quy-trinh-quy-dinh-leader',
                label: 'Quy Trình, Quy Định - Leader/TE/TC',
              },
            ]
          : []),
        { href: '/user/xu-ly-tinh-huong', label: 'Bộ tham khảo xử lý tình huống', rawLabel: 'Bộ tham khảo xử lý tình huống' },
        {
          label: 'Giáo trình',
          submenu: [
            {
              href: `${trainingDocsBasePath}/giao-trinh-trai-nghiem`,
              label: 'Giáo trình trải nghiệm',
            },
            {
              href: `${trainingDocsBasePath}/giao-trinh-chuyen-mon`,
              label: 'Giáo trình chuyên môn',
            },
          ],
        },
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
    return getFilteredAdminMenuItemsUtil(adminMenuItems, user, pathname)
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

  const profileHref = isUserArea ? '/user/profile' : user?.isAdmin ? '/admin/profile' : '/user/profile'
  const canSwitchToManagement = Boolean(user?.isAdmin) && isUserArea
  const canSwitchToTeacher = Boolean(user?.isAdmin) && !isUserArea

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
    if (path === '/user/quy-trinh-quy-dinh-leader' || path === '/admin/quy-trinh-quy-dinh-leader') return 'tour-nav-quytrinh-leader'
    if (path === '/user/quan-ly-phan-hoi') return 'tour-nav-quanlyphanho'
    return undefined
  }

  return (
    <>
      {/* Mobile header: visible on pages, hidden while sidebar is open */}
      {!isOpen && navMode === 'sidebar' && (
        <div className="fixed left-0 right-0 top-0 z-sidebar-toggle lg:hidden">
          <div className="flex h-14 items-center justify-between border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <Link
              href={isUserArea ? '/user/truyenthong' : '/admin/truyenthong'}
              prefetch={false}
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
            <div className="flex items-center gap-3">
              <NotificationBell className="notification-bell-inline" />
              <button
                onClick={() => setIsOpen(true)}
                aria-label="Mở sidebar"
                className="rounded-md p-1.5 text-[#1f1f1f] transition-all duration-200 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2"
              >
                <Menu className="h-3 w-5" />
              </button>
            </div>
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

      {/* Desktop control buttons when sidebar is collapsed */}
      {!isOpen && navMode === 'sidebar' && (
        <div className="fixed top-3 left-3 z-sidebar-toggle hidden items-center gap-2 lg:flex animate-in fade-in-0 slide-in-from-left-2">
          <button
            onClick={() => setIsOpen(true)}
            className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-md transition-all duration-300 group hover:scale-105 hover:border-[#a1001f] hover:bg-[#a1001f] hover:text-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2"
            aria-label="Mở sidebar"
          >
            <Menu className="h-4 w-4 transition-transform group-hover:rotate-180 duration-300" />
          </button>

          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label={`Tìm kiếm (${isMac ? '⌘K' : 'Ctrl+K'})`}
            className="group/icon relative flex items-center justify-center rounded-[10px] transition-all duration-150 ease-out bg-black/[0.06] text-[#1d1d1f] hover:bg-[#a1001f] hover:text-white active:scale-[0.93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2 shadow-md border border-gray-200/50"
            style={{ width: '37px', height: '37px' }}
          >
            <Search className="h-4 w-4" />
            <span className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 z-[60] hidden sm:block whitespace-nowrap rounded-lg bg-[#1d1d1f]/90 px-2.5 py-1.5 text-white text-[12px] font-medium shadow-lg opacity-0 transition-opacity duration-100 group-hover/icon:opacity-100">
              Tìm kiếm&nbsp;<span className="opacity-50 text-[11px]">{isMac ? '⌘K' : 'Ctrl+K'}</span>
              <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#1d1d1f]/90" />
            </span>
          </button>
        </div>
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
              prefetch={false}
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
            {/* Prominent Search box on Sidebar */}
            <div className="pb-2">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2"
                aria-label="Tìm kiếm"
              >
                <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="flex-1 text-xs text-gray-500 font-medium">Tìm kiếm...</span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-gray-200 text-[10px] text-gray-400 font-mono leading-none">
                  {isMac ? '⌘K' : 'Ctrl+K'}
                </kbd>
              </button>
            </div>

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
                            prefetch={false}
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
                              const isK12PolicyTeacher =
                                subItem.label === 'Quy Trình, Quy Định K12 Teaching' ||
                                subItem.label === 'Quy Trình, Quy Định K12 Teaching (Giáo Viên)'
                              const isK12PolicyLeader =
                                subItem.label === 'Quy Trình, Quy Định K12 Teaching - Leader/TE/TC'

                              const nestedItems = isK12PolicyTeacher
                                ? (() => {
                                  const current = Array.isArray(subItem.submenu) ? [...subItem.submenu] : []
                                  const hasManageItem = current.some((entry: any) => entry?.href === '/admin/page2/manage')
                                  if (!hasManageItem) {
                                    current.push({ href: '/admin/page2/manage', label: 'Quản Lý Tài Liệu' })
                                  }
                                  const roleCodes = (user?.userRoles || []).map((code) => normalizeRoleToken(code))
                                  const hasRestrictedRole = roleCodes.some((code) => code === 'te' || code === 'leader' || code === 'tc')
                                  if (hasRestrictedRole) {
                                    return current.filter((item: any) => item?.href !== '/admin/page2/manage')
                                  }
                                  return current
                                })()
                                : isK12PolicyLeader
                                ? (() => {
                                  const current = Array.isArray(subItem.submenu) ? [...subItem.submenu] : []
                                  const hasManageItem = current.some((entry: any) => entry?.href === '/admin/quy-trinh-quy-dinh-leader/manage')
                                  if (!hasManageItem) {
                                    current.push({ href: '/admin/quy-trinh-quy-dinh-leader/manage', label: 'Quản Lý Tài Liệu' })
                                  }
                                  const roleCodes = (user?.userRoles || []).map((code) => normalizeRoleToken(code))
                                  const hasRestrictedRole = roleCodes.some((code) => code === 'te' || code === 'leader' || code === 'tc')
                                  if (hasRestrictedRole) {
                                    return current.filter((item: any) => item?.href !== '/admin/quy-trinh-quy-dinh-leader/manage')
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
                                          prefetch={false}
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
                                            {nestedItem.rawLabel ?? toTitleCase(nestedItem.label)}
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
                                prefetch={false}
                                data-tour={getTourTargetForHref(subItem.href)}
                                onClick={closeSidebarOnMobile}
                                className={cn(
                                  'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium tracking-wide transition-all duration-300 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-1',
                                  isSubActive
                                    ? 'bg-[#a1001f]/15 text-[#a1001f] border-l-3 border-[#a1001f] shadow-sm ring-1 ring-[#a1001f]/20'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-l-3 hover:border-gray-300',
                                )}
                              >
                                <span>{subItem.rawLabel ?? toTitleCase(subItem.label)}</span>
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      prefetch={false}
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
                      {item.label === 'Thông báo' && unreadCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white leading-none">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  )}
                </div>
              )
            })}
          </nav>

          {/* User Info and Logout - Modern card design */}
          {user && (
            <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              {canSwitchToManagement && (
                <Button
                  asChild
                  variant="mindx"
                  size="sm"
                  className="mb-2 w-full justify-start text-xs"
                >
                  <Link href="/admin/dashboard" prefetch={false} onClick={closeSidebarOnMobile}>
                    <Icon icon={BarChart3} size="sm" />
                    Chuyển sang quản lý
                  </Link>
                </Button>
              )}
              {canSwitchToTeacher && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mb-2 w-full justify-start border-[#a1001f]/30 text-xs text-[#a1001f] hover:bg-[#a1001f]/5 hover:text-[#a1001f]"
                >
                  <Link href="/user/truyenthong" prefetch={false} onClick={closeSidebarOnMobile}>
                    <Icon icon={GraduationCap} size="sm" />
                    Chuyển sang giáo viên
                  </Link>
                </Button>
              )}
              <Link
                href={profileHref}
                prefetch={false}
                onClick={closeSidebarOnMobile}
                className={cn(
                  'mb-2 block cursor-pointer rounded-lg border p-2 shadow-sm transition-all duration-300 hover:scale-[1.01] hover:border-[#a1001f]/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2',
                  pathname === profileHref
                    ? 'bg-[#a1001f]/5 border-[#a1001f]'
                    : 'bg-white border-gray-100 hover:border-[#a1001f]/30',
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#a1001f] text-xs font-bold text-white shadow-md overflow-hidden">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>
                        {user.displayName
                          ? user.displayName.charAt(0).toUpperCase()
                          : user.email
                            ? user.email.charAt(0).toUpperCase()
                            : ''}
                      </span>
                    )}
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

              {/* Switch to Dock mode */}
              <Button
                variant="outline"
                size="sm"
                className="mb-2 w-full justify-start text-xs border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                onClick={() => {
                  setNavMode('dock')
                  closeSidebarOnMobile()
                }}
              >
                <PanelBottom className="h-3.5 w-3.5 mr-1" />
                Chuyển sang Dock
              </Button>

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

      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  )
}
