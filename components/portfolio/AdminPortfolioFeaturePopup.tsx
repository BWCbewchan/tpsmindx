'use client';

import { useAuth } from '@/lib/auth-context';
import { isPortfolioAllowedUser } from '@/lib/menu-permissions';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Camera,
  CheckCircle2,
  FileStack,
  GraduationCap,
  IdCard,
  LayoutTemplate,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const LOGIN_POPUP_STORAGE_PREFIX = 'tms_admin_portfolio_feature_popup_login_seen_v1';
const TITLE_ID = 'admin-portfolio-feature-popup-title';
const DESC_ID = 'admin-portfolio-feature-popup-description';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const featureHighlights = [
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
    accent: 'text-mindx-red bg-rose-50 border-rose-100',
    numberClass: 'text-rose-300',
    lineClass: 'bg-mindx-red',
    haloClass: 'bg-rose-100 text-mindx-red',
  },
  {
    title: 'Quản lý & Theo dõi',
    description: 'Theo dõi trạng thái, mở bản public và quản lý hồ sơ theo quyền tài khoản',
    icon: FileStack,
    detailIcon: ShieldCheck,
    accent: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    numberClass: 'text-emerald-300',
    lineClass: 'bg-emerald-500',
    haloClass: 'bg-emerald-100 text-emerald-600',
  },
];

const builderSections = [
  { label: 'Thông tin học viên', icon: GraduationCap },
  { label: 'Lộ trình học tập', icon: BookOpen },
  { label: 'Dự án / Sản phẩm', icon: Sparkles },
  { label: 'Thư viện hình ảnh', icon: Camera },
  { label: 'Thành tích', icon: Award },
];

const notebookLines = Array.from({ length: 8 }, (_, index) => `${18 + index * 9}%`);

function userHasPortfolioEntry(user: ReturnType<typeof useAuth>['user']) {
  if (!user?.isAdmin) return false;
  return isPortfolioAllowedUser(user);
}

function getLoginPopupStorageKey(user: ReturnType<typeof useAuth>['user'], token: string | null) {
  if (!user?.email) return '';
  const emailKey = user.email.trim().toLowerCase();
  const sessionKey = token ? token.slice(-24) : 'active-session';
  return `${LOGIN_POPUP_STORAGE_PREFIX}:${emailKey}:${sessionKey}`;
}

function PortfolioStackPreview() {
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-[360px] sm:h-[340px]" aria-hidden="true">
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
          <span className="absolute inset-y-0 left-0 w-2 bg-mindx-red" />
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
                <div className={cn('mt-1 h-1.5 rounded-full', index === 0 ? 'w-7 bg-mindx-red' : index === 1 ? 'w-9 bg-sky-500' : 'w-8 bg-emerald-500')} />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-8 w-8 rounded-xl bg-mindx-red/10" />
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
                    index % 3 === 0 ? 'bg-mindx-red' : index % 3 === 1 ? 'bg-amber-400' : 'bg-slate-300',
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

export function AdminPortfolioFeaturePopup() {
  const { user, token, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const canShow = useMemo(
    () => Boolean(pathname?.startsWith('/admin') && userHasPortfolioEntry(user)),
    [pathname, user],
  );
  const loginPopupStorageKey = useMemo(
    () => getLoginPopupStorageKey(user, token),
    [token, user],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || isLoading || !canShow || !loginPopupStorageKey) return;
    try {
      if (window.sessionStorage.getItem(loginPopupStorageKey)) return;
    } catch {
      return;
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

  const openPortfolio = useCallback(() => {
    closePopup();
    router.push('/admin/portfolio');
  }, [closePopup, router]);

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

  return createPortal(
    <div className="fixed inset-0 z-modal-raised-custom flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-md sm:p-6">
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
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Đóng popup portfolio" onClick={closePopup} />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={DESC_ID}
        tabIndex={-1}
        className="relative grid max-h-[calc(100vh-24px)] w-full max-w-[1080px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[28px] border border-mindx-red/25 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.32)] outline-none ring-1 ring-white/60 sm:max-h-[calc(100vh-48px)] lg:grid-cols-[1fr_1.16fr] lg:grid-rows-1"
      >
        <span
          className="portfolio-feature-border pointer-events-none absolute inset-0 z-30 rounded-[28px] p-[1.5px]"
          aria-hidden="true"
        >
          <span className="absolute -inset-[55%] block animate-[portfolioFeatureBorderSpin_8s_linear_infinite] bg-[conic-gradient(from_90deg,rgba(189,0,38,0.08),rgba(189,0,38,0.78),rgba(244,180,45,0.32),rgba(189,0,38,0.78),rgba(189,0,38,0.08))]" />
        </span>
        <button
          type="button"
          onClick={closePopup}
          className="absolute right-3 top-3 z-40 grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-white/85 text-slate-500 shadow-sm backdrop-blur transition duration-300 hover:rotate-90 hover:scale-105 hover:border-mindx-red/30 hover:bg-white hover:text-mindx-red focus:outline-none focus:ring-4 focus:ring-mindx-red/15"
          aria-label="Đóng giới thiệu Portfolio"
        >
          <X className="h-5 w-5 transition-transform duration-300" />
        </button>

        <div className="relative flex min-h-[350px] flex-col overflow-hidden bg-[#f8f2e7] px-5 pb-4 pt-7 text-slate-950 sm:min-h-[420px] sm:px-8 sm:pb-5 sm:pt-9 lg:min-h-[590px]">
          <div className="absolute inset-0 bg-[#f8f2e7]" aria-hidden />
          {notebookLines.map((top) => (
            <span
              key={top}
              className="absolute left-8 right-8 border-t border-slate-900/[0.035]"
              style={{ top }}
              aria-hidden="true"
            />
          ))}
          <div className="absolute right-5 top-20 hidden w-32 rotate-[-4deg] rounded-2xl border border-slate-900/[0.06] bg-white/42 p-3 opacity-45 shadow-sm sm:block" aria-hidden>
            <div className="mb-2 h-2 w-16 rounded-full bg-mindx-red/45" />
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full bg-slate-300/70" />
              <div className="h-1.5 w-4/5 rounded-full bg-slate-300/70" />
              <div className="h-1.5 w-2/3 rounded-full bg-slate-300/70" />
            </div>
          </div>
          <div className="absolute bottom-16 left-7 hidden w-36 rotate-[5deg] rounded-2xl border border-mindx-red/10 bg-white/38 p-3 opacity-45 shadow-sm sm:block" aria-hidden>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border-2 border-mindx-red/60" />
              <div className="h-2 w-20 rounded-full bg-slate-800/35" />
            </div>
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full bg-slate-300/70" />
              <div className="h-1.5 rounded-full bg-slate-300/70" />
            </div>
          </div>
          <div className="absolute bottom-4 right-4 hidden rounded-full border border-slate-900/[0.06] bg-white/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 opacity-55 sm:block" aria-hidden>
            Student growth record
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-mindx-red/15 bg-white/75 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-mindx-red shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-mindx-red" />
              Tính năng mới
            </div>
            <h2 id={TITLE_ID} className="mt-4 max-w-[420px] text-3xl font-black leading-tight tracking-normal sm:text-4xl">
              Tạo Portfolio học viên ngay trong <span className="text-mindx-red">TPS</span>
            </h2>
            <p id={DESC_ID} className="mt-3 max-w-[430px] text-sm font-semibold leading-6 text-slate-600">
              Biến dữ liệu học tập, sản phẩm cuối khóa và thành tích của học viên thành một hồ sơ public có thể chia sẻ với phụ huynh.
            </p>
          </div>
          <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center py-5 sm:py-6 lg:py-8">
            <PortfolioStackPreview />
          </div>
        </div>

        <div className="relative z-10 max-h-[calc(100vh-24px)] overflow-y-auto bg-[linear-gradient(180deg,#ffffff_0%,#fff7f8_100%)] px-5 py-6 sm:max-h-[calc(100vh-48px)] sm:px-8 sm:py-8">
          <div className="pr-10 sm:pr-8">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-mindx-red">HỒ SƠ NĂNG LỰC</p>
            <h3 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">
              Từ lớp học đến hồ sơ hoàn chỉnh trong một luồng làm việc
            </h3>
          </div>

          <div className="mt-5 grid auto-rows-fr gap-3 sm:grid-cols-3">
            {featureHighlights.map((item, index) => {
              const Icon = item.icon;
              const DetailIcon = item.detailIcon;
              return (
                <article
                  key={item.title}
                  className="relative flex min-h-[224px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 pb-12 shadow-sm transition hover:-translate-y-0.5 hover:border-mindx-red/20 hover:shadow-md"
                >
                  <span className="absolute inset-x-0 top-0 h-1 bg-slate-100" aria-hidden="true" />
                  <span
                    className={cn(
                      'absolute -bottom-14 left-1/2 grid h-24 w-24 -translate-x-1/2 place-items-center rounded-full opacity-85',
                      item.haloClass,
                    )}
                    aria-hidden="true"
                  >
                    <DetailIcon className="mb-10 h-7 w-7" />
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn('grid h-10 w-10 place-items-center rounded-xl border', item.accent)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn('text-[11px] font-black', item.numberClass)}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h4 className="mt-4 text-[13px] font-black leading-5 text-slate-950">{item.title}</h4>
                  <div className={cn('mt-2 h-0.5 w-12 rounded-full', item.lineClass)} aria-hidden="true" />
                  <p className="relative z-10 mt-4 flex-1 text-xs font-medium leading-[1.72] text-slate-500 [text-wrap:pretty]">
                    {item.description}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-slate-950 text-white">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-950">Các tính năng mới</h4>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                  Người phụ trách có thể kiểm tra nội dung và chọn trạng thái phù hợp trước khi chia sẻ.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {builderSections.map((item) => {
                const Icon = item.icon;
                return (
                  <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
                    <Icon className="h-3.5 w-3.5 text-mindx-red" />
                    {item.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={closePopup}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
            >
              Để sau
            </button>
            <button
              type="button"
              onClick={openPortfolio}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-mindx-red px-5 text-sm font-black text-white shadow-lg shadow-mindx-red/20 transition hover:bg-mindx-red-dark focus:outline-none focus:ring-4 focus:ring-mindx-red/20"
            >
              Mở Quản lý Portfolio
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default AdminPortfolioFeaturePopup;
