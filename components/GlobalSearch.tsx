'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Home, Bell, Megaphone, GraduationCap, FileText, BookOpen, CalendarDays, BarChart3, Users, Settings, DollarSign, Mail, Video, ClipboardCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import {
  checkHrefPermission,
  isPortfolioAllowedUser,
} from '@/lib/menu-permissions'
import { cn } from '@/lib/utils'
import { usePathname } from 'next/navigation'

interface SearchItem {
  label: string
  href: string
  icon: React.ElementType
  group: string
  keywords?: string[]
}

const userSearchItems: SearchItem[] = [
  { label: 'Truyền thông nội bộ', href: '/user/truyenthong', icon: Megaphone, group: 'Trang chính' },
  { label: 'Thông tin của tôi', href: '/user/thong-tin-giao-vien', icon: Home, group: 'Trang chính' },
  { label: 'Thông báo', href: '/user/thong-bao', icon: Bell, group: 'Trang chính' },
  { label: 'Hoạt động hàng tháng', href: '/user/hoat-dong-hang-thang', icon: CalendarDays, group: 'Lịch & Hoạt động' },
  { label: 'Lịch cá nhân', href: '/user/lich-cua-toi', icon: CalendarDays, group: 'Lịch & Hoạt động' },
  { label: 'Đào tạo nâng cao', href: '/user/dao-tao-nang-cao', icon: GraduationCap, group: 'Đào tạo & Khảo thí' },
  { label: 'Quản lý kiểm tra', href: '/user/assignments', icon: GraduationCap, group: 'Đào tạo & Khảo thí' },
  { label: 'Giải trình điểm kiểm tra', href: '/user/giaitrinh', icon: GraduationCap, group: 'Đào tạo & Khảo thí' },
  { label: 'Quy trình & Quy định', href: '/user/quy-trinh-quy-dinh', icon: BookOpen, group: 'Tài liệu nội bộ' },
  { label: 'Giáo trình trải nghiệm', href: '/user/giao-trinh-trai-nghiem', icon: BookOpen, group: 'Tài liệu nội bộ' },
  { label: 'Giáo trình chuyên môn', href: '/user/giao-trinh-chuyen-mon', icon: BookOpen, group: 'Tài liệu nội bộ' },
  { label: 'Trung tâm phản hồi', href: '/user/quan-ly-phan-hoi', icon: FileText, group: 'Phản hồi' },
]

const adminSearchItems: SearchItem[] = [
  { label: 'Bảng Điều Khiển', href: '/admin/dashboard', icon: Home, group: 'Trang chính' },
  { label: 'Thông báo', href: '/admin/thong-bao', icon: Bell, group: 'Trang chính' },
  { label: 'Quản lý Truyền Thông', href: '/admin/truyenthong', icon: Megaphone, group: 'Trang chính' },
  { label: 'Đào tạo đầu vào - Thông tin ứng viên sau phỏng vấn', href: '/admin/hr-candidates', icon: Users, group: 'Đào tạo đầu vào' },
  { label: 'Đào tạo đầu vào - Miền Nam (HCM + Tỉnh Nam)', href: '/admin/hr-candidates/gen-planner?region=south', icon: Users, group: 'Giáo viên & Vận hành' },
  { label: 'Đào tạo đầu vào - Miền Bắc (HN + Tỉnh Bắc + Tỉnh Trung)', href: '/admin/hr-candidates/gen-planner?region=north', icon: Users, group: 'Giáo viên & Vận hành' },
  { label: 'Đào tạo đầu vào - Quản lý video đào tạo', href: '/admin/hr-onboarding/videos', icon: Video, group: 'Đào tạo đầu vào', keywords: ['video onboarding', 'video dau vao'] },
  { label: 'Đào tạo đầu vào - Thư viện bài kiểm tra', href: '/admin/hr-candidates/input-training-tests', icon: GraduationCap, group: 'Đào tạo đầu vào', keywords: ['quiz dau vao', 'bai kiem tra dau vao'] },
  { label: 'Hồ sơ Giáo viên', href: '/admin/page1', icon: Users, group: 'Giáo viên & Vận hành' },
  { label: 'Quản Lý Kiểm Tra Chất Lượng', href: '/admin/quan-ly-qc', icon: ClipboardCheck, group: 'Giáo viên & Vận hành', keywords: ['qc', 'quality check', 'kiem tra chat luong', 'phieu qc'] },
  { label: 'Quản lý lịch làm việc', href: '/admin/page4/quan-ly-lich-lam-viec', icon: CalendarDays, group: 'Giáo viên & Vận hành' },
  { label: 'Lịch sự kiện', href: '/admin/page4/lich-danh-gia', icon: CalendarDays, group: 'Giáo viên & Vận hành' },
  { label: 'Tiếp nhận xin nghỉ 1 buổi', href: '/admin/xin-nghi-mot-buoi', icon: Users, group: 'Giáo viên & Vận hành' },
  { label: 'Thỏa thuận lương', href: '/admin/deal-luong?type=salary_deal', icon: DollarSign, group: 'Giáo viên & Vận hành' },
  { label: 'Hạ lương', href: '/admin/deal-luong?type=salary_reduction', icon: DollarSign, group: 'Giáo viên & Vận hành' },
  { label: 'Nâng lương', href: '/admin/deal-luong?type=bonus', icon: DollarSign, group: 'Giáo viên & Vận hành' },
  { label: 'Kiểm soát Sản phẩm cuối khóa', href: '/admin/kiem-soat-spck', icon: FileText, group: 'Quản lý học viên', keywords: ['spck', 'san pham cuoi khoa', 'portfolio qc'] },
  { label: 'Quản lý Portfolio', href: '/admin/portfolio', icon: FileText, group: 'Quản lý học viên', keywords: ['portfolio', 'ho so hoc vien'] },
  { label: 'Thư viện video nâng cao', href: '/admin/page5', icon: GraduationCap, group: 'Đào tạo & Khảo thí' },
  { label: 'Thư viện đề nâng cao', href: '/admin/assignments', icon: GraduationCap, group: 'Đào tạo & Khảo thí' },
  { label: 'Thống kê đào tạo', href: '/admin/training-dashboard', icon: BarChart3, group: 'Đào tạo & Khảo thí' },
  { label: 'Danh sách Giáo viên đăng ký', href: '/admin/page4/danh-sach-dang-ky', icon: GraduationCap, group: 'Đào tạo & Khảo thí' },
  { label: 'Quản lý Giải trình', href: '/admin/giaitrinh', icon: GraduationCap, group: 'Đào tạo & Khảo thí' },
  { label: 'Thư viện đề chuyên môn', href: '/admin/thu-vien-de', icon: GraduationCap, group: 'Đào tạo & Khảo thí' },
  { label: 'Xem Tài Liệu K12', href: '/admin/page2', icon: BookOpen, group: 'Tài liệu nội bộ' },
  { label: 'Quản Lý Tài Liệu K12', href: '/admin/page2/manage', icon: BookOpen, group: 'Tài liệu nội bộ' },
  { label: 'Xem Tài Liệu Leader/TE/TC', href: '/admin/quy-trinh-quy-dinh-leader', icon: BookOpen, group: 'Tài liệu nội bộ' },
  { label: 'Quản Lý Tài Liệu Leader/TE/TC', href: '/admin/quy-trinh-quy-dinh-leader/manage', icon: BookOpen, group: 'Tài liệu nội bộ' },
  { label: 'Giáo trình trải nghiệm', href: '/admin/giao-trinh-trai-nghiem', icon: BookOpen, group: 'Tài liệu nội bộ' },
  { label: 'Giáo trình chuyên môn', href: '/admin/giao-trinh-chuyen-mon', icon: BookOpen, group: 'Tài liệu nội bộ' },
  { label: 'Quản lý giáo trình', href: '/admin/quan-ly-tai-lieu-giang-day', icon: BookOpen, group: 'Tài liệu nội bộ' },
  { label: 'Quản lý tài khoản', href: '/admin/user-management', icon: Users, group: 'Cấu hình hệ thống' },
  { label: 'Quản lý bé Mai', href: '/admin/quan-ly-be-mai', icon: Settings, group: 'Cấu hình hệ thống', keywords: ['mascot', 'outfit', 'trang phục', 'be mai'] },
  { label: 'Feedback Manager', href: '/admin/feedback', icon: FileText, group: 'Cấu hình hệ thống' },
  { label: 'Feedback Datasource Manager', href: '/admin/feedback?source=datasource', icon: FileText, group: 'Cấu hình hệ thống' },
  { label: 'Database Manager', href: '/admin/database', icon: Settings, group: 'Cấu hình hệ thống' },
  { label: 'Cloudinary Manager', href: '/admin/cloudinary', icon: Settings, group: 'Cấu hình hệ thống' },
  { label: 'S3 Supabase Manager', href: '/admin/s3-supabase-manager', icon: Settings, group: 'Cấu hình hệ thống' },
  { label: 'Giám sát Email', href: '/admin/email-monitor', icon: Mail, group: 'Cấu hình hệ thống' },
  { label: 'Quản lý chỉ số hệ thống', href: '/admin/system-metrics', icon: BarChart3, group: 'Hệ thống' },
]

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
}

function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()
  const { user } = useAuth()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const isUserArea = pathname.startsWith('/user')
  const canUseAdminSearch = Boolean(user?.isAdmin || isPortfolioAllowedUser(user))
  const rawSearchItems = isUserArea || !canUseAdminSearch ? userSearchItems : adminSearchItems
  const searchItems = rawSearchItems.filter(item => checkHrefPermission(item.href, user))

  const filteredItems = query.trim()
    ? searchItems.filter(item => {
        const normalizedQuery = removeVietnameseTones(query)
        return (
          removeVietnameseTones(item.label).includes(normalizedQuery) ||
          removeVietnameseTones(item.group).includes(normalizedQuery) ||
          (item.keywords || []).some(k => removeVietnameseTones(k).includes(normalizedQuery))
        )
      })
    : searchItems

  // Group the filtered items
  const groupedItems = filteredItems.reduce<Record<string, SearchItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  const flatItems = filteredItems

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const handleSelect = useCallback((href: string) => {
    router.push(href)
    onClose()
  }, [router, onClose])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (flatItems[selectedIndex]) {
          handleSelect(flatItems[selectedIndex].href)
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, flatItems, selectedIndex, handleSelect, onClose])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  if (!isOpen) return null

  let flatIndex = 0

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Search modal */}
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm kiếm trang, tính năng..."
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none border-0 ring-0 focus:outline-none focus:ring-0 focus:border-0 shadow-none"
            autoComplete="off"
          />
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Không tìm thấy kết quả cho &ldquo;{query}&rdquo;
            </div>
          ) : (
            Object.entries(groupedItems).map(([group, items]) => (
              <div key={group}>
                <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {group}
                </div>
                {items.map((item) => {
                  const currentFlatIndex = flatIndex++
                  const isSelected = currentFlatIndex === selectedIndex
                  const ItemIcon = item.icon
                  return (
                    <button
                      key={item.href}
                      data-index={currentFlatIndex}
                      onClick={() => handleSelect(item.href)}
                      onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
                        isSelected
                          ? 'bg-[#a1001f]/8 text-[#a1001f]'
                          : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <div className={cn(
                        'p-1.5 rounded-lg shrink-0',
                        isSelected ? 'bg-[#a1001f]/10' : 'bg-gray-100'
                      )}>
                        <ItemIcon className="h-3.5 w-3.5" />
                      </div>
                      <span className="flex-1 font-medium">{item.label}</span>
                      {isSelected && (
                        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 text-xs text-gray-400 font-mono">
                          ↵
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono">↑</kbd>
            <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono">↓</kbd>
            Điều hướng
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono">↵</kbd>
            Chọn
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono">Esc</kbd>
            Đóng
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * SearchTriggerButton — shows the search button in the header/dock area.
 * Detects whether the user is on macOS/iOS to show the correct shortcut key.
 */
export function SearchTriggerButton({ className }: { className?: string }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    // Detect macOS or iOS
    const ua = navigator.userAgent || navigator.platform || ''
    setIsMac(/Mac|iPod|iPhone|iPad/.test(ua))
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isK = e.key === 'k' || e.key === 'K'
      const isMacShortcut = (e.metaKey || e.ctrlKey) && isK
      if (isMacShortcut) {
        e.preventDefault()
        setIsSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <button
        onClick={() => setIsSearchOpen(true)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-500',
          'hover:border-gray-300 hover:bg-gray-50 transition-colors',
          className
        )}
        aria-label="Tìm kiếm"
      >
        <Search className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">Tìm kiếm...</span>
        <kbd className="hidden sm:inline-flex ml-auto items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 text-xs text-gray-400 font-mono">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>

      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  )
}

export default GlobalSearch
