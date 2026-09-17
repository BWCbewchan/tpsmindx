'use client'

import { useAuth } from '@/lib/auth-context'
import { useSidebar } from '@/lib/sidebar-context'
import { isTempHiddenUserRoute } from '@/lib/temp-hidden-user-routes'
import { getFilteredAdminMenuItems, checkHrefPermission } from '@/lib/menu-permissions'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Home,
  LogOut,
  Megaphone,
  PanelLeft,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import GlobalSearch from '@/components/GlobalSearch'
import useSWR from 'swr'
import { authHeaders } from '@/lib/auth-headers'

const NOTIFICATION_COUNT_REFRESH_MS = 180_000
const NOTIFICATION_DEDUPING_MS = 60_000

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubItem {
  href: string
  label: string
  badge?: number
}

interface SubGroup {
  groupLabel: string
  items: SubItem[]
}

type SubmenuContent = SubItem[] | SubGroup[]

interface NavDockItem {
  id: string
  label: string
  icon: React.ElementType
  href?: string
  submenu?: SubmenuContent
  badge?: number
}

function isGrouped(c: SubmenuContent): c is SubGroup[] {
  return c.length > 0 && 'groupLabel' in c[0]
}

// ─── Flyup panel ─────────────────────────────────────────────────────────────
//
// Uses `absolute bottom-full left-1/2 -translate-x-1/2` so it always centres
// above its parent dock-button.  After mount it clamps itself inside the
// viewport (with 8 px margin) and shifts the caret accordingly so it still
// points at the icon.

interface FlyupPanelProps {
  title: string
  content: SubmenuContent
  iconSize: number        // px – passed so we know where the arrow tip lives
  onClose: () => void
  isNavActive: (href?: string) => boolean
  alignX?: number | null
}

function FlyupPanel({ title, content, iconSize, onClose, isNavActive, alignX }: FlyupPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // translateX offset applied on top of the base -50% centering
  const [shiftX, setShiftX] = useState(0)

  // After mount/alignX change, check if the panel overflows the viewport and clamp it
  useEffect(() => {
    if (!panelRef.current) return
    const MARGIN = 8
    const rect = panelRef.current.getBoundingClientRect()
    if (rect.left < MARGIN) {
      setShiftX(MARGIN - rect.left)
    } else if (rect.right > window.innerWidth - MARGIN) {
      setShiftX(window.innerWidth - MARGIN - rect.right)
    }
  }, [alignX])

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const renderItems = (items: SubItem[]) =>
    items.map((sub) => {
      const active = isNavActive(sub.href)
      return (
        <Link
          key={sub.href}
          href={sub.href}
          prefetch={false}
          onClick={onClose}
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-[9px] text-[13px] font-medium transition-colors duration-100',
            active
              ? 'bg-[#a1001f]/10 text-[#a1001f]'
              : 'text-[#1d1d1f] hover:bg-black/[0.06]',
          )}
        >
          {active
            ? <Check className="h-3 w-3 shrink-0 text-[#a1001f]" />
            : <span className="h-3 w-3 shrink-0" />}
          <span className="flex-1 leading-snug">{sub.label}</span>
          {sub.badge != null && sub.badge > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {sub.badge > 99 ? '99+' : sub.badge}
            </span>
          )}
        </Link>
      )
    })

  // The caret position compensates for the viewport clamp shift so it still
  // points at the dock icon beneath it.
  const caretLeft = `calc(50% - ${shiftX}px)`

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full z-50 w-max min-w-[190px] max-w-[min(260px,calc(100vw-16px))]"
      style={{
        left: alignX != null ? alignX : '50%',
        transform: `translateX(calc(-50% + ${shiftX}px))`,
        // bottom: full height of icon + gap
        marginBottom: '10px',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Frosted-glass macOS card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pl-4 pr-2 py-2.5 border-b border-black/[0.06]">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest select-none">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-black/[0.07] transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Body */}
        <div className="p-1.5 max-h-[55vh] overflow-y-auto overscroll-contain custom-scrollbar">
          {isGrouped(content) ? (
            content.map((group, gi) => (
              <div key={group.groupLabel} className={gi > 0 ? 'mt-1' : ''}>
                {gi > 0 && <div className="mx-2 my-1 h-px bg-black/[0.06]" />}
                <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 select-none">
                  {group.groupLabel}
                </div>
                <div>{renderItems(group.items)}</div>
              </div>
            ))
          ) : (
            <div>{renderItems(content as SubItem[])}</div>
          )}
        </div>
      </div>

      {/* Downward caret — shifts opposite to panel clamp so it still points at
          the icon.  `shiftX` moves panel right → caret moves left by same amount. */}
      <div className="absolute w-full" style={{ bottom: -6 }}>
        <div
          className="absolute h-3 w-3 rotate-45 border-r border-b border-black/[0.08]"
          style={{
            left: caretLeft,
            transform: 'translateX(-50%) rotate(45deg)',
            background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(40px)',
          }}
        />
      </div>
    </div>
  )
}

// ─── Individual dock button ───────────────────────────────────────────────────

interface DockButtonProps {
  item: NavDockItem
  isActive: boolean
  isOpen: boolean
  iconSize: number
  onToggle: (e: React.MouseEvent) => void
  isNavActive: (href?: string) => boolean
}

function DockButton({ item, isActive, isOpen, iconSize, onToggle, isNavActive }: DockButtonProps) {
  const Icon = item.icon
  const hasSubmenu = Boolean(item.submenu)
  const iconPx = iconSize

  const btnCls = cn(
    'group/icon relative flex items-center justify-center rounded-[14px] transition-all duration-150 ease-out select-none',
    'hover:scale-[1.15] active:scale-[0.93]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2',
    (isActive || isOpen)
      ? 'bg-[#a1001f] text-white shadow-lg shadow-[#a1001f]/40'
      : 'bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.10]',
  )

  const iconSizeCls = iconPx <= 34 ? 'h-[17px] w-[17px]' : iconPx <= 38 ? 'h-[19px] w-[19px]' : iconPx <= 42 ? 'h-5 w-5' : 'h-[22px] w-[22px]'

  const badge = item.badge != null && item.badge > 0 && (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none shadow-sm z-10">
      {item.badge > 99 ? '99+' : item.badge}
    </span>
  )

  // Tooltip — hidden on very small screens to save space
  const tooltip = (
    <span
      className={cn(
        'pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-[60]',
        'hidden sm:block', // only on sm+
        'whitespace-nowrap rounded-lg bg-[#1d1d1f]/90 px-2.5 py-1.5 text-white text-[12px] font-medium shadow-lg',
        'opacity-0 transition-opacity duration-100 group-hover/icon:opacity-100',
        isOpen && 'opacity-0',
      )}
    >
      {item.label}
      <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#1d1d1f]/90" />
    </span>
  )

  return (
    <div className="relative flex flex-col items-center snap-center shrink-0">

      {hasSubmenu ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={item.label}
          aria-expanded={isOpen}
          className={btnCls}
          style={{ width: iconPx, height: iconPx }}
        >
          <Icon className={iconSizeCls} aria-hidden />
          {badge}
          {tooltip}
        </button>
      ) : (
        <Link
          href={item.href!}
          prefetch={false}
          aria-label={item.label}
          className={btnCls}
          style={{ width: iconPx, height: iconPx }}
        >
          <Icon className={iconSizeCls} aria-hidden />
          {badge}
          {tooltip}
        </Link>
      )}

      {/* Open indicator dot */}
      {isOpen && (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#a1001f]" />
      )}
    </div>
  )
}

// ─── Main DockNav ─────────────────────────────────────────────────────────────

export function DockNav() {
  const { user, token, logout } = useAuth()
  const { setNavMode } = useSidebar()
  const pathname = usePathname()

  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [activeAlignX, setActiveAlignX] = useState<number | null>(null)
  const [isDockMinimized, setIsDockMinimized] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dock_minimized') === 'true'
    }
    return false
  })
  const [showSettings, setShowSettings] = useState(false)
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    localStorage.setItem('dock_minimized', String(isDockMinimized))
    if (isDockMinimized) {
      setOpenItemId(null)
      setActiveAlignX(null)
      setShowSettings(false)
    }
  }, [isDockMinimized])
  // Track viewport width to pick mobile vs desktop item sets
  const [vw, setVw] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  )

  const dockRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current)
    const deltaY = e.touches[0].clientY - touchStartY.current

    // Minimize: Swipe down by 45px and vertical movement is primary
    if (deltaY > 45 && deltaY > deltaX * 1.5) {
      setIsDockMinimized(true)
      touchStartX.current = null
      touchStartY.current = null
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    touchStartX.current = null
    touchStartY.current = null
  }, [])

  const handleRestoreTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const deltaY = e.touches[0].clientY - touchStartY.current
    // Restore: Swipe up by 30px
    if (deltaY < -30) {
      setIsDockMinimized(false)
      touchStartY.current = null
    }
  }, [])

  const isUserArea = pathname.startsWith('/user') || pathname.startsWith('/candidate-portal')

  useEffect(() => {
    setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.userAgent || ''))
  }, [])

  // Viewport width tracker (debounced)
  useEffect(() => {
    let raf: number
    const h = () => { raf = requestAnimationFrame(() => setVw(window.innerWidth)) }
    window.addEventListener('resize', h, { passive: true })
    return () => { window.removeEventListener('resize', h); cancelAnimationFrame(raf) }
  }, [])

  // Close menus on viewport resize
  useEffect(() => {
    setOpenItemId(null)
    setActiveAlignX(null)
    setShowSettings(false)
  }, [vw])

  // Mobile breakpoint: < 640px (Tailwind `sm`)
  const isMobile = vw < 640

  // Dynamic icon size based on viewport width to prevent overflow
  const iconSize = useMemo(() => {
    if (vw >= 640) return 46
    if (vw < 385) return 33
    if (vw < 430) return 36
    return 38
  }, [vw])

  // Dynamic gap between icons
  const dockGap = useMemo(() => {
    if (vw >= 640) return 6
    if (vw < 385) return 2
    if (vw < 430) return 3
    return 4
  }, [vw])

  // Close everything on route change
  useEffect(() => {
    setOpenItemId(null)
    setActiveAlignX(null)
    setShowSettings(false)
  }, [pathname])

  // Ctrl+K / ⌘K
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setIsSearchOpen(p => !p)
        setOpenItemId(null)
        setActiveAlignX(null)
        setShowSettings(false)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Outside click → close
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setOpenItemId(null)
        setActiveAlignX(null)
        setShowSettings(false)
      }
    }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [])

  // SWR
  const fetcher = useMemo(
    () => (url: string) => fetch(url, { headers: authHeaders(token) }).then(r => r.json()),
    [token],
  )
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
  const { data: avatarData } = useSWR(user?.email ? '/api/teacher-avatar' : null, fetcher)
  const avatarUrl = avatarData?.data?.avatar_url || null

  const isNavActive = useCallback((href?: string) => {
    if (!href) return false
    const [path] = href.split('?')
    return pathname === path || pathname.startsWith(`${path}/`)
  }, [pathname])

  const isItemGroupActive = useCallback((item: NavDockItem) => {
    if (item.href) return isNavActive(item.href)
    if (!item.submenu) return false
    if (isGrouped(item.submenu)) return item.submenu.some(g => g.items.some(s => isNavActive(s.href)))
    return (item.submenu as SubItem[]).some(s => isNavActive(s.href))
  }, [isNavActive])

  const toggleItem = useCallback((id: string, e?: React.MouseEvent) => {
    if (openItemId === id) {
      setOpenItemId(null)
      setActiveAlignX(null)
    } else {
      if (e && dockRef.current) {
        const btn = e.currentTarget as HTMLElement
        const dockRect = dockRef.current.getBoundingClientRect()
        const btnRect = btn.getBoundingClientRect()
        // Horizontal center of the clicked button relative to the dock container
        const offset = btnRect.left - dockRect.left + btnRect.width / 2
        setActiveAlignX(offset)
      } else {
        setActiveAlignX(null)
      }
      setOpenItemId(id)
    }
    setShowSettings(false)
  }, [openItemId])

  const profileHref = isUserArea ? '/user/profile' : user?.isAdmin ? '/admin/profile' : '/user/profile'

  // ── Item definitions ─────────────────────────────────────────────────────

  const roleCodes = useMemo(
    () => (user?.userRoles || []).map((code: string) => String(code).trim().toLowerCase().replace(/[\s-]+/g, '_')),
    [user?.userRoles],
  )
  const hasManagementRole = useMemo(
    () =>
      ['manager', 'admin', 'super_admin'].includes(
        String(user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_'),
      ) ||
      roleCodes.some((code: string) =>
        ['leader', 'te', 'tc', 'manager', 'admin', 'super_admin'].includes(
          code,
        ),
      ),
    [user?.role, roleCodes],
  )

  // ── User area ── 8 desktop items  /  5 mobile items
  const userDesktopItems: NavDockItem[] = useMemo(() => [
    { id: 'truyenthong', label: 'Truyền thông', icon: Megaphone, href: '/user/truyenthong' },
    { id: 'thongtin',    label: 'Thông tin tôi', icon: Home,      href: '/user/thong-tin-giao-vien' },
    {
      id: 'checkout',
      label: 'Vận hành',
      icon: ClipboardCheck,
      submenu: [
        {
          groupLabel: 'Phiếu kết quả trải nghiệm',
          items: [
            { href: '/user/checkout/create', label: 'Tạo phiếu' },
            { href: '/user/checkout/manage', label: 'Quản lý phiếu đã tạo' },
          ],
        },
      ] as SubGroup[],
    },
    { id: 'thongbao',   label: 'Thông báo',     icon: Bell,      href: '/user/thong-bao', badge: unreadCount },
    {
      id: 'lichhd', label: 'Lịch & HĐ', icon: CalendarDays,
      submenu: ([
        { href: '/user/hoat-dong-hang-thang', label: 'Hoạt động hàng tháng' },
        { href: '/user/lich-cua-toi', label: 'Lịch cá nhân' },
      ] as SubItem[]).filter(i => !isTempHiddenUserRoute(i.href)),
    },
    {
      id: 'daotao', label: 'Đào tạo', icon: GraduationCap,
      submenu: [
        { href: '/user/dao-tao-nang-cao', label: 'Đào tạo nâng cao' },
        { href: '/user/assignments', label: 'Quản lý kiểm tra' },
        { href: '/user/giaitrinh', label: 'Giải trình điểm kiểm tra' },
      ] as SubItem[],
    },
    {
      id: 'tailieu', label: 'Tài liệu', icon: BookOpen,
      submenu: [
        { href: '/user/quy-trinh-quy-dinh', label: 'Quy trình & Quy định' },
        ...(hasManagementRole
          ? [{ href: '/user/quy-trinh-quy-dinh-leader', label: 'Quy Trình, Quy Định - Leader/TE/TC' }]
          : []),
        { href: '/user/giao-trinh-trai-nghiem', label: 'Giáo trình trải nghiệm' },
        { href: '/user/giao-trinh-chuyen-mon', label: 'Giáo trình chuyên môn' },
      ] as SubItem[],
    },
    { id: 'phanhoi', label: 'Phản hồi', icon: FileText, href: '/user/quan-ly-phan-hoi' },
  ], [unreadCount, hasManagementRole])

  // Mobile: 5 core items (drop Lịch and Phản hồi — go in settings)
  const userMobileItems: NavDockItem[] = useMemo(() => [
    { id: 'truyenthong', label: 'Truyền thông', icon: Megaphone, href: '/user/truyenthong' },
    { id: 'thongbao',   label: 'Thông báo',     icon: Bell,      href: '/user/thong-bao', badge: unreadCount },
    {
      id: 'daotao', label: 'Đào tạo', icon: GraduationCap,
      submenu: [
        { href: '/user/dao-tao-nang-cao', label: 'Đào tạo nâng cao' },
        { href: '/user/assignments', label: 'Quản lý kiểm tra' },
        { href: '/user/giaitrinh', label: 'Giải trình điểm kiểm tra' },
      ] as SubItem[],
    },
    {
      id: 'tailieu', label: 'Tài liệu', icon: BookOpen,
      submenu: [
        { href: '/user/quy-trinh-quy-dinh', label: 'Quy trình & Quy định' },
        ...(hasManagementRole
          ? [{ href: '/user/quy-trinh-quy-dinh-leader', label: 'Quy Trình, Quy Định - Leader/TE/TC' }]
          : []),
        { href: '/user/giao-trinh-trai-nghiem', label: 'Giáo trình trải nghiệm' },
        { href: '/user/giao-trinh-chuyen-mon', label: 'Giáo trình chuyên môn' },
      ] as SubItem[],
    },
    { id: 'thongtin', label: 'Thông tin', icon: Home, href: '/user/thong-tin-giao-vien' },
  ], [unreadCount, hasManagementRole])

  // ── Admin area ── 6 desktop / 4 mobile
  const rawAdminDesktopItems: NavDockItem[] = useMemo(() => [
    { id: 'dashboard',   label: 'Dashboard',     icon: Home,     href: '/admin/dashboard' },
    { id: 'thongbao',   label: 'Thông báo',      icon: Bell,     href: '/admin/thong-bao', badge: unreadCount },
    { id: 'truyenthong',label: 'Truyền thông',   icon: Megaphone,href: '/admin/truyenthong' },
    {
      id: 'giaovien', label: 'Giáo viên', icon: Users,
      submenu: [
        { href: '/admin/page1', label: 'Hồ sơ Giáo viên' },
        { href: '/admin/quan-ly-qc', label: 'Quản Lý Kiểm Tra Chất Lượng' },
        { href: '/admin/page4/quan-ly-lich-lam-viec', label: 'Quản lý lịch làm việc' },
        { href: '/admin/page4/lich-danh-gia', label: 'Lịch sự kiện' },
        { href: '/admin/xin-nghi-mot-buoi', label: 'Tiếp nhận xin nghỉ 1 buổi' },
        { href: '/admin/deal-luong?type=salary_deal', label: 'Thỏa thuận lương' },
        { href: '/admin/deal-luong?type=salary_reduction', label: 'Hạ lương' },
        { href: '/admin/deal-luong?type=bonus', label: 'Nâng lương' },
      ] as SubItem[],
    },
    {
      id: 'hocvien', label: 'Học viên', icon: FileText,
      submenu: [
        { href: '/admin/kiem-soat-spck', label: 'Kiểm soát Sản phẩm cuối khóa' },
        { href: '/admin/portfolio', label: 'Quản lý Portfolio' },
      ] as SubItem[],
    },
    {
      id: 'daotao', label: 'Đào tạo', icon: GraduationCap,
      submenu: [
        { groupLabel: 'Đào Tạo Nâng Cao', items: [
          { href: '/admin/page5', label: 'Thư viện video nâng cao' },
          { href: '/admin/assignments', label: 'Thư viện đề nâng cao' },
          { href: '/admin/training-dashboard', label: 'Thống kê' },
        ]},
        { groupLabel: 'Kiểm Tra Chuyên Môn', items: [
          { href: '/admin/page4/danh-sach-dang-ky', label: 'Danh sách GV đăng ký' },
          { href: '/admin/giaitrinh', label: 'Quản lý Giải trình' },
          { href: '/admin/thu-vien-de', label: 'Thư viện đề chuyên môn' },
        ]},
      ] as SubGroup[],
    },
    {
      id: 'tailieu', label: 'Tài liệu', icon: BookOpen,
      submenu: [
        { groupLabel: 'Quy Trình K12 (Giáo Viên)', items: [
          { href: '/admin/page2', label: 'Xem Tài Liệu' },
          { href: '/admin/page2/manage', label: 'Quản Lý Tài Liệu' },
        ]},
        { groupLabel: 'Quy Trình K12 (Leader/TE/TC)', items: [
          { href: '/admin/quy-trinh-quy-dinh-leader', label: 'Xem Tài Liệu' },
          { href: '/admin/quy-trinh-quy-dinh-leader/manage', label: 'Quản Lý Tài Liệu' },
        ]},
        { groupLabel: 'Tài Liệu Giảng Dạy', items: [
          { href: '/admin/giao-trinh-trai-nghiem', label: 'Giáo trình trải nghiệm' },
          { href: '/admin/giao-trinh-chuyen-mon', label: 'Giáo trình chuyên môn' },
        ]},
      ] as SubGroup[],
    },
    {
      id: 'hethong', label: 'Hệ thống', icon: BarChart3,
      submenu: [
        { href: '/admin/user-management', label: 'Quản lý tài khoản' },
        { href: '/admin/quan-ly-be-mai', label: 'Quản lý bé Mai' },
        { href: '/admin/database', label: 'Database Manager' },
        { href: '/admin/cloudinary', label: 'Cloudinary Manager' },
        { href: '/admin/email-monitor', label: 'Giám sát Email' },
        { href: '/admin/system-metrics', label: 'Chỉ số hệ thống' },
        { href: '/admin/feedback', label: 'Feedback Manager' },
      ] as SubItem[],
    },
  ], [unreadCount])

  const adminDesktopItems = useMemo(() => {
    return getFilteredAdminMenuItems(rawAdminDesktopItems, user, pathname)
  }, [rawAdminDesktopItems, user, pathname])

  // Admin mobile: 4 core items
  const rawAdminMobileItems: NavDockItem[] = useMemo(() => [
    { id: 'dashboard',  label: 'Dashboard',  icon: Home,         href: '/admin/dashboard' },
    { id: 'thongbao',  label: 'Thông báo',   icon: Bell,         href: '/admin/thong-bao', badge: unreadCount },
    {
      id: 'giaovien', label: 'Giáo viên', icon: Users,
      submenu: [
        { href: '/admin/page1', label: 'Hồ sơ Giáo viên' },
        { href: '/admin/quan-ly-qc', label: 'Quản lý QC' },
        { href: '/admin/page4/quan-ly-lich-lam-viec', label: 'Lịch làm việc' },
        { href: '/admin/xin-nghi-mot-buoi', label: 'Tiếp nhận xin nghỉ' },
        { href: '/admin/deal-luong?type=salary_deal', label: 'Thỏa thuận lương' },
      ] as SubItem[],
    },
    {
      id: 'hocvien', label: 'Học viên', icon: FileText,
      submenu: [
        { href: '/admin/kiem-soat-spck', label: 'Kiểm soát Sản phẩm cuối khóa' },
        { href: '/admin/portfolio', label: 'Quản lý Portfolio' },
      ] as SubItem[],
    },
    {
      id: 'daotao', label: 'Đào tạo', icon: GraduationCap,
      submenu: [
        { href: '/admin/page5', label: 'Thư viện video nâng cao' },
        { href: '/admin/assignments', label: 'Thư viện đề nâng cao' },
        { href: '/admin/training-dashboard', label: 'Thống kê' },
        { href: '/admin/giaitrinh', label: 'Quản lý Giải trình' },
      ] as SubItem[],
    },
  ], [unreadCount])

  const adminMobileItems = useMemo(() => {
    return getFilteredAdminMenuItems(rawAdminMobileItems, user, pathname)
  }, [rawAdminMobileItems, user, pathname])

  const dockItems = isUserArea ? userDesktopItems : adminDesktopItems

  const openItem = useMemo(() => {
    if (!openItemId) return null
    return dockItems.find(item => item.id === openItemId)
  }, [openItemId, dockItems])

  // ─ Settings panel items for mobile "more" section ─────────────────────────
  // Items hidden on mobile but accessible via Settings → "Thêm tính năng"
  const mobileExtraUserItems: SubItem[] = [
    { href: '/user/thong-tin-giao-vien', label: 'Thông tin của tôi' },
    { href: '/user/checkout/create', label: 'Phiếu kết quả trải nghiệm - Tạo phiếu' },
    { href: '/user/checkout/manage', label: 'Phiếu kết quả trải nghiệm - Quản lý phiếu' },
    { href: '/user/hoat-dong-hang-thang', label: 'Hoạt động hàng tháng' },
    { href: '/user/lich-cua-toi', label: 'Lịch cá nhân' },
    { href: '/user/quan-ly-phan-hoi', label: 'Trung tâm phản hồi' },
    ...(hasManagementRole
      ? [{ href: '/user/quy-trinh-quy-dinh-leader', label: 'Quy Trình, Quy Định - Leader/TE/TC' }]
      : []),
  ].filter(i => !isTempHiddenUserRoute(i.href))

  const mobileExtraAdminItems: SubItem[] = [
    { href: '/admin/truyenthong', label: 'Quản lý Truyền thông' },
    // Giáo viên extra
    { href: '/admin/quan-ly-qc', label: 'Quản Lý Kiểm Tra Chất Lượng' },
    { href: '/admin/page4/lich-danh-gia', label: 'Lịch sự kiện' },
    { href: '/admin/deal-luong?type=salary_reduction', label: 'Hạ lương' },
    { href: '/admin/deal-luong?type=bonus', label: 'Nâng lương' },
    // Học viên
    { href: '/admin/kiem-soat-spck', label: 'Kiểm soát Sản phẩm cuối khóa' },
    { href: '/admin/portfolio', label: 'Quản lý Portfolio' },
    // Đào tạo extra
    { href: '/admin/page4/danh-sach-dang-ky', label: 'Danh sách Giáo viên đăng ký' },
    { href: '/admin/thu-vien-de', label: 'Thư viện đề chuyên môn' },
    // Tài liệu K12 & Giáo trình
    { href: '/admin/page2', label: 'Xem Tài Liệu K12' },
    { href: '/admin/page2/manage', label: 'Quản Lý Tài Liệu K12' },
    { href: '/admin/quy-trinh-quy-dinh-leader', label: 'Xem Tài Liệu Leader/TE/TC' },
    { href: '/admin/quy-trinh-quy-dinh-leader/manage', label: 'Quản Lý Tài Liệu Leader/TE/TC' },
    { href: '/admin/giao-trinh-chuyen-mon', label: 'Giáo trình chuyên môn' },
    { href: '/admin/quan-ly-tai-lieu-giang-day', label: 'Quản lý giáo trình' },
    // Hệ thống
    { href: '/admin/user-management', label: 'Quản lý tài khoản' },
    { href: '/admin/quan-ly-be-mai', label: 'Quản lý bé Mai' },
    { href: '/admin/database', label: 'Database Manager' },
    { href: '/admin/cloudinary', label: 'Cloudinary Manager' },
    { href: '/admin/s3-supabase-manager', label: 'S3 Supabase Manager' },
    { href: '/admin/email-monitor', label: 'Giám sát Email' },
    { href: '/admin/feedback', label: 'Feedback Manager' },
    { href: '/admin/feedback?source=datasource', label: 'Feedback Datasource' },
    { href: '/admin/system-metrics', label: 'Chỉ số hệ thống' },
  ].filter(i => checkHrefPermission(i.href, user))

  const mobileExtraItems: SubItem[] = []

  // ─────────────────────────────────────────────────────────────────────────

  // Dock gap is computed dynamically above

  return (
    <>
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Webkit scrollbar hiding style */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />

      {/*
        overflow-visible is critical: lets absolute flyup panels escape the
        dock box.  The dock is centred with translate(-50%), which is why
        all flyups use `absolute bottom-full` relative to their own icon —
        no fixed + getBoundingClientRect which would be broken by the transform.
      */}
      <div
        ref={dockRef}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[45] overflow-visible"
      >
        {/* Toggle Hide/Show Arrow Button */}
        <button
          type="button"
          onClick={() => setIsDockMinimized(p => !p)}
          onTouchStart={handleTouchStart}
          onTouchMove={(e) => {
            if (isDockMinimized) {
              handleRestoreTouchMove(e)
            } else {
              handleTouchMove(e)
            }
          }}
          onTouchEnd={handleTouchEnd}
          aria-label={isDockMinimized ? "Hiện thanh Dock" : "Ẩn thanh Dock"}
          className={cn(
            "absolute left-1/2 -translate-x-1/2 z-[46] flex items-center justify-center rounded-full transition-all duration-300 shadow-md border border-black/[0.08] cursor-pointer bg-white/90 backdrop-blur-md hover:bg-white text-gray-500 hover:text-gray-800",
            isDockMinimized
              ? "bottom-0 w-20 h-3.5 hover:scale-y-110 text-[#a1001f] border-[#a1001f]/20 shadow-[#a1001f]/10"
              : "-top-2.5 w-20 h-3.5 hover:scale-y-110"
          )}
        >
          {isDockMinimized ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {/* Active Submenu Panel (Flyup) */}
        {openItem && openItem.submenu && !isDockMinimized && (
          <FlyupPanel
            key={openItem.id}
            title={openItem.label}
            content={openItem.submenu}
            iconSize={iconSize}
            onClose={() => { setOpenItemId(null); setActiveAlignX(null); }}
            isNavActive={isNavActive}
            alignX={activeAlignX}
          />
        )}

        {/* Dock pill */}
        <div
          className={cn(
            "flex items-end rounded-[20px] px-3 transition-all duration-300 ease-in-out origin-bottom",
            isDockMinimized
              ? "translate-y-[100px] opacity-0 pointer-events-none scale-90"
              : "translate-y-0 opacity-100 scale-100"
          )}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            height: isMobile ? 60 : 68,
            gap: dockGap,
            paddingBottom: isMobile
              ? 'max(8px, calc(env(safe-area-inset-bottom) + 2px))'
              : 'max(10px, calc(env(safe-area-inset-bottom) + 4px))',
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.55)',
            boxShadow:
              '0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          {/* Search button */}
          <div className="relative flex flex-col items-center">
            <button
              type="button"
              onClick={() => { setIsSearchOpen(true); setOpenItemId(null); setActiveAlignX(null); setShowSettings(false) }}
              aria-label={`Tìm kiếm (${isMac ? '⌘K' : 'Ctrl+K'})`}
              className="group/icon relative flex items-center justify-center rounded-[14px] transition-all duration-150 ease-out bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.10] hover:scale-[1.15] active:scale-[0.93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2"
              style={{ width: iconSize, height: iconSize }}
            >
              <Search className={isMobile ? 'h-5 w-5' : 'h-[22px] w-[22px]'} />
              {/* Tooltip – desktop only */}
              <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-[60] hidden sm:block whitespace-nowrap rounded-lg bg-[#1d1d1f]/90 px-2.5 py-1.5 text-white text-[12px] font-medium shadow-lg opacity-0 transition-opacity duration-100 group-hover/icon:opacity-100">
                Tìm kiếm&nbsp;<span className="opacity-50 text-[11px]">{isMac ? '⌘K' : 'Ctrl+K'}</span>
                <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#1d1d1f]/90" />
              </span>
            </button>
          </div>

          {/* Separator */}
          <div
            className="rounded-full bg-black/10 self-center shrink-0"
            style={{ width: 1, height: isMobile ? 24 : 28, marginInline: isMobile ? 2 : 4 }}
          />

          {/* Scrollable Nav items container */}
          <div
            className={cn(
              "flex items-end no-scrollbar",
              isMobile ? "overflow-x-auto max-w-[calc(100vw-124px)] snap-x" : "overflow-visible"
            )}
            style={{
              gap: dockGap,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              paddingBottom: isMobile ? '2px' : '0',
            }}
            onScroll={() => {
              if (openItemId) {
                setOpenItemId(null)
                setActiveAlignX(null)
              }
            }}
          >
            {dockItems.map(item => (
              <DockButton
                key={item.id}
                item={item}
                isActive={isItemGroupActive(item)}
                isOpen={openItemId === item.id}
                iconSize={iconSize}
                onToggle={(e) => { e?.stopPropagation?.(); toggleItem(item.id, e) }}
                isNavActive={isNavActive}
              />
            ))}
          </div>

          {/* Separator */}
          <div
            className="rounded-full bg-black/10 self-center shrink-0"
            style={{ width: 1, height: isMobile ? 24 : 28, marginInline: isMobile ? 2 : 4 }}
          />

          {/* Settings / More */}
          <div className="relative flex flex-col items-center">
            {/* Settings flyup panel */}
            {showSettings && (
              <div
                className="absolute bottom-full z-50 w-56 max-w-[calc(100vw-16px)]"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '10px',
                  // Clamp to right edge on mobile
                  ...(vw < 640 && {
                    left: 'auto',
                    right: 0,
                    transform: 'none',
                  }),
                }}
                onMouseDown={e => e.stopPropagation()}
              >
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.82)',
                    backdropFilter: 'blur(40px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                    border: '1px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)',
                  }}
                >
                  {/* User profile */}
                  {user && (
                    <Link
                      href={profileHref}
                      prefetch={false}
                      onClick={() => setShowSettings(false)}
                      className="flex items-center gap-3 px-3 py-3 border-b border-black/[0.06] hover:bg-black/[0.04] transition-colors"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#a1001f] text-xs font-bold text-white shadow overflow-hidden shrink-0">
                        {avatarUrl
                          ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                          : <span>{(user.displayName || user.email || '?').charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                          {user.displayName || user.email?.split('@')[0]}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                      </div>
                    </Link>
                  )}

                  <div className="p-1.5 space-y-0.5 max-h-[50vh] overflow-y-auto overscroll-contain custom-scrollbar">
                    {/* Switch to Sidebar */}
                    <button
                      type="button"
                      onClick={() => { setNavMode('sidebar'); setShowSettings(false) }}
                      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[#1d1d1f] hover:bg-black/[0.06] transition-colors"
                    >
                      <PanelLeft className="h-4 w-4 text-gray-500 shrink-0" />
                      <span>Chuyển sang Sidebar</span>
                    </button>

                    {/* Switch Admin ↔ User */}
                    {user?.isAdmin && (
                      isUserArea ? (
                        <Link
                          href="/admin/dashboard"
                          prefetch={false}
                          onClick={() => setShowSettings(false)}
                          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[#1d1d1f] hover:bg-black/[0.06] transition-colors"
                        >
                          <BarChart3 className="h-4 w-4 text-[#a1001f] shrink-0" />
                          <span>Chuyển sang Quản lý</span>
                        </Link>
                      ) : (
                        <Link
                          href="/user/truyenthong"
                          prefetch={false}
                          onClick={() => setShowSettings(false)}
                          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[#1d1d1f] hover:bg-black/[0.06] transition-colors"
                        >
                          <GraduationCap className="h-4 w-4 text-[#a1001f] shrink-0" />
                          <span>Chuyển sang Giáo viên</span>
                        </Link>
                      )
                    )}

                    {/* Mobile "Thêm tính năng" — items hidden from dock on small screens */}
                    {isMobile && mobileExtraItems.length > 0 && (
                      <>
                        <div className="mx-2 my-1 h-px bg-black/[0.06]" />
                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 select-none">
                          Thêm tính năng
                        </div>
                        {mobileExtraItems.map(item => (
                          <Link
                            key={item.href}
                            href={item.href}
                            prefetch={false}
                            onClick={() => setShowSettings(false)}
                            className={cn(
                              'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                              isNavActive(item.href)
                                ? 'bg-[#a1001f]/10 text-[#a1001f]'
                                : 'text-[#1d1d1f] hover:bg-black/[0.06]',
                            )}
                          >
                            {isNavActive(item.href) && <Check className="h-3 w-3 text-[#a1001f] shrink-0" />}
                            {!isNavActive(item.href) && <span className="h-3 w-3 shrink-0" />}
                            <span>{item.label}</span>
                          </Link>
                        ))}
                      </>
                    )}

                    {/* Divider + Logout */}
                    <div className="mx-2 my-1 h-px bg-black/[0.06]" />
                    <button
                      type="button"
                      onClick={() => { setShowSettings(false); logout() }}
                      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>

                {/* Settings caret — bottom-right aligned */}
                <div
                  className="absolute h-3 w-3 rotate-45 border-r border-b border-black/[0.08]"
                  style={{
                    bottom: -6,
                    right: vw < 640 ? iconSize / 2 - 6 : 'auto',
                    left: vw >= 640 ? '50%' : 'auto',
                    transform: vw >= 640 ? 'translateX(-50%) rotate(45deg)' : 'rotate(45deg)',
                    background: 'rgba(255,255,255,0.82)',
                    backdropFilter: 'blur(40px)',
                  }}
                />
              </div>
            )}

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowSettings(p => !p); setOpenItemId(null); setActiveAlignX(null); }}
              aria-label="Cài đặt"
              className={cn(
                'group/icon relative flex items-center justify-center rounded-[14px] transition-all duration-150 ease-out',
                'hover:scale-[1.15] active:scale-[0.93]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2',
                showSettings
                  ? 'bg-[#a1001f] text-white shadow-lg shadow-[#a1001f]/40'
                  : 'bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.10]',
              )}
              style={{ width: iconSize, height: iconSize }}
            >
              {showSettings
                ? <X className={isMobile ? 'h-5 w-5' : 'h-[22px] w-[22px]'} />
                : <Settings className={isMobile ? 'h-5 w-5' : 'h-[22px] w-[22px]'} />
              }
              {!showSettings && (
                <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-[60] hidden sm:block whitespace-nowrap rounded-lg bg-[#1d1d1f]/90 px-2.5 py-1.5 text-white text-[12px] font-medium shadow-lg opacity-0 transition-opacity duration-100 group-hover/icon:opacity-100">
                  Cài đặt
                  <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#1d1d1f]/90" />
                </span>
              )}
            </button>

            {showSettings && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#a1001f]" />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
