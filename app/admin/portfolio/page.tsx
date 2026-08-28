'use client';

import type { StudentPortfolioListItem } from '@/lib/student-portfolio/types';
import { authHeaders } from '@/lib/auth-headers';
import { useAuth } from '@/lib/auth-context';
import { Edit3, Eye, Loader2, Search, Trash2 } from 'lucide-react';
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
};

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
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
  return `/admin/portfolio-qc/builder/${item.id}?${params.toString()}`;
}

export default function PortfolioManagementPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<StudentPortfolioListItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    total: 0,
    pageIndex: 0,
    itemsPerPage: 25,
  });

  const fetchPortfolios = useCallback(
    async (pageIndex = 0, search = appliedSearch) => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          pageIndex: String(pageIndex),
          itemsPerPage: String(pagination.itemsPerPage),
        });
        if (search.trim()) params.set('search', search.trim());

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách portfolio');
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [appliedSearch, pagination.itemsPerPage, token],
  );

  useEffect(() => {
    void fetchPortfolios(0, appliedSearch);
  }, [fetchPortfolios, appliedSearch]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(searchText);
  };

  const handleDelete = async (item: StudentPortfolioListItem) => {
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
      await fetchPortfolios(pagination.pageIndex, appliedSearch);
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

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#bd0026]">Portfolio</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Quản lý portfolio</h1>
            <p className="mt-1 text-sm text-slate-500">
              Theo dõi các portfolio đã tạo và thao tác nhanh với từng học viên.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex w-full gap-2 lg:max-w-md">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Tìm theo tên học viên hoặc lớp"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#bd0026] focus:bg-white focus:ring-4 focus:ring-[#bd0026]/10"
              />
            </label>
            <button
              type="submit"
              className="h-11 rounded-xl bg-[#bd0026] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#a80022]"
            >
              Tìm
            </button>
          </form>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-2xl font-black text-slate-950">{pagination.total}</p>
            <p className="text-xs font-bold uppercase text-slate-500">Portfolio đã tạo</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-2xl font-black text-emerald-600">
              {items.filter((item) => item.status === 'published').length}
            </p>
            <p className="text-xs font-bold uppercase text-slate-500">Đã xuất bản trên trang này</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-2xl font-black text-amber-600">
              {items.filter((item) => item.status === 'draft').length}
            </p>
            <p className="text-xs font-bold uppercase text-slate-500">Bản thô trên trang này</p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.7fr_190px] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 max-lg:hidden">
          <span>Học viên</span>
          <span>Lớp học</span>
          <span>Cơ sở</span>
          <span>Trạng thái</span>
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
                  className="grid gap-4 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_190px] lg:items-center"
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
            onClick={() => void fetchPortfolios(pagination.pageIndex - 1)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Trước
          </button>
          <button
            type="button"
            disabled={loading || pagination.pageIndex + 1 >= totalPages}
            onClick={() => void fetchPortfolios(pagination.pageIndex + 1)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}
