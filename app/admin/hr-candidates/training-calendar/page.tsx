'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Filter } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { authHeaders } from '@/lib/auth-headers';
import { useAuth } from '@/lib/auth-context';
import GenOverviewTab from '../components/GenOverviewTab';
import { GenEntry } from '../types';

type RegionFilter = 'all' | 'south' | 'north';

type GenCatalogRow = {
  id: number;
  gen_name: string;
};

function toGenEntry(row: GenCatalogRow): GenEntry {
  return {
    id: row.id,
    key: row.gen_name,
    genCode: row.gen_name,
    count: 0,
    regionCode: 'all',
    regionLabel: 'Tất cả khu vực',
    isTeacher4Plus: false,
    note: 'Lịch đào tạo',
  };
}

export default function HrTrainingCalendarPage() {
  const { token } = useAuth();
  const [genEntries, setGenEntries] = useState<GenEntry[]>([]);
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [activeGenKey, setActiveGenKey] = useState('');
  const [activeGenInfo, setActiveGenInfo] = useState<{ genCode: string; regionCode: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/hr/gens', { headers: authHeaders(token) })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const catalog = Array.isArray(data.catalog) ? data.catalog : [];
        setGenEntries(catalog.map(toGenEntry));
      })
      .catch(() => {
        if (!cancelled) setGenEntries([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectedGen = useMemo(
    () => genEntries.find((entry) => entry.key === activeGenKey) ?? null,
    [activeGenKey, genEntries],
  );

  const handleSelectGen = (entry: GenEntry) => {
    setActiveGenKey(entry.key);
    setActiveGenInfo({ genCode: entry.genCode, regionCode: entry.regionCode });
  };

  const handleGenSelect = (value: string) => {
    if (!value) {
      setActiveGenKey('');
      setActiveGenInfo(null);
      return;
    }
    const entry = genEntries.find((item) => item.key === value);
    if (entry) handleSelectGen(entry);
  };

  return (
    <PageContainer>
      <div className="space-y-6 pb-16">
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/admin/hr-candidates/gen-planner?tab=overview"
              className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại GEN Planner
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900">Lịch Đào Tạo</h1>
                <p className="text-sm font-medium text-gray-500">
                  Tổng hợp lịch training của tất cả GEN, hoặc lọc để xem riêng từng GEN.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                <Filter className="h-3 w-3" />
                Khu vực
              </span>
              <select
                value={regionFilter}
                onChange={(event) => setRegionFilter(event.target.value as RegionFilter)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 shadow-sm outline-none transition focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
              >
                <option value="all">Tất cả khu vực</option>
                <option value="south">Miền Nam</option>
                <option value="north">Miền Bắc</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">GEN</span>
              <select
                value={selectedGen?.key || ''}
                onChange={(event) => handleGenSelect(event.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 shadow-sm outline-none transition focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
              >
                <option value="">Tất cả GEN</option>
                {genEntries.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.genCode}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <GenOverviewTab
          genEntries={genEntries}
          regionFilter={regionFilter}
          activeGenKey={activeGenKey}
          activeGenInfo={activeGenInfo}
          onSelectGen={handleSelectGen}
          scopeLabel={activeGenInfo ? `Lịch training GEN ${activeGenInfo.genCode}` : 'Lịch training tất cả GEN'}
          hideInfoBox
        />
      </div>
    </PageContainer>
  );
}
