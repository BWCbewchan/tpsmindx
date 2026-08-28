'use client';

import { Search, X, Filter } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';

interface CentreOption {
  id: number;
  full_name: string;
  short_code: string | null;
}

interface ClassFilterToolbarProps {
  centres: CentreOption[];
  teacherOptions?: string[];
  onFilter: (filters: FilterState) => void;
  isLoading?: boolean;
}

export interface FilterState {
  selectedCentres: string[];
  dateFrom: string;
  dateTo: string;
  qcStatus: string;
  teacherSearch: string;
  classSearch: string;
}

const INITIAL_FILTERS: FilterState = {
  selectedCentres: [],
  dateFrom: '',
  dateTo: '',
  qcStatus: '',
  teacherSearch: '',
  classSearch: '',
};

export default function ClassFilterToolbar({
  centres,
  teacherOptions = [],
  onFilter,
  isLoading = false,
}: ClassFilterToolbarProps) {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [isCentreDropdownOpen, setIsCentreDropdownOpen] = useState(false);

  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleCentre = useCallback(
    (centreName: string) => {
      const selected = filters.selectedCentres.includes(centreName)
        ? filters.selectedCentres.filter((c) => c !== centreName)
        : [...filters.selectedCentres, centreName];
      const next = { ...filters, selectedCentres: selected };
      setFilters(next);
      onFilter(next);
    },
    [filters, onFilter],
  );

  const handleSearch = useCallback(() => {
    onFilter(filters);
  }, [filters, onFilter]);

  const handleClear = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    onFilter(INITIAL_FILTERS);
  }, [onFilter]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch],
  );

  // Close centre dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-centre-dropdown]')) {
        setIsCentreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'selectedCentres') return (value as string[]).length > 0;
    return value !== '';
  });

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <Filter size={16} className="text-mindx-red" />
          Bộ lọc
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleClear}
            className="text-xs text-neutral-500 hover:text-mindx-red flex items-center gap-1 transition-colors"
          >
            <X size={12} />
            Xoá bộ lọc
          </button>
        )}
      </div>

      {/* Filter Inputs Row */}
      <div className="flex flex-wrap gap-2.5 items-center">
        {/* Centre multi-select */}
        <div className="relative" data-centre-dropdown>
          <button
            onClick={() => setIsCentreDropdownOpen(!isCentreDropdownOpen)}
            className="h-9 px-3 border border-neutral-300 rounded-lg text-sm bg-white hover:border-mindx-red/50 
                       focus:outline-none focus:ring-2 focus:ring-mindx-red/20 transition-all
                       flex items-center gap-1.5 min-w-[170px]"
          >
            <span className="text-neutral-600 truncate">
              {filters.selectedCentres.length > 0
                ? `${filters.selectedCentres.length} cơ sở`
                : 'Tất cả cơ sở'}
            </span>
            <svg
              className={`w-3.5 h-3.5 text-neutral-400 transition-transform ml-auto ${
                isCentreDropdownOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isCentreDropdownOpen && (
            <div className="absolute z-50 mt-1 w-80 max-h-64 overflow-y-auto bg-white border border-neutral-200 rounded-lg shadow-lg">
              {centres.length === 0 ? (
                <div className="p-3 text-sm text-neutral-500">
                  Không có cơ sở nào
                </div>
              ) : (
                centres.map((centre) => (
                  <label
                    key={centre.id}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={filters.selectedCentres.includes(
                        centre.full_name,
                      )}
                      onChange={() => toggleCentre(centre.full_name)}
                      className="w-3.5 h-3.5 rounded border-neutral-300 text-mindx-red focus:ring-mindx-red/20"
                    />
                    <span className="text-neutral-700 truncate">
                      {centre.full_name}
                    </span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className="h-9 px-2.5 border border-neutral-300 rounded-lg text-sm bg-white
                       hover:border-mindx-red/50 focus:outline-none focus:ring-2 focus:ring-mindx-red/20
                       transition-all w-[140px]"
          />
          <span className="text-neutral-400 text-xs">→</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className="h-9 px-2.5 border border-neutral-300 rounded-lg text-sm bg-white
                       hover:border-mindx-red/50 focus:outline-none focus:ring-2 focus:ring-mindx-red/20
                       transition-all w-[140px]"
          />
        </div>

        {/* QC Status */}
        <select
          value={filters.qcStatus}
          onChange={(e) => {
            const val = e.target.value;
            const next = { ...filters, qcStatus: val };
            setFilters(next);
            onFilter(next);
          }}
          className="h-9 px-3 border border-neutral-300 rounded-lg text-sm bg-white text-neutral-700
                     hover:border-mindx-red/50 focus:outline-none focus:ring-2 focus:ring-mindx-red/20
                     transition-all min-w-[160px]"
        >
          <option value="">Tất cả trạng thái QC</option>
          <option value="completed">✅ Đạt yêu cầu</option>
          <option value="partial">⏳ Đang xử lý</option>
          <option value="none">❌ Chưa nộp SP</option>
        </select>

        {/* Teacher search with dropdown suggestions */}
        <div className="relative">
          <input
            type="text"
            list="teacher-options"
            placeholder="Tìm giáo viên..."
            value={filters.teacherSearch}
            onChange={(e) => updateFilter('teacherSearch', e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-9 px-3 border border-neutral-300 rounded-lg text-sm bg-white 
                       placeholder:text-neutral-400 hover:border-mindx-red/50
                       focus:outline-none focus:ring-2 focus:ring-mindx-red/20 focus:border-mindx-red/50
                       transition-all w-[180px]"
          />
          {teacherOptions.length > 0 && (
            <datalist id="teacher-options">
              {teacherOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          )}
        </div>

        {/* Class search */}
        <div className="flex-1 min-w-[180px] relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="text"
            placeholder="Tìm mã lớp..."
            value={filters.classSearch}
            onChange={(e) => updateFilter('classSearch', e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-9 w-full pl-8 pr-3 border border-neutral-300 rounded-lg text-sm bg-white 
                       placeholder:text-neutral-400 hover:border-mindx-red/50
                       focus:outline-none focus:ring-2 focus:ring-mindx-red/20 focus:border-mindx-red/50
                       transition-all"
          />
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="h-9 px-5 bg-mindx-red text-white text-sm font-medium rounded-lg
                     hover:bg-mindx-red-dark active:scale-[0.98] disabled:opacity-50
                     focus:outline-none focus:ring-2 focus:ring-mindx-red/30
                     transition-all flex items-center gap-1.5"
        >
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Search size={14} />
          )}
          Tìm kiếm
        </button>
      </div>

      {/* Active filters tags */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {filters.selectedCentres.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-mindx-red/10 text-mindx-red 
                         text-xs rounded-full font-medium"
            >
              {name.length > 25 ? `${name.slice(0, 25)}…` : name}
              <button
                onClick={() => toggleCentre(name)}
                className="hover:bg-mindx-red/20 rounded-full p-0.5"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {filters.qcStatus && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
              {filters.qcStatus === 'completed'
                ? 'Đạt yêu cầu'
                : filters.qcStatus === 'partial'
                  ? 'Đang xử lý'
                  : 'Chưa nộp SP'}
              <button
                onClick={() => {
                  const next = { ...filters, qcStatus: '' };
                  setFilters(next);
                  onFilter(next);
                }}
                className="hover:bg-blue-100 rounded-full p-0.5"
              >
                <X size={10} />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
