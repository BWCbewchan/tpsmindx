'use client';

import { useAuth } from '@/lib/auth-context';
import { isPortfolioAllowedUser } from '@/lib/menu-permissions';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileCheck,
  FileStack,
  FileText,
  GraduationCap,
  IdCard,
  Layers,
  LayoutTemplate,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const LOGIN_POPUP_STORAGE_PREFIX = 'tms_features_announcement_popup_seen_v2';
const TITLE_ID = 'feature-announcement-popup-title';
const DESC_ID = 'feature-announcement-popup-description';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const notebookLines = Array.from({ length: 8 }, (_, index) => `${18 + index * 9}%`);

function getLoginPopupStorageKey(user: ReturnType<typeof useAuth>['user'], token: string | null) {
  if (!user?.email) return '';
  const emailKey = user.email.trim().toLowerCase();
  const sessionKey = token ? token.slice(-24) : 'active-session';
  return `${LOGIN_POPUP_STORAGE_PREFIX}:${emailKey}:${sessionKey}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   MOCKUP PREVIEW 1: PORTFOLIO
───────────────────────────────────────────────────────────────────────────── */
function PortfolioStackPreview() {
  return (
    <div className="relative mx-auto h-[280px] w-full max-w-[340px] sm:h-[305px]" aria-hidden="true">
      <div className="absolute inset-x-8 bottom-3 top-9 rotate-[-4deg] rounded-[24px] border border-slate-200 bg-white/80 shadow-2xl backdrop-blur-sm" />
      <div className="absolute inset-x-4 bottom-0 top-5 rotate-[3deg] rounded-[24px] border border-slate-200 bg-[#f8f4ea] shadow-2xl" />
      <div className="absolute inset-x-0 bottom-6 top-0 overflow-hidden rounded-[24px] border border-white/35 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.34)]">
        <div className="flex h-9 items-center gap-2 border-b border-slate-800 bg-[#101827] px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
          <span className="ml-2 h-2 w-20 rounded-full bg-white/10" />
        </div>
        <div className="relative h-20 overflow-hidden bg-[#171512] px-5 py-3.5 text-white">
          <span className="absolute inset-y-0 left-0 w-2 bg-[#a1001f]" />
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/18 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
              Portfolio
            </span>
            <span className="h-8 w-8 rounded-full border border-white/30 bg-white/15" />
          </div>
          <div className="mt-5 h-3 w-36 rounded-full bg-white/85" />
          <div className="mt-2 h-2 w-52 rounded-full bg-white/40" />
        </div>
        <div className="space-y-4 p-5">
          <div className="flex gap-3">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-900 shadow-inner shadow-white/10">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-white/12 ring-1 ring-white/18">
                <UserRound className="h-5 w-5 text-white/88" />
              </div>
            </div>
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-3/4 rounded-full bg-slate-900" />
              <div className="h-2 w-full rounded-full bg-slate-200" />
              <div className="h-2 w-2/3 rounded-full bg-slate-200" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['#fef2f2', '#eff6ff', '#ecfdf5'].map((color, index) => (
              <div key={color} className="rounded-xl border border-slate-100 p-2" style={{ backgroundColor: color }}>
                <div className="h-8 rounded-lg bg-white/80" />
                <div className="mt-2 h-1.5 rounded-full bg-slate-300" />
                <div className={cn('mt-1 h-1.5 rounded-full', index === 0 ? 'w-7 bg-[#a1001f]' : index === 1 ? 'w-9 bg-sky-500' : 'w-8 bg-emerald-500')} />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-8 w-8 rounded-xl bg-[#a1001f]/10" />
              <div className="space-y-1">
                <div className="h-2.5 w-28 rounded-full bg-slate-800" />
                <div className="h-2 w-40 rounded-full bg-slate-200" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 8 }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    'h-2 rounded-full',
                    index % 3 === 0 ? 'bg-[#a1001f]' : index % 3 === 1 ? 'bg-amber-400' : 'bg-slate-300',
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MOCKUP PREVIEW 2: CHECKOUT (PHIẾU KẾT QUẢ TRẢI NGHIỆM - SKELETON GẦN THỰC TẾ)
───────────────────────────────────────────────────────────────────────────── */
function CheckoutStackPreview() {
  return (
    <div className="relative mx-auto h-[280px] w-full max-w-[340px] sm:h-[305px]" aria-hidden="true">
      <div className="absolute inset-x-8 bottom-3 top-9 rotate-[-4deg] rounded-[24px] border border-slate-200 bg-white/80 shadow-2xl backdrop-blur-sm" />
      <div className="absolute inset-x-4 bottom-0 top-5 rotate-[3deg] rounded-[24px] border border-slate-200 bg-[#fdfaf3] shadow-2xl" />
      <div className="absolute inset-x-0 bottom-6 top-0 overflow-hidden rounded-[24px] border border-white/35 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.34)]">
        {/* macOS Top Bar */}
        <div className="flex h-8 items-center justify-between border-b border-rose-900/30 bg-[#7a0017] px-3.5 text-white">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-300" />
            <span className="text-[10px] font-bold tracking-wider uppercase whitespace-nowrap">Phiếu Kết Quả Trải Nghiệm</span>
          </div>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase whitespace-nowrap">
            PDF
          </span>
        </div>

        {/* Realistic Checkout Form Skeleton Content */}
        <div className="p-3 space-y-2 text-[10px]">
          {/* Section 1: Thông tin học viên (2x2 grid như InfoRow thực tế) */}
          <div className="rounded-xl border border-rose-100/80 bg-rose-50/50 p-2">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <div className="space-y-0.5">
                <div className="h-1.5 w-10 rounded-full bg-slate-300" />
                <div className="h-2 w-24 rounded-full bg-slate-800" />
              </div>
              <div className="space-y-0.5">
                <div className="h-1.5 w-8 rounded-full bg-slate-300" />
                <div className="h-2 w-16 rounded-full bg-[#a1001f]" />
              </div>
              <div className="space-y-0.5">
                <div className="h-1.5 w-12 rounded-full bg-slate-300" />
                <div className="h-2 w-20 rounded-full bg-slate-700" />
              </div>
              <div className="space-y-0.5">
                <div className="h-1.5 w-10 rounded-full bg-slate-300" />
                <div className="h-2 w-18 rounded-full bg-slate-700" />
              </div>
            </div>
          </div>

          {/* Section 2: Bảng Rubrics 5 Cột Đánh Giá Chuẩn (như CommonRubricTable thực tế) */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-2 shadow-xs">
            {/* Table Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-1 text-[8.5px] font-black uppercase text-[#a1001f]">
              <span className="h-2 w-16 rounded-full bg-[#a1001f]/70" />
              <div className="flex gap-2.5 pr-1 font-mono text-slate-400">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span className="text-[#a1001f] font-black">4</span>
                <span className="text-emerald-600 font-black">5</span>
              </div>
            </div>

            {/* 3 Rubrics Rows with Score Marks */}
            <div className="mt-1.5 space-y-1.5">
              {[
                { w: 'w-24', activeCol: 4, colColor: 'bg-[#a1001f]' },
                { w: 'w-20', activeCol: 4, colColor: 'bg-amber-500' },
                { w: 'w-28', activeCol: 5, colColor: 'bg-emerald-500' },
              ].map((row, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className={cn('h-1.5 rounded-full bg-slate-700', row.w)} />
                  <div className="flex gap-2.5 pr-1">
                    {[1, 2, 3, 4, 5].map((col) => (
                      <span
                        key={col}
                        className={cn(
                          'h-2 w-2 rounded-full transition-all',
                          col === row.activeCol
                            ? cn(row.colColor, 'ring-2 ring-white shadow-xs scale-110')
                            : 'bg-slate-200'
                        )}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Nhận xét của giáo viên (như form thực tế) */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-1 space-y-1">
            <div className="h-1.5 w-14 rounded-full bg-slate-400" />
            <div className="h-1.5 w-full rounded-full bg-slate-300" />
            <div className="h-1.5 w-3/4 rounded-full bg-slate-200" />
          </div>

          {/* Section 4: Kết luận & Đề xuất (như CaseResult thực tế) */}
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <div className="h-2 w-36 rounded-full bg-emerald-700/70" />
            </div>
            <span className="h-1.5 w-6 rounded-full bg-emerald-500/40" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MOCKUP PREVIEW 3: BẢNG CÔNG (CHẤM CÔNG & LƯƠNG - SKELETON GẦN THỰC TẾ)
───────────────────────────────────────────────────────────────────────────── */
function CheckCongStackPreview() {
  return (
    <div className="relative mx-auto h-[280px] w-full max-w-[340px] sm:h-[305px]" aria-hidden="true">
      <div className="absolute inset-x-8 bottom-3 top-9 rotate-[-4deg] rounded-[24px] border border-slate-200 bg-white/80 shadow-2xl backdrop-blur-sm" />
      <div className="absolute inset-x-4 bottom-0 top-5 rotate-[3deg] rounded-[24px] border border-slate-200 bg-[#f4f7fa] shadow-2xl" />
      <div className="absolute inset-x-0 bottom-6 top-0 overflow-hidden rounded-[24px] border border-white/35 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.34)]">
        {/* macOS Top Bar */}
        <div className="flex h-8 items-center justify-between border-b border-emerald-900/30 bg-[#0f5132] px-3.5 text-white">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-[10px] font-bold tracking-wider uppercase whitespace-nowrap">Kiểm Tra Công & Lương</span>
          </div>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase whitespace-nowrap">
            TPS TAB
          </span>
        </div>

        {/* Realistic Check Cong Skeleton Content */}
        <div className="p-3 space-y-2 text-[10px]">
          {/* Section 1: Toolbar bộ lọc (All | Checked | Unchecked & Dropdown tháng như thật) */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex rounded-md border border-slate-200 bg-slate-100 p-0.5 gap-0.5">
              <span className="rounded bg-[#a1001f] px-2 py-0.5 text-[8.5px] font-bold text-white shadow-xs whitespace-nowrap">
                All
              </span>
              <span className="rounded px-2 py-0.5 text-[8.5px] font-medium text-slate-600 whitespace-nowrap">
                Checked
              </span>
              <span className="rounded px-2 py-0.5 text-[8.5px] font-medium text-slate-400 whitespace-nowrap">
                Unchecked
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[8.5px] text-slate-600">
              <CalendarCheck className="h-3 w-3 text-slate-400" />
              <span className="h-1.5 w-12 rounded-full bg-slate-300" />
            </div>
          </div>

          {/* Section 2: 3 Thẻ KPI Thống Kê (Tổng số / Checked / Giờ dạy như thật) */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-1.5">
              <div className="h-1.5 w-8 rounded-full bg-blue-600/40" />
              <div className="mt-1 h-3.5 w-7 rounded-sm bg-blue-900/30" />
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-1.5">
              <div className="h-1.5 w-10 rounded-full bg-emerald-600/40" />
              <div className="mt-1 h-3.5 w-7 rounded-sm bg-emerald-800/40" />
            </div>
            <div className="rounded-lg border border-purple-100 bg-purple-50/60 p-1.5">
              <div className="h-1.5 w-8 rounded-full bg-purple-600/40" />
              <div className="mt-1 h-3.5 w-9 rounded-sm bg-purple-900/30" />
            </div>
          </div>

          {/* Section 3: Bảng danh sách ca dạy (Records Table với Checked/Unchecked Badge) */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-1.5 space-y-1">
            {[
              { wClass: 'w-24', wTime: 'w-16', status: 'Checked', statusColor: 'bg-emerald-100 text-emerald-700' },
              { wClass: 'w-20', wTime: 'w-14', status: 'Checked', statusColor: 'bg-emerald-100 text-emerald-700' },
              { wClass: 'w-26', wTime: 'w-16', status: 'Unchecked', statusColor: 'bg-amber-100 text-amber-700' },
            ].map((row, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-md bg-white px-2 py-1 border border-slate-100 text-[9px]">
                <div className="space-y-0.5">
                  <div className={cn('h-1.5 rounded-full bg-slate-800', row.wClass)} />
                  <div className={cn('h-1 rounded-full bg-slate-300', row.wTime)} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-6 rounded-full bg-slate-400" />
                  <span className={cn('rounded px-1.5 py-0.5 text-[7.5px] font-bold whitespace-nowrap', row.statusColor)}>
                    {row.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Section 4: Cổng phản hồi công (như checkCongFeedback trong dự án) */}
          <div className="flex items-center justify-between rounded-lg bg-slate-100 px-2.5 py-1 text-[9px]">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="h-1.5 w-24 rounded-full bg-slate-500" />
            </div>
            <span className="rounded bg-white px-1.5 py-0.5 text-[8px] font-bold text-slate-700 border border-slate-200 whitespace-nowrap">
              Phản hồi
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   FEATURE TAB CONFIGURATION
───────────────────────────────────────────────────────────────────────────── */
type FeatureTabId = 'portfolio' | 'checkout' | 'checkcong';

interface FeatureTabConfig {
  id: FeatureTabId;
  tabLabel: string;
  badge: string;
  title: string;
  description: string;
  preview: React.ComponentType;
  highlightsTitle: string;
  highlightsSubtitle: string;
  highlights: Array<{
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    detailIcon: React.ComponentType<{ className?: string }>;
    accent: string;
    numberClass: string;
    lineClass: string;
    haloClass: string;
  }>;
  sectionsBoxTitle: string;
  sectionsBoxSubtitle: string;
  tags: Array<{ label: string; icon: React.ComponentType<{ className?: string }> }>;
  ctaLabelAdmin: string;
  ctaHrefAdmin: string;
  ctaLabelTeacher: string;
  ctaHrefTeacher: string;
}

const FEATURES_MAP: Record<FeatureTabId, FeatureTabConfig> = {
  portfolio: {
    id: 'portfolio',
    tabLabel: 'Portfolio Học viên',
    badge: 'HỒ SƠ NĂNG LỰC',
    title: 'Tạo Portfolio học viên ngay trong TPS',
    description:
      'Biến dữ liệu học tập, sản phẩm cuối khóa và thành tích của học viên thành một hồ sơ public có thể chia sẻ với phụ huynh.',
    preview: PortfolioStackPreview,
    highlightsTitle: 'HỒ SƠ NĂNG LỰC',
    highlightsSubtitle: 'Từ lớp học đến hồ sơ hoàn chỉnh trong một luồng làm việc',
    highlights: [
      {
        title: 'Dữ liệu lớp học',
        description: 'Quản lý tiến độ lưu trữ sản phẩm cuối khóa của học viên',
        icon: GraduationCap,
        detailIcon: BarChart3,
        accent: 'text-sky-700 bg-sky-50 border-sky-100',
        numberClass: 'text-sky-300',
        lineClass: 'bg-sky-500',
        haloClass: 'bg-sky-100 text-sky-600',
      },
      {
        title: 'Hồ sơ năng lực',
        description: 'Áp dụng dữ liệu từ LMS để tạo và xuất bản Portfolio cá nhân của học viên',
        icon: LayoutTemplate,
        detailIcon: IdCard,
        accent: 'text-[#a1001f] bg-rose-50 border-rose-100',
        numberClass: 'text-rose-300',
        lineClass: 'bg-[#a1001f]',
        haloClass: 'bg-rose-100 text-[#a1001f]',
      },
      {
        title: 'Quản lý & theo dõi',
        description: 'Theo dõi trạng thái, mở bản public và kiểm soát chất lượng sản phẩm cuối\u00A0khóa',
        icon: FileStack,
        detailIcon: ShieldCheck,
        accent: 'text-emerald-700 bg-emerald-50 border-emerald-100',
        numberClass: 'text-emerald-300',
        lineClass: 'bg-emerald-500',
        haloClass: 'bg-emerald-100 text-emerald-600',
      },
    ],
    sectionsBoxTitle: 'Các phần trong Portfolio',
    sectionsBoxSubtitle: 'Người phụ trách có thể kiểm tra nội dung và chọn trạng thái phù hợp trước khi chia sẻ.',
    tags: [
      { label: 'Thông tin học viên', icon: GraduationCap },
      { label: 'Lộ trình học tập', icon: BookOpen },
      { label: 'Dự án / Sản phẩm', icon: Sparkles },
      { label: 'Thư viện hình ảnh', icon: Layers },
      { label: 'Thành tích', icon: Award },
    ],
    ctaLabelAdmin: 'Mở Quản lý Portfolio',
    ctaHrefAdmin: '/admin/portfolio',
    ctaLabelTeacher: 'Xem chi tiết',
    ctaHrefTeacher: '/admin/portfolio',
  },
  checkout: {
    id: 'checkout',
    tabLabel: 'Phiếu kết quả trải nghiệm',
    badge: 'KẾT QUẢ TRẢI NGHIỆM',
    title: 'Phiếu kết quả trải nghiệm',
    description:
      'Đánh giá học viên theo bộ tiêu chí chuẩn Rubrics từng khối, ghi nhận xét chi tiết và xuất bản PDF gửi phụ huynh nhanh chóng.',
    preview: CheckoutStackPreview,
    highlightsTitle: 'PHIẾU KẾT QUẢ TRẢI NGHIỆM',
    highlightsSubtitle: 'Số hóa quy trình đánh giá học thử và nâng cao tỷ lệ chuyển\u00A0đổi',
    highlights: [
      {
        title: 'Tiêu chí Rubrics',
        description: 'Bộ tiêu chí đánh giá tư duy, kỹ năng và thao tác chuẩn hóa cho từng\u00A0khối',
        icon: ClipboardCheck,
        detailIcon: Award,
        accent: 'text-amber-700 bg-amber-50 border-amber-100',
        numberClass: 'text-amber-300',
        lineClass: 'bg-amber-500',
        haloClass: 'bg-amber-100 text-amber-600',
      },
      {
        title: 'Nhận xét & lộ trình',
        description: 'Phù hợp cho học viên trải nghiệm, ghi nhận xét chi tiết và định hướng phát\u00A0triển',
        icon: FileText,
        detailIcon: IdCard,
        accent: 'text-[#a1001f] bg-rose-50 border-rose-100',
        numberClass: 'text-rose-300',
        lineClass: 'bg-[#a1001f]',
        haloClass: 'bg-rose-100 text-[#a1001f]',
      },
      {
        title: 'PDF',
        description: 'Xuất bản phiếu kết quả trải nghiệm định dạng PDF sắc nét, thuận tiện lưu\u00A0trữ',
        icon: FileCheck,
        detailIcon: ShieldCheck,
        accent: 'text-emerald-700 bg-emerald-50 border-emerald-100',
        numberClass: 'text-emerald-300',
        lineClass: 'bg-emerald-500',
        haloClass: 'bg-emerald-100 text-emerald-600',
      },
    ],
    sectionsBoxTitle: 'Tiện ích phiếu kết quả trải nghiệm',
    sectionsBoxSubtitle: 'Hỗ trợ giáo viên và đội ngũ quản lý đồng bộ dữ liệu nhanh chóng, chính xác.',
    tags: [
      { label: 'Đánh giá Rubrics', icon: ClipboardCheck },
      { label: 'Tư vấn lộ trình', icon: BookOpen },
      { label: 'PDF', icon: FileCheck },
    ],
    ctaLabelAdmin: 'Xem Quản lý Phiếu',
    ctaHrefAdmin: '/user/checkout/manage',
    ctaLabelTeacher: 'Tạo phiếu trải nghiệm',
    ctaHrefTeacher: '/user/checkout/create',
  },
  checkcong: {
    id: 'checkcong',
    tabLabel: 'Bảng công & Chấm công',
    badge: 'QUẢN LÝ CÔNG & THÙ LAO',
    title: 'Minh bạch giờ dạy & Đối soát công',
    description:
      'Kiểm tra chi tiết từng ca dạy, giờ slot, giờ thực tế, tỷ lệ check công và gửi phản hồi khiếu nại công nhanh chóng.',
    preview: CheckCongStackPreview,
    highlightsTitle: 'KIỂM TRA CÔNG & THÙ LAO',
    highlightsSubtitle: 'Minh bạch số liệu giờ dạy, ca trực và quyền lợi giáo\u00A0viên',
    highlights: [
      {
        title: 'Đối soát giờ dạy',
        description: 'Thống kê chi tiết giờ thực tế, ca slot, số buổi đứng lớp và ca trực trải\u00A0nghiệm',
        icon: Clock,
        detailIcon: BarChart3,
        accent: 'text-emerald-700 bg-emerald-50 border-emerald-100',
        numberClass: 'text-emerald-300',
        lineClass: 'bg-emerald-500',
        haloClass: 'bg-emerald-100 text-emerald-600',
      },
      {
        title: 'Tiến độ check công',
        description: 'Theo dõi tiến độ hoàn tất check công với cảnh báo ca sót kịp thời trước ngày khóa\u00A0sổ',
        icon: CalendarCheck,
        detailIcon: ShieldCheck,
        accent: 'text-sky-700 bg-sky-50 border-sky-100',
        numberClass: 'text-sky-300',
        lineClass: 'bg-sky-500',
        haloClass: 'bg-sky-100 text-sky-600',
      },
      {
        title: 'Cổng phản hồi',
        description: 'Gửi khiếu nại trực tiếp trên hệ thống và theo dõi kết quả xử lý từ ban quản\u00A0lý',
        icon: FileStack,
        detailIcon: Award,
        accent: 'text-[#a1001f] bg-rose-50 border-rose-100',
        numberClass: 'text-rose-300',
        lineClass: 'bg-[#a1001f]',
        haloClass: 'bg-rose-100 text-[#a1001f]',
      },
    ],
    sectionsBoxTitle: 'Tính năng cốt lõi',
    sectionsBoxSubtitle: 'Đảm bảo mọi quyền lợi và thù lao giảng dạy được đối soát công khai, chuẩn mực.',
    tags: [
      { label: 'Giờ thực tế & Slot', icon: Clock },
      { label: 'Tỷ lệ check công', icon: CheckCircle2 },
      { label: 'Cổng phản hồi công', icon: FileStack },
      { label: 'Tạm tính thù lao', icon: Award },
      { label: 'Báo cáo cơ sở', icon: BarChart3 },
    ],
    ctaLabelAdmin: 'Mở Kiểm tra công',
    ctaHrefAdmin: '/admin/check-cong',
    ctaLabelTeacher: 'Kiểm tra công của tôi',
    ctaHrefTeacher: '/user/thong-tin-giao-vien?tab=checkCong',
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export function AdminPortfolioFeaturePopup() {
  const { user, token, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // Determine user authorization
  const isManagement = useMemo(() => {
    if (!user) return false;
    if (user.isAdmin) return true;
    const roleLower = (user.role || '').toLowerCase();
    if (['super_admin', 'admin', 'manager', 'leader', 'te', 'tc'].includes(roleLower)) return true;
    if (isPortfolioAllowedUser(user)) return true;
    if (pathname?.startsWith('/admin')) return true;
    return false;
  }, [pathname, user]);

  // Tab list strictly conditioned by role:
  // - Management side: 3 tabs [portfolio, checkout, checkcong]
  // - Teacher side: ONLY 2 tabs [checkout, checkcong] (no portfolio)
  const availableTabs = useMemo<FeatureTabConfig[]>(() => {
    if (isManagement) {
      return [FEATURES_MAP.portfolio, FEATURES_MAP.checkout, FEATURES_MAP.checkcong];
    }
    return [FEATURES_MAP.checkout, FEATURES_MAP.checkcong];
  }, [isManagement]);

  const [selectedTabId, setSelectedTabId] = useState<FeatureTabId | null>(null);

  const activeTabId = useMemo<FeatureTabId>(() => {
    if (selectedTabId && availableTabs.some((t) => t.id === selectedTabId)) {
      return selectedTabId;
    }
    return availableTabs[0]?.id || 'checkout';
  }, [availableTabs, selectedTabId]);

  const currentFeature = useMemo(
    () => FEATURES_MAP[activeTabId] || availableTabs[0] || FEATURES_MAP.checkout,
    [activeTabId, availableTabs],
  );

  const canShow = useMemo(() => {
    if (!user) return false;
    // Exclude public, login, maintenance pages
    if (
      pathname?.startsWith('/login') ||
      pathname?.startsWith('/bao-tri') ||
      pathname?.startsWith('/candidate-portal') ||
      pathname?.startsWith('/public/') ||
      pathname === '/'
    ) {
      return false;
    }
    return true;
  }, [pathname, user]);

  const loginPopupStorageKey = useMemo(
    () => getLoginPopupStorageKey(user, token),
    [token, user],
  );

  useEffect(() => {
    setMounted(true);
    // Allow triggering from console or custom events at any time
    const handleForceOpen = () => setOpen(true);
    window.addEventListener('open-feature-popup', handleForceOpen);
    if (typeof window !== 'undefined') {
      (window as unknown as { __showFeaturePopup?: () => void }).__showFeaturePopup = handleForceOpen;
    }
    return () => {
      window.removeEventListener('open-feature-popup', handleForceOpen);
    };
  }, []);

  useEffect(() => {
    if (!mounted || isLoading || !canShow) return;

    // Check if forced via query param (?featurePopup=1 or ?showFeatures=1)
    let forceShow = false;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      forceShow = params.has('featurePopup') || params.has('showFeatures');
    }

    if (!forceShow && loginPopupStorageKey) {
      try {
        if (window.sessionStorage.getItem(loginPopupStorageKey)) return;
      } catch {
        return;
      }
    }

    const timer = window.setTimeout(() => setOpen(true), 650);
    return () => window.clearTimeout(timer);
  }, [canShow, isLoading, loginPopupStorageKey, mounted]);

  const closePopup = useCallback(() => {
    try {
      if (loginPopupStorageKey) {
        window.sessionStorage.setItem(loginPopupStorageKey, String(Date.now()));
      }
    } catch {
      // Ignore private browsing storage failures.
    }
    setOpen(false);
  }, [loginPopupStorageKey]);

  const handleCtaClick = useCallback(() => {
    closePopup();
    const href = isManagement ? currentFeature.ctaHrefAdmin : currentFeature.ctaHrefTeacher;
    router.push(href);
  }, [closePopup, currentFeature, isManagement, router]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.focus({ preventScroll: true });
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault();
        closePopup();
        return;
      }

      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      } else if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      const previousFocus = previousFocusRef.current;
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true });
      }
      previousFocusRef.current = null;
    };
  }, [closePopup, open]);

  if (!mounted || !open) return null;

  const PreviewComponent = currentFeature.preview;
  const ctaLabel = isManagement ? currentFeature.ctaLabelAdmin : currentFeature.ctaLabelTeacher;

  return createPortal(
    <div className="fixed inset-0 z-modal-raised-custom flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-md sm:p-6 animate-fadeIn">
      <style>{`
        @keyframes portfolioFeatureBorderSpin {
          to { transform: rotate(360deg); }
        }
        .portfolio-feature-border {
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
        }
      `}</style>
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Đóng popup tính năng" onClick={closePopup} />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={DESC_ID}
        tabIndex={-1}
        className="relative flex flex-col lg:grid lg:grid-cols-[1fr_1.18fr] max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-40px)] w-full max-w-[1040px] overflow-hidden rounded-[24px] sm:rounded-[28px] border border-[#a1001f]/25 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.32)] outline-none ring-1 ring-white/60"
      >
        <span
          className="portfolio-feature-border pointer-events-none absolute inset-0 z-30 rounded-[24px] sm:rounded-[28px] p-[1.5px]"
          aria-hidden="true"
        >
          <span className="absolute -inset-[55%] block animate-[portfolioFeatureBorderSpin_8s_linear_infinite] bg-[conic-gradient(from_90deg,rgba(161,0,31,0.08),rgba(161,0,31,0.78),rgba(244,180,45,0.32),rgba(161,0,31,0.78),rgba(161,0,31,0.08))]" />
        </span>
        <button
          type="button"
          onClick={closePopup}
          className="absolute right-3 top-3 z-40 grid h-9 w-9 place-items-center rounded-full border border-white/70 bg-white/90 text-slate-500 shadow-sm backdrop-blur transition duration-300 hover:rotate-90 hover:scale-105 hover:border-[#a1001f]/30 hover:bg-white hover:text-[#a1001f] focus:outline-none focus:ring-4 focus:ring-[#a1001f]/15"
          aria-label="Đóng popup"
        >
          <X className="h-4.5 w-4.5 transition-transform duration-300" />
        </button>

        {/* MOBILE TAB SELECTOR (Chỉ hiển thị trên mobile/tablet < lg ở đầu trang để điều khiển toàn bộ popup) */}
        <div className="lg:hidden shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm px-4 pt-3.5 pb-2.5 z-30">
          <div className="flex flex-wrap items-center gap-1.5 pr-9">
            {availableTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedTabId(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all duration-200 focus:outline-none whitespace-nowrap',
                    isActive
                      ? 'bg-[#a1001f] text-white shadow-sm shadow-[#a1001f]/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
                  )}
                >
                  <span>{tab.tabLabel}</span>
                  {isActive && <ChevronRight className="h-3 w-3 opacity-80" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* SCROLLABLE WRAPPER ON MOBILE (< lg), DUAL-COLUMN GRID ON DESKTOP (>= lg) */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:contents">
          {/* ── LEFT COLUMN: PREVIEW & VALUE PROPOSITION ──────────────── */}
          <div className="relative flex flex-col bg-[#f8f2e7] px-5 py-5 sm:px-7 sm:py-6 text-slate-950 lg:justify-between lg:overflow-hidden lg:h-full shrink-0">
            <div className="absolute inset-0 bg-[#f8f2e7]" aria-hidden />
            {notebookLines.map((top) => (
              <span
                key={top}
                className="absolute left-8 right-8 border-t border-slate-900/[0.035]"
                style={{ top }}
                aria-hidden="true"
              />
            ))}

            {/* Header text on Left */}
            <div className="relative z-10 pr-8 lg:pr-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#a1001f]/15 bg-white/80 px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-[0.14em] text-[#a1001f] shadow-sm">
                <Sparkles className="h-3 w-3 text-[#a1001f]" />
                Tính năng mới
              </div>
              <h2 id={TITLE_ID} className="mt-2.5 max-w-[420px] text-lg sm:text-2xl lg:text-[26px] font-black leading-tight tracking-normal text-slate-900 text-balance text-pretty">
                {currentFeature.title}
              </h2>
              <p id={DESC_ID} className="mt-1.5 max-w-[430px] text-xs sm:text-sm font-medium leading-relaxed text-slate-600 text-pretty">
                {currentFeature.description}
              </p>
            </div>

            {/* Interactive Stack Preview (Hiển thị đầy đủ skeleton, cách text an toàn bằng mt-6 sm:mt-8) */}
            <div className="relative z-10 mt-6 sm:mt-8 flex items-center justify-center pb-4">
              <div className="w-full max-w-[340px]">
                <PreviewComponent />
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: TAB SELECTOR, HIGHLIGHTS & CONTENT ──── */}
          <div className="relative z-10 flex flex-1 flex-col bg-[linear-gradient(180deg,#ffffff_0%,#fff7f8_100%)] lg:min-h-0 lg:overflow-hidden">
            {/* Middle Body: Scrollable on Desktop, Natural flow on Mobile */}
            <div className="p-4 sm:p-6 space-y-3.5 lg:flex-1 lg:overflow-y-auto">
              {/* DESKTOP TAB SELECTOR HEADER (Chỉ hiện trên desktop >= lg) */}
              <div className="hidden lg:block border-b border-slate-100 pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {availableTabs.map((tab) => {
                    const isActive = tab.id === activeTabId;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSelectedTabId(tab.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#a1001f]/30 whitespace-nowrap',
                          isActive
                            ? 'bg-[#a1001f] text-white shadow-md shadow-[#a1001f]/20 scale-[1.02]'
                            : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900',
                        )}
                      >
                        <span>{tab.tabLabel}</span>
                        {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-80" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TITLE & SUBTITLE */}
              <div className="pr-2 sm:pr-8">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#a1001f]">
                  {currentFeature.highlightsTitle}
                </p>
                <h3 className="mt-1 text-base font-black text-slate-950 sm:text-lg text-balance text-pretty">
                  {currentFeature.highlightsSubtitle}
                </h3>
              </div>

              {/* 3 HIGHLIGHTS CARDS */}
              <div className="grid auto-rows-fr gap-2.5 sm:grid-cols-3">
                {currentFeature.highlights.map((item, index) => {
                  const Icon = item.icon;
                  const DetailIcon = item.detailIcon;
                  return (
                    <article
                      key={item.title}
                      className="relative flex min-h-[145px] sm:min-h-[185px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 sm:p-3.5 pb-0 shadow-xs transition hover:-translate-y-0.5 hover:border-[#a1001f]/20 hover:shadow-md"
                    >
                      <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-slate-100" aria-hidden="true" />
                      <div className="flex items-start justify-between gap-2">
                        <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl border', item.accent)}>
                          <Icon className="h-4 w-4 shrink-0" />
                        </div>
                        <span className={cn('text-[11px] font-black', item.numberClass)}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <h4 className="mt-2 text-xs font-black leading-snug text-slate-950 text-balance text-pretty">{item.title}</h4>
                      <div className={cn('mt-1 h-0.5 w-8 rounded-full', item.lineClass)} aria-hidden="true" />
                      <p className="mt-1.5 text-[10.5px] font-medium leading-[1.5] text-slate-500 text-pretty">
                        {item.description}
                      </p>

                      {/* VÒNG TRÒN ICON ĐÁY THẺ - NẰM TRONG VÙNG RIÊNG TÁCH BIỆT HOÀN TOÀN VỚI CHỮ */}
                      <div className="mt-auto flex items-end justify-center pt-2">
                        <span
                          className={cn(
                            'grid h-8 w-14 sm:h-9 sm:w-16 place-items-center rounded-t-full shadow-2xs border-t border-x border-white/60',
                            item.haloClass,
                          )}
                          aria-hidden="true"
                        >
                          <DetailIcon className="h-4 w-4 sm:h-4.5 sm:w-4.5 mb-0.5" />
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* SECTIONS BOX */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-950 text-white">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-950 text-balance text-pretty">{currentFeature.sectionsBoxTitle}</h4>
                    <p className="mt-0.5 text-2xs sm:text-xs font-medium leading-relaxed text-slate-500 text-pretty">
                      {currentFeature.sectionsBoxSubtitle}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {currentFeature.tags.map((item) => {
                    const Icon = item.icon;
                    return (
                      <span
                        key={item.label}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/70 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-700 shadow-2xs transition hover:bg-white hover:border-slate-300"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-[#a1001f]" />
                        <span className="leading-none whitespace-nowrap">{item.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PINNED ACTIONS FOOTER (Always 100% visible on both mobile and desktop) */}
        <div className="shrink-0 border-t border-slate-100 bg-white/95 backdrop-blur-sm px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-end gap-3 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] lg:col-start-2">
          <button
            type="button"
            onClick={closePopup}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
          >
            Để sau
          </button>
          <button
            type="button"
            onClick={handleCtaClick}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#a1001f] px-5 text-xs sm:text-sm font-black text-white shadow-lg shadow-[#a1001f]/20 transition hover:bg-[#850019] focus:outline-none focus:ring-4 focus:ring-[#a1001f]/20"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default AdminPortfolioFeaturePopup;
