'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import ClassFilterToolbar, {
  type FilterState,
} from '@/components/portfolio/ClassFilterToolbar';
import ClassListTable from '@/components/portfolio/ClassListTable';
import PortfolioQCStatsCards from '@/components/portfolio/PortfolioQCStatsCards';
import type { PortfolioQCClass } from '@/lib/portfolio/types';
import { Sparkles } from 'lucide-react';

interface CentreOption {
  id: number;
  full_name: string;
  short_code: string | null;
}

function normalizeVietnamese(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export default function KiemSoatSpckPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<PortfolioQCClass[]>([]);
  const [centres, setCentres] = useState<CentreOption[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<FilterState | null>(null);

  // Fetch classes from API with append mode support
  const fetchClasses = useCallback(
    async (filters: FilterState, targetPageIndex = 0, isAppend = false) => {
      if (isAppend) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setError(null);
      }
      setCurrentFilters(filters);

      try {
        const params = new URLSearchParams();

        if (filters.selectedCentres.length > 0) {
          params.set('centres', filters.selectedCentres.join(','));
        }
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.set('dateTo', filters.dateTo);
        const searchQuery = filters.classSearch || filters.teacherSearch;
        if (searchQuery) params.set('search', searchQuery);
        if (filters.qcStatus) params.set('qcStatus', filters.qcStatus);
        params.set('pageIndex', String(targetPageIndex));
        params.set('itemsPerPage', '50');

        const res = await fetch(
          `/api/admin/portfolio/classes?${params.toString()}`,
        );
        const responseText = await res.text();
        let data: {
          success?: boolean;
          error?: string;
          data?: PortfolioQCClass[];
          pagination?: { total?: number; pageIndex?: number; itemsPerPage?: number };
          accessibleCenters?: CentreOption[];
        };

        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(responseText || `HTTP ${res.status}`);
        }

        if (data.success) {
          const rawClasses: PortfolioQCClass[] = data.data || [];

          // Collect unique teacher options
          const teachersSet = new Set<string>();
          rawClasses.forEach((cls) => {
            if (cls.teacherName) teachersSet.add(cls.teacherName.trim());
          });
          setTeacherOptions((prev) => Array.from(new Set([...prev, ...Array.from(teachersSet)])));

          let filteredClasses = rawClasses;

          // Client-side filter by teacher name if provided
          if (filters.teacherSearch) {
            const searchNorm = normalizeVietnamese(filters.teacherSearch);
            filteredClasses = filteredClasses.filter((cls: PortfolioQCClass) => {
              const tNorm = normalizeVietnamese(cls.teacherName);
              return tNorm.includes(searchNorm);
            });
          }

          // Client-side filter by QC status
          if (filters.qcStatus) {
            filteredClasses = filteredClasses.filter(
              (cls: PortfolioQCClass) => cls.qcStatus === filters.qcStatus,
            );
          }

          if (isAppend) {
            setClasses((prev) => {
              const existingIds = new Set(prev.map((c) => c.id));
              const newItems = filteredClasses.filter((c) => !existingIds.has(c.id));
              return [...prev, ...newItems];
            });
          } else {
            setClasses(filteredClasses);
          }

          setPageIndex(targetPageIndex);
          const rawTotal = data.pagination?.total || (isAppend ? classes.length + filteredClasses.length : filteredClasses.length);
          setTotal(rawTotal);
          setHasMore(rawClasses.length > 0);

          if (data.accessibleCenters) {
            setCentres(data.accessibleCenters);
          }
        } else {
          let msg = data.error || 'Không thể tải dữ liệu';
          if (msg.includes('Authentication token is missing') || msg.includes('token LMS')) {
            msg = 'Tài khoản chưa có token kết nối LMS hoặc phiên kết nối LMS đã hết hạn. Vui lòng đăng xuất và đăng nhập lại bằng tài khoản LMS/Firebase.';
          }
          if (!isAppend) {
            setError(msg);
            setClasses([]);
          }
        }

        setHasSearched(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi kết nối tới server';
        if (!isAppend) {
          setError(message || 'Lỗi kết nối tới server');
          setClasses([]);
        }
        setHasSearched(true);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [classes.length],
  );

  // Load centres and auto-fetch classes on mount
  useEffect(() => {
    const initialFilter: FilterState = {
      selectedCentres: [],
      dateFrom: '',
      dateTo: '',
      qcStatus: '',
      teacherSearch: '',
      classSearch: '',
    };
    fetchClasses(initialFilter, 0, false);
  }, []);

  const handleFilter = useCallback(
    (filters: FilterState) => {
      fetchClasses(filters, 0, false);
    },
    [fetchClasses],
  );

  const handleLoadMore = useCallback(() => {
    if (!isLoading && !isLoadingMore && hasMore && currentFilters) {
      fetchClasses(currentFilters, pageIndex + 1, true);
    }
  }, [currentFilters, fetchClasses, hasMore, isLoading, isLoadingMore, pageIndex]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9.5 h-9.5 bg-gradient-to-br from-mindx-red to-mindx-red-dark rounded-xl flex items-center justify-center shadow-sm">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              Kiểm soát Sản phẩm cuối khóa
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Theo dõi tỷ lệ nộp bài, tình trạng điểm CP1/CP2 & báo cáo khuyết thông tin
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <ClassFilterToolbar
        centres={centres}
        teacherOptions={teacherOptions}
        onFilter={handleFilter}
        isLoading={isLoading}
      />

      {/* Enhanced Stats Summary Cards */}
      {hasSearched && (
        <PortfolioQCStatsCards classes={classes} isLoading={isLoading} totalClasses={total || classes.length} />
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <strong>Lỗi:</strong> {error}
        </div>
      )}

      {/* Class List */}
      <ClassListTable
        classes={classes}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        total={total}
      />
    </div>
  );
}
