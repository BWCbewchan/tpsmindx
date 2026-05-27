'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/components/PageContainer';
import { toast } from '@/lib/app-toast';
import { HrCandidateRow, HrSummary, HrPagination } from './types';
import HrCandidateStats from './components/HrCandidateStats';
import HrCandidatesFilter from './components/HrCandidatesFilter';
import HrCandidatesTable from './components/HrCandidatesTable';
import CandidateDetailDrawer from './components/CandidateDetailDrawer';
import Link from 'next/link';

const PAGE_SIZE = 25;

export default function HrCandidatesPage() {
  const [rows, setRows] = useState<HrCandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [genFilter, setGenFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [availableGens, setAvailableGens] = useState<string[]>([]);
  const [summary, setSummary] = useState<HrSummary>({
    total: 0, assigned: 0, unassigned: 0,
    byGen: {}, byRegion: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  });
  const [pagination, setPagination] = useState<HrPagination>({
    page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1,
  });

  const [selectedDetailsCandidate, setSelectedDetailsCandidate] = useState<HrCandidateRow | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); setSelectedKeys(new Set()); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchRows = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set('search', search);
      if (genFilter !== 'all') params.set('gen', genFilter);
      if (regionFilter !== 'all') params.set('region', regionFilter);

      const res = await fetch(`/api/hr/candidates?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tải dữ liệu.');

      setRows(data.rows || []);
      setSummary(data.summary || { total: 0, assigned: 0, unassigned: 0, byGen: {}, byRegion: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } });
      setPagination(data.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
      setAvailableGens(data.availableGens || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, page, search, genFilter, regionFilter]);

  useEffect(() => { fetchRows(false); }, [fetchRows]);

  const applyQuickFilter = (nextStatus: string) => {
    setStatusFilter(nextStatus);
    setPage(1);
    setSelectedKeys(new Set());
  };

  const handleRegionFilterChange = (nextRegion: string) => {
    setRegionFilter(nextRegion);
    setPage(1);
    setSelectedKeys(new Set());
  };

  const topGenStats = useMemo(() =>
    Object.entries(summary.byGen || {}).sort((a, b) => b[1] - a[1]).slice(0, 6),
    [summary.byGen]
  );

  const handleToggleSelect = (id: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedKeys.size === rows.length) setSelectedKeys(new Set());
    else setSelectedKeys(new Set(rows.map(r => String(r.id))));
  };

  return (
    <PageContainer
      title="Điều Phối Ứng Viên Đầu Vào"
      description="Quản lý danh sách ứng viên từ database — nhập thủ công hoặc import CSV."
      maxWidth="full"
      padding="md"
    >
      <div className="space-y-6 pb-20">
        {/* Stats */}
        <HrCandidateStats
          summary={summary}
          statusFilter={statusFilter}
          onFilterChange={applyQuickFilter}
          regionFilter={regionFilter}
          onRegionFilterChange={handleRegionFilterChange}
        />

        {/* Workspace */}
        <section className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <p className="text-sm font-semibold text-gray-700">Danh sách ứng viên</p>
            <Link href="/admin/hr-candidates/gen-planner"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#a1001f] text-white rounded-xl text-sm font-bold hover:bg-[#880019]">
              Kế hoạch GEN →
            </Link>
          </div>

          <HrCandidatesFilter
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            statusFilter={statusFilter}
            setStatusFilter={(v) => { setStatusFilter(v); setPage(1); setSelectedKeys(new Set()); }}
            genFilter={genFilter}
            setGenFilter={(v) => { setGenFilter(v); setPage(1); setSelectedKeys(new Set()); }}
            availableGens={availableGens}
            refreshing={refreshing}
            onRefresh={() => fetchRows(true)}
          />

          <HrCandidatesTable
            rows={rows}
            loading={loading}
            page={page}
            pageSize={PAGE_SIZE}
            pagination={pagination}
            onOpenDetails={setSelectedDetailsCandidate}
            onPageChange={(p) => setPage(p)}
            onClearFilters={() => { applyQuickFilter('all'); setGenFilter('all'); }}
            selectedKeys={selectedKeys}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
          />
        </section>
      </div>

      <CandidateDetailDrawer
        candidate={selectedDetailsCandidate}
        isOpen={selectedDetailsCandidate !== null}
        onClose={() => setSelectedDetailsCandidate(null)}
      />
    </PageContainer>
  );
}
