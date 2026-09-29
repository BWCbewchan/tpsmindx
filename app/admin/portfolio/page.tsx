'use client';

import type { PortfolioAnalyticsSummary, StudentPortfolioListItem } from '@/lib/student-portfolio/types';
import { authHeaders } from '@/lib/auth-headers';
import { useAuth } from '@/lib/auth-context';
import { isPortfolioReadOnlyLeaderUser } from '@/lib/menu-permissions';
import DateRangePicker from '@/components/portfolio/DateRangePicker';
import { BarChart3, CheckCircle2, Clock3, Edit3, Eye, FilePenLine, Loader2, Search, TimerReset, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

type PortfolioListResponse = {
  success?: boolean;
  error?: string;
  data?: StudentPortfolioListItem[];
  pagination?: {
    total?: number;
    pageIndex?: number;
    itemsPerPage?: number;
  };
  analytics?: PortfolioAnalyticsSummary;
};

type TrackFilter = 'all' | 'coding' | 'robotics' | 'art';

type CentreOption = {
  id: number;
  full_name: string;
  short_code?: string | null;
};

const trackOptions: Array<{ value: TrackFilter; label: string }> = [
  { value: 'all', label: 'Tất cả khối' },
  { value: 'coding', label: 'Coding' },
  { value: 'robotics', label: 'Robotics' },
  { value: 'art', label: 'Art' },
];

const emptyAnalytics: PortfolioAnalyticsSummary = {
  portfolioCount: 0,
  totalViews: 0,
  averageViewDurationSeconds: 0,
  maxViewDurationSeconds: 0,
  projectViewCount: 0,
  viewedPortfolioCount: 0,
  topPortfolios: [],
  centreViews: [],
};

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

function formatDuration(seconds?: number | null) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  if (!total) return '0s';
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function formatPercent(value: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 1000) / 10}%`;
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function publicPortfolioHref(item: StudentPortfolioListItem) {
  if (!item.public_slug) return '';
  return `/public/portfolio/${encodeURIComponent(item.public_slug)}?mode=public`;
}

function builderHref(item: StudentPortfolioListItem) {
  const params = new URLSearchParams({
    studentId: item.student_lms_id,
    classId: item.class_lms_id,
  });
  return `/admin/kiem-soat-spck/builder/${item.id}?${params.toString()}`;
}

export default function PortfolioManagementPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<StudentPortfolioListItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('all');
  const [centres, setCentres] = useState<CentreOption[]>([]);
  const [selectedCentre, setSelectedCentre] = useState('');
  const [centreSearch, setCentreSearch] = useState('');
  const [isCentreDropdownOpen, setIsCentreDropdownOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loadingCentres, setLoadingCentres] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState<PortfolioAnalyticsSummary>(emptyAnalytics);
  const [pagination, setPagination] = useState({
    total: 0,
    pageIndex: 0,
    itemsPerPage: 25,
  });
  const isReadOnlyLeader = useMemo(() => isPortfolioReadOnlyLeaderUser(user), [user]);
  const filteredCentres = useMemo(() => {
    const keyword = normalizeSearchText(centreSearch);
    if (!keyword) return centres;
    return centres.filter((centre) => {
      const haystack = normalizeSearchText(
        [centre.full_name, centre.short_code || ''].filter(Boolean).join(' '),
      );
      return haystack.includes(keyword);
    });
  }, [centreSearch, centres]);

  const fetchPortfolios = useCallback(
    async (
      pageIndex = 0,
      search = appliedSearch,
      track = trackFilter,
      centre = selectedCentre,
      from = dateFrom,
      to = dateTo,
    ) => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          pageIndex: String(pageIndex),
          itemsPerPage: String(pagination.itemsPerPage),
        });
        if (search.trim()) params.set('search', search.trim());
        if (track !== 'all') params.set('track', track);
        if (centre) params.set('centre', centre);
        if (from) params.set('dateFrom', from);
        if (to) params.set('dateTo', to);

        const res = await fetch(`/api/admin/portfolio?${params.toString()}`, {
          cache: 'no-store',
          headers: authHeaders(token),
        });
        const json = (await res.json()) as PortfolioListResponse;
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Không thể tải danh sách portfolio');
        }

        setItems(json.data || []);
        setPagination({
          total: Number(json.pagination?.total || 0),
          pageIndex: Number(json.pagination?.pageIndex || pageIndex),
          itemsPerPage: Number(json.pagination?.itemsPerPage || pagination.itemsPerPage),
        });
        setAnalytics(json.analytics || emptyAnalytics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách portfolio');
        setItems([]);
        setAnalytics(emptyAnalytics);
      } finally {
        setLoading(false);
      }
    },
    [appliedSearch, dateFrom, dateTo, pagination.itemsPerPage, selectedCentre, token, trackFilter],
  );

  useEffect(() => {
    void fetchPortfolios(0, appliedSearch, trackFilter, selectedCentre, dateFrom, dateTo);
  }, [fetchPortfolios, appliedSearch, trackFilter, selectedCentre, dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    async function loadCentres() {
      setLoadingCentres(true);
      try {
        const res = await fetch('/api/centers-by-user', {
          cache: 'no-store',
          headers: authHeaders(token),
        });
        const json = (await res.json()) as { success?: boolean; centers?: CentreOption[] };
        if (!cancelled) {
          setCentres(Array.isArray(json.centers) ? json.centers : []);
        }
      } catch {
        if (!cancelled) setCentres([]);
      } finally {
        if (!cancelled) setLoadingCentres(false);
      }
    }
    void loadCentres();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-portfolio-centre-filter]')) {
        setIsCentreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(searchText);
  };

  const handleDelete = async (item: StudentPortfolioListItem) => {
    if (isReadOnlyLeader) {
      setError('Tài khoản leader chỉ có quyền xem portfolio.');
      return;
    }

    const confirmed = window.confirm(`Xóa portfolio của ${item.student_name}?`);
    if (!confirmed) return;

    setDeletingId(item.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/portfolio/${item.id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Không thể xóa portfolio');
      }
      await fetchPortfolios(pagination.pageIndex, appliedSearch, trackFilter, selectedCentre, dateFrom, dateTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xóa portfolio');
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(pagination.total / pagination.itemsPerPage)),
    [pagination.itemsPerPage, pagination.total],
  );
  const maxCentreViews = useMemo(
    () => Math.max(1, ...analytics.centreViews.map((item) => Number(item.view_count || 0))),
    [analytics.centreViews],
  );
  const publishedOnPage = items.filter((item) => item.status === 'published').length;
  const draftOnPage = items.filter((item) => item.status === 'draft').length;
  const statCards = [
    {
      label: 'Portfolio đã tạo',
      value: pagination.total,
      detail: 'Tổng hồ sơ theo bộ lọc hiện tại',
      Icon: BarChart3,
      accent: 'text-slate-700',
    },
    {
      label: 'Đã xuất bản',
      value: publishedOnPage,
      detail: 'Số hồ sơ đã xuất bản trên trang này',
      Icon: CheckCircle2,
      accent: 'text-emerald-700',
    },
    {
      label: 'Bản thô',
      value: draftOnPage,
      detail: 'Số hồ sơ đang là bản thô trên trang này',
      Icon: FilePenLine,
      accent: 'text-amber-700',
    },
    {
      label: 'Tổng lượt xem',
      value: analytics.totalViews,
      detail: `${analytics.viewedPortfolioCount} portfolio đã có lượt xem`,
      Icon: Eye,
      accent: 'text-[#bd0026]',
    },
    {
      label: 'Thời gian xem TB',
      value: formatDuration(analytics.averageViewDurationSeconds),
      detail: 'Trung bình mỗi phiên xem',
      Icon: Clock3,
      accent: 'text-sky-700',
    },
    {
      label: 'Xem dài nhất',
      value: formatDuration(analytics.maxViewDurationSeconds),
      detail: 'Phiên xem dài nhất',
      Icon: TimerReset,
      accent: 'text-violet-700',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#bd0026]">Portfolio</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Quản lý portfolio</h1>
            <p className="mt-1 text-sm text-slate-500">
              Theo dõi các portfolio đã tạo và thao tác nhanh theo quyền tài khoản.
            </p>
            {isReadOnlyLeader ? (
              <p className="mt-2 inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                Chế độ chỉ xem dành cho leader
              </p>
            ) : null}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:max-w-5xl lg:justify-end">
            <label className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Tìm theo tên học viên hoặc lớp"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-normal text-slate-900 outline-none transition focus:border-[#bd0026] focus:bg-white focus:ring-4 focus:ring-[#bd0026]/10"
              />
            </label>

            <div className="relative sm:w-48" data-portfolio-centre-filter>
              <button
                type="button"
                onClick={() => setIsCentreDropdownOpen((open) => !open)}
                className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-sm font-medium text-slate-700 outline-none transition hover:border-[#bd0026]/30 focus:border-[#bd0026] focus:bg-white focus:ring-4 focus:ring-[#bd0026]/10"
              >
                <span className="min-w-0 flex-1 truncate">
                  {selectedCentre || 'Tất cả cơ sở'}
                </span>
                <svg
                  className={`h-4 w-4 shrink-0 text-slate-400 transition ${isCentreDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isCentreDropdownOpen ? (
                <div className="absolute left-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 p-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={centreSearch}
                        onChange={(event) => setCentreSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.preventDefault();
                        }}
                        placeholder="Nhập tên cơ sở..."
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#bd0026]/50 focus:bg-white focus:ring-4 focus:ring-[#bd0026]/10"
                      />
                      {centreSearch ? (
                        <button
                          type="button"
                          onClick={() => setCentreSearch('')}
                          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Xóa tìm kiếm cơ sở"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCentre('');
                        setCentreSearch('');
                        setIsCentreDropdownOpen(false);
                      }}
                      className={`flex w-full items-center px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-50 ${
                        selectedCentre ? 'text-slate-700' : 'text-[#bd0026]'
                      }`}
                    >
                      Tất cả cơ sở
                    </button>
                    {loadingCentres ? (
                      <div className="px-3 py-3 text-sm font-medium text-slate-500">Đang tải cơ sở...</div>
                    ) : filteredCentres.length === 0 ? (
                      <div className="px-3 py-3 text-sm font-medium text-slate-500">Không tìm thấy cơ sở phù hợp</div>
                    ) : (
                      filteredCentres.map((centre) => (
                        <button
                          key={centre.id}
                          type="button"
                          onClick={() => {
                            setSelectedCentre(centre.full_name);
                            setCentreSearch('');
                            setIsCentreDropdownOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                            selectedCentre === centre.full_name ? 'font-bold text-[#bd0026]' : 'font-medium text-slate-700'
                          }`}
                        >
                          <span className="h-3.5 w-3.5 shrink-0 rounded border border-slate-300 bg-white">
                            {selectedCentre === centre.full_name ? (
                              <span className="block h-full w-full rounded-[3px] bg-[#bd0026]" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{centre.full_name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <label className="sr-only" htmlFor="portfolio-track-filter">
              Lọc theo khối
            </label>
            <select
              id="portfolio-track-filter"
              value={trackFilter}
              onChange={(event) => setTrackFilter(event.target.value as TrackFilter)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#bd0026] focus:bg-white focus:ring-4 focus:ring-[#bd0026]/10 sm:w-36"
            >
              {trackOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={(range) => {
                setDateFrom(range.dateFrom);
                setDateTo(range.dateTo);
              }}
              className="sm:w-56"
              popoverAlign="right"
              placeholder="Khoảng thời gian"
            />
            <button
              type="submit"
              className="h-11 rounded-xl bg-[#bd0026] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#a80022]"
            >
              Tìm
            </button>
          </form>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statCards.map(({ label, value, detail, Icon, accent }) => (
            <div
              key={label}
              className="group relative min-h-[120px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
            >
              <div className="pointer-events-none absolute -right-9 -top-10 h-28 w-28 rounded-full bg-[#bd0026]/[0.055] transition group-hover:bg-[#bd0026]/[0.085]" />
              <div className="relative flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#bd0026]/10 text-[#bd0026] transition group-hover:bg-[#bd0026] group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="max-w-[150px] text-sm font-semibold leading-snug text-slate-500">{label}</p>
              </div>
              <p className={`relative mt-4 text-2xl font-semibold leading-none tracking-tight ${accent}`}>
                {value}
              </p>
              <p className="relative mt-2 line-clamp-1 text-xs font-medium leading-relaxed text-slate-500">
                {detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.35fr_1fr_0.8fr_0.7fr_0.45fr_0.55fr_0.55fr_170px] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 max-lg:hidden">
          <span>Học viên</span>
          <span>Lớp học</span>
          <span>Cơ sở</span>
          <span>Trạng thái</span>
          <span>Lượt xem</span>
          <span>TB xem</span>
          <span>Cao nhất</span>
          <span className="text-right">Thao tác</span>
        </div>

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm font-semibold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải portfolio...
          </div>
        ) : items.length === 0 ? (
          <div className="min-h-[260px] px-5 py-16 text-center">
            <p className="text-base font-bold text-slate-900">Chưa có portfolio phù hợp</p>
            <p className="mt-1 text-sm text-slate-500">Thử đổi từ khóa tìm kiếm hoặc tạo portfolio từ màn QC.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const publicHref = publicPortfolioHref(item);
              return (
                <article
                  key={item.id}
                  className="grid gap-4 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[1.35fr_1fr_0.8fr_0.7fr_0.45fr_0.55fr_0.55fr_170px] lg:items-center"
                >
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-slate-950">{item.student_name}</h2>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Cập nhật: {formatDate(item.updated_at) || 'Chưa rõ'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{item.class_name || 'Chưa có lớp'}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{item.course_name || 'Chưa có khóa học'}</p>
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-600">{item.centre_name || '-'}</p>
                  <div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                        item.status === 'published'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      {item.status === 'published' ? 'Đã xuất bản' : 'Bản thô'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{Number(item.view_count || 0)}</p>
                    <p className="text-xs font-medium text-slate-500 lg:hidden">Lượt xem</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{formatDuration(item.avg_view_duration_seconds)}</p>
                    <p className="text-xs font-medium text-slate-500 lg:hidden">TB xem</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{formatDuration(item.max_view_duration_seconds)}</p>
                    <p className="text-xs font-medium text-slate-500 lg:hidden">Cao nhất</p>
                  </div>
                  <div className="flex items-center gap-2 lg:justify-end">
                    {publicHref ? (
                      <Link
                        href={publicHref}
                        target="_blank"
                        className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#bd0026]/40 hover:text-[#bd0026]"
                        title="Xem portfolio"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300">
                        <Eye className="h-4 w-4" />
                      </span>
                    )}
                    {!isReadOnlyLeader ? (
                      <>
                        <Link
                          href={builderHref(item)}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#bd0026]/40 hover:text-[#bd0026]"
                          title="Sửa portfolio"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item)}
                          disabled={deletingId === item.id}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Xóa portfolio"
                        >
                          {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-slate-500">
          Trang {pagination.pageIndex + 1}/{totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || pagination.pageIndex <= 0}
            onClick={() => void fetchPortfolios(pagination.pageIndex - 1, appliedSearch, trackFilter, selectedCentre, dateFrom, dateTo)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Trước
          </button>
          <button
            type="button"
            disabled={loading || pagination.pageIndex + 1 >= totalPages}
            onClick={() => void fetchPortfolios(pagination.pageIndex + 1, appliedSearch, trackFilter, selectedCentre, dateFrom, dateTo)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sau
          </button>
        </div>
      </div>

      <section className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">Portfolio được xem nhiều nhất</h2>
              <p className="mt-1 text-sm text-slate-500">Top 5 hồ sơ có nhiều phiên xem nhất theo bộ lọc hiện tại.</p>
            </div>
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Top 5</span>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
            <div className="grid grid-cols-[52px_minmax(0,1fr)_110px_120px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 max-sm:hidden">
              <span>#</span>
              <span>Portfolio</span>
              <span className="text-right">Lượt xem</span>
              <span className="text-right">Tỷ lệ</span>
            </div>
            {analytics.topPortfolios.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {analytics.topPortfolios.map((item, index) => {
                  const percent = formatPercent(Number(item.view_count || 0), analytics.totalViews);
                  return (
                    <div
                      key={`${item.id}-${index}`}
                      className="grid gap-3 px-4 py-3 text-sm transition hover:bg-slate-50 sm:grid-cols-[52px_minmax(0,1fr)_110px_120px] sm:items-center"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                          {index + 1}
                        </span>
                        <span className="text-xs font-bold uppercase text-slate-400 sm:hidden">Top portfolio</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">{item.student_name}</p>
                        <p className="mt-1 truncate text-xs font-medium text-slate-500">
                          {[item.class_name, item.centre_name].filter(Boolean).join(' · ') || 'Chưa rõ lớp/cơ sở'}
                        </p>
                      </div>
                      <p className="font-semibold text-slate-900 sm:text-right">{formatNumber(item.view_count)}</p>
                      <div className="flex items-center gap-3 sm:justify-end">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <span
                            className="block h-full rounded-full bg-[#bd0026]"
                            style={{ width: percent }}
                          />
                        </span>
                        <span className="min-w-10 text-right text-xs font-semibold text-slate-500">{percent}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm font-medium text-slate-500">
                Chưa có dữ liệu lượt xem portfolio.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950">Lượt xem theo cơ sở</h2>
              <p className="mt-1 text-sm text-slate-500">Các cơ sở có portfolio được xem nhiều nhất.</p>
            </div>
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Top 10</span>
          </div>

          <div className="mt-5">
            {analytics.centreViews.length > 0 ? (
              <div className="overflow-x-auto pb-1">
                <div className="min-w-[820px] rounded-2xl border border-slate-100 bg-slate-50/40 p-5">
                  <div className="relative h-[290px]">
                    <div className="absolute inset-x-0 bottom-16 top-2 flex flex-col justify-between">
                      {[100, 75, 50, 25, 0].map((tick) => (
                        <div key={tick} className="flex items-center gap-3">
                          <span className="w-8 text-right text-[11px] font-medium text-slate-400">
                            {Math.round((maxCentreViews * tick) / 100)}
                          </span>
                          <span className="h-px flex-1 border-t border-dashed border-slate-200" />
                        </div>
                      ))}
                    </div>

                    <div className="absolute inset-x-10 bottom-0 top-2 flex items-end justify-between gap-5">
                      {analytics.centreViews.map((item, index) => {
                        const count = Number(item.view_count || 0);
                        const height = `${Math.max(8, Math.round((count / maxCentreViews) * 100))}%`;
                        return (
                          <div key={`${item.centre_name}-${index}`} className="group flex h-full min-w-[72px] flex-1 flex-col items-center justify-end">
                            <div className="relative flex h-[212px] w-full items-end justify-center">
                              <div className="pointer-events-none absolute -top-7 rounded-lg bg-slate-950 px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-sm transition group-hover:opacity-100">
                                {formatNumber(count)} lượt
                              </div>
                              <div
                                className="w-10 rounded-t-lg bg-[#bd0026] shadow-[0_10px_18px_rgba(189,0,38,0.16)] transition duration-200 group-hover:bg-[#9f001f] group-hover:shadow-[0_12px_24px_rgba(189,0,38,0.22)] sm:w-12"
                                style={{ height }}
                              />
                            </div>
                            <div className="mt-3 w-full text-center">
                              <p className="truncate text-xs font-semibold text-slate-500" title={item.centre_name}>
                                {item.centre_name}
                              </p>
                              <p className="mt-1 text-[11px] font-medium text-slate-400">
                                {formatPercent(count, analytics.totalViews)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-medium text-slate-500">
                Chưa có dữ liệu lượt xem theo cơ sở.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
