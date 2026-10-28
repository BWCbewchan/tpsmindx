'use client';
import { useQueryState, isQueryUserEdit, resetQueryPage } from '@/lib/use-query-state'


import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/components/PageContainer';
import { authHeaders } from '@/lib/auth-headers';
import { useAuth } from '@/lib/auth-context';
import {
  BarChart3,
  CheckCircle2,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';

interface TrainingRow {
  rowNumber: number;
  key: string;
  fullName: string;
  code: string;
  userName: string;
  center: string;
  teacherStatus: string;
  block: string;
  lesson1: string;
  lesson2: string;
  lesson3: string;
  lesson4: string;
  reviewScore70: string;
  theoryScore30: string;
  totalScore: string;
  totalLesson: string;
  trainingStatus: string;
}

interface TrainingData {
  rows: TrainingRow[];
  fetchedAt: string;
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    completionRate: number;
    averageScore: number | null;
    byGen: Record<string, number>;
    byRegion: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

const PAGE_SIZE = 25;

function formatDateTime(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function isValidCenterName(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return Boolean(normalized) && !['#n/a', 'n/a', 'na', 'active'].includes(normalized);
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
  tone: 'red' | 'emerald' | 'blue' | 'amber';
}) {
  const toneClass = {
    red: 'bg-red-50 text-red-700 border-red-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  }[tone];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-gray-950 sm:text-3xl">{value}</p>
        </div>
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border sm:h-10 sm:w-10 ${toneClass}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      </div>
    </div>
  );
}

export default function PedagogyTrainingPage() {
  const { token } = useAuth();
  const [data, setData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useQueryState<string>('search', '');
  const [centerFilter, setCenterFilter] = useQueryState<string>('centre', 'all');
  const [page, setPage] = useQueryState<number>('page', 1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/hr/pedagogy-training', {
        cache: 'no-store',
        headers: authHeaders(token),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Không thể tải danh sách giáo viên.');
      setData(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const availableCenters = useMemo(() => {
    const centers = new Set((data?.rows || []).map((row) => row.center).filter(isValidCenterName));
    return Array.from(centers).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [data?.rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows || []).filter((row) => {
      const matchesSearch = !q || [row.fullName, row.code, row.userName, row.center, row.teacherStatus, row.block]
        .some((value) => (value || '').toLowerCase().includes(q));
      const matchesCenter = centerFilter === 'all' || row.center === centerFilter;
      return matchesSearch && matchesCenter;
    });
  }, [centerFilter, data?.rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    void (isQueryUserEdit() && resetQueryPage(setPage));
  }, [centerFilter, search]);

  return (
    <PageContainer
      title="Tập Huấn Sư Phạm"
      description="Danh sách giáo viên từ database để chuẩn bị mapping dữ liệu tập huấn sư phạm."
      maxWidth="full"
      padding="md"
    >
      <div className="space-y-6 pb-20">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatTile
            label="Tổng giáo viên"
            value={loading ? '...' : data?.summary.total || 0}
            icon={Users}
            tone="red"
          />
          <StatTile
            label="Hoàn thành"
            value={loading ? '...' : data?.summary.completed || 0}
            icon={CheckCircle2}
            tone="emerald"
          />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/70 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-bold text-gray-950">Danh sách tập huấn</p>
              <p className="mt-1 text-xs font-medium text-gray-500">{filteredRows.length} kết quả sau lọc</p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm tên, mã, cơ sở..."
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm font-medium outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/10 md:w-72"
                />
              </div>
              <select
                value={centerFilter}
                onChange={(e) => setCenterFilter(e.target.value)}
                className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/10"
              >
                <option value="all">Tất cả cơ sở</option>
                {availableCenters.map((center) => (
                  <option key={center} value={center}>{center}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-h-[calc(100vh-220px)] overflow-auto">
            <table className="min-w-[1280px] divide-y divide-gray-100">
              <thead className="sticky top-0 z-30 bg-white shadow-sm">
                <tr>
                  <th rowSpan={2} className="sticky left-0 z-40 min-w-56 border-r border-gray-100 bg-white px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-500">Full name</th>
                  <th rowSpan={2} className="min-w-28 bg-white px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-500">Code</th>
                  <th rowSpan={2} className="min-w-52 bg-white px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-500">Cơ sở</th>
                  <th rowSpan={2} className="min-w-32 bg-white px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-500">Status</th>
                  <th rowSpan={2} className="min-w-28 bg-white px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-500">Khối</th>
                  <th colSpan={7} className="border-x border-gray-100 bg-[#a1001f]/5 px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-[#a1001f]">Tập huấn sư phạm</th>
                  <th rowSpan={2} className="min-w-48 bg-white px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-500">Trạng thái tập huấn</th>
                </tr>
                <tr>
                  {['Lesson 1', 'Lesson 2', 'Lesson 3', 'Lesson 4', 'Điểm Duyệt giảng 70%', 'Điểm Lý thuyết 30%', 'Total Score'].map((header) => (
                    <th key={header} className="min-w-28 border-t border-gray-100 bg-white px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  Array.from({ length: 8 }).map((_, rowIndex) => (
                    <tr key={rowIndex} className="animate-pulse">
                      {Array.from({ length: 13 }).map((__, colIndex) => (
                        <td key={colIndex} className="px-4 py-3">
                          <div className={`h-4 rounded bg-gray-100 ${colIndex === 0 ? 'w-40 bg-gray-200' : colIndex % 3 === 0 ? 'w-24' : 'w-16'}`} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-10 text-center text-sm font-semibold text-gray-500">Không có dữ liệu phù hợp.</td>
                  </tr>
                ) : pagedRows.map((row) => (
                  <tr key={`${row.key}-${row.rowNumber}`} className="hover:bg-gray-50/80">
                    <td className="sticky left-0 z-10 border-r border-gray-100 bg-white px-4 py-3 font-bold text-gray-950">{row.fullName || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">{row.code || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">{row.center || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">{row.teacherStatus || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">{row.block || '-'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.lesson1 || '-'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.lesson2 || '-'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.lesson3 || '-'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.lesson4 || '-'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.reviewScore70 || '-'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.theoryScore30 || '-'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.totalScore || '-'}</td>
                    <td className="px-4 py-3 text-sm font-bold">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${
                        row.trainingStatus === 'Đã hoàn thành tập huấn'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-amber-50 text-amber-700 ring-amber-200'
                      }`}>
                        {row.trainingStatus || 'Chưa hoàn thành tập huấn'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-gray-500">
              Trang {page}/{totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trước
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
