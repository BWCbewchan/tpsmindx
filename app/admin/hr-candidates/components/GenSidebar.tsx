'use client';
import { useQueryState, isQueryUserEdit, resetQueryPage } from '@/lib/use-query-state'



import { useEffect, useMemo, useState } from 'react';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  WandSparkles, 
  Plus, 
  Loader2, 
  X,
  ArrowDownAZ,
  ArrowUpZA
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GenEntry, GenTrainingProgressStatus } from '../types';

interface GenSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  genEntries: GenEntry[];
  activeGenKey: string;
  onSelectGen: (entry: GenEntry) => void;
  // For Planner tab specific actions
  showCreateGen?: boolean;
  newGenName?: string;
  onNewGenNameChange?: (val: string) => void;
  onAutoCreateGen?: () => void;
  onCreateGen?: () => void;
  creatingGen?: boolean;
  suggestedNextGen?: string;
}

const GEN_PAGE_SIZE = 5;

function sortGenEntries(a: GenEntry, b: GenEntry, order: 'asc' | 'desc') {
  const compareByCode = a.genCode.localeCompare(b.genCode, 'vi', { numeric: true });
  if (compareByCode !== 0) {
    return order === 'desc' ? -compareByCode : compareByCode;
  }
  return a.regionCode.localeCompare(b.regionCode, 'vi');
}

function buildPageTabs(totalPages: number, currentPage: number): Array<number | 'gap'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  return sortedPages.reduce<Array<number | 'gap'>>((acc, page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) acc.push('gap');
    acc.push(page);
    return acc;
  }, []);
}

const PROGRESS_STYLES: Record<GenTrainingProgressStatus, string> = {
  not_open: 'border-slate-200 bg-slate-50 text-slate-600',
  in_progress: 'border-sky-200 bg-sky-50 text-sky-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export default function GenSidebar({
  isOpen,
  onToggle,
  genEntries,
  activeGenKey,
  onSelectGen,
  showCreateGen,
  newGenName,
  onNewGenNameChange,
  onAutoCreateGen,
  onCreateGen,
  creatingGen,
  suggestedNextGen,
}: GenSidebarProps) {
  const [genSearchInput, setGenSearchInput] = useQueryState<string>('genSearch', '');
  const [genSortOrder, setGenSortOrder] = useQueryState<'asc' | 'desc'>('genOrder', 'desc', { values: ["asc","desc"] });
  const [genPage, setGenPage] = useQueryState<number>('genPage', 1);
  const [recentGenKeys, setRecentGenKeys] = useState<string[]>([]);

  useEffect(() => {
    void (isQueryUserEdit() && resetQueryPage(setGenPage));
  }, [genSearchInput, genSortOrder, genEntries.length]);

  useEffect(() => {
    if (!activeGenKey) return;
    setRecentGenKeys((previous) => [
      activeGenKey,
      ...previous.filter((key) => key !== activeGenKey),
    ].slice(0, 8));
    void (isQueryUserEdit() && resetQueryPage(setGenPage));
  }, [activeGenKey]);

  const filteredGens = useMemo(() => {
    const normalized = genSearchInput.trim().toLowerCase();
    const candidates = normalized
      ? genEntries.filter((entry) =>
          `${entry.genCode} ${entry.regionLabel}`.toLowerCase().includes(normalized)
        )
      : genEntries;

    return [...candidates].sort((a, b) => {
      const recentA = recentGenKeys.indexOf(a.key);
      const recentB = recentGenKeys.indexOf(b.key);
      if (recentA !== recentB) {
        if (recentA === -1) return 1;
        if (recentB === -1) return -1;
        return recentA - recentB;
      }
      return sortGenEntries(a, b, genSortOrder);
    });
  }, [genEntries, genSearchInput, genSortOrder, recentGenKeys]);

  const genPageCount = Math.max(1, Math.ceil(filteredGens.length / GEN_PAGE_SIZE));
  const currentGenPage = Math.min(genPage, genPageCount);
  const pagedGens = filteredGens.slice(
    (currentGenPage - 1) * GEN_PAGE_SIZE,
    currentGenPage * GEN_PAGE_SIZE,
  );
  const pageTabs = buildPageTabs(genPageCount, currentGenPage);

  const handleSelectEntry = (entry: GenEntry) => {
    setRecentGenKeys((previous) => [
      entry.key,
      ...previous.filter((key) => key !== entry.key),
    ].slice(0, 8));
    setGenPage(1);
    onSelectGen(entry);
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen ? (
        <motion.aside
          key="sidebar-open"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 'auto', opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="relative flex flex-col h-full overflow-hidden"
        >
          <div className="w-full space-y-4 pr-0 xl:w-80 xl:pr-1 flex flex-col h-full mt-2">
            {/* Create GEN Section - Only for Planner tab optionally */}
            {showCreateGen && (
              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">Tạo GEN mới</p>
                  <button
                    type="button"
                    onClick={onToggle}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-all duration-300 hover:rotate-90 hover:shadow-sm"
                    title="Đóng bộ lọc"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={newGenName}
                    onChange={(e) => onNewGenNameChange?.(e.target.value)}
                    placeholder="VD: GEN 138"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
                  />
                  <button
                    type="button"
                    onClick={onAutoCreateGen}
                    disabled={creatingGen}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60"
                    title={`Tự động tạo ${suggestedNextGen}`}
                  >
                    {creatingGen ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={onCreateGen}
                    disabled={creatingGen}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#a1001f] px-3 text-sm font-bold text-white transition-colors hover:bg-[#880019] disabled:opacity-60"
                  >
                    {creatingGen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 text-[11px] font-medium text-gray-400">
                  Gợi ý tự động: {suggestedNextGen}
                </p>
              </section>
            )}

            {/* GEN List Section */}
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col flex-1 min-h-0">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">Bộ lọc GEN</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{genEntries.length} GEN</span>
                  <button
                    type="button"
                    onClick={onToggle}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-[10px] font-bold text-gray-500 transition hover:border-[#a1001f]/30 hover:bg-[#a1001f]/5 hover:text-[#a1001f]"
                    title="Thu gọn bộ lọc GEN"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Thu gọn
                  </button>
                </div>
              </div>
              <div className="mb-2 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    value={genSearchInput}
                    onChange={(e) => setGenSearchInput(e.target.value)}
                    placeholder="Tìm GEN..."
                    className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-14 text-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setGenSortOrder((order) => order === 'asc' ? 'desc' : 'asc')}
                    title={genSortOrder === 'asc' ? 'GEN cũ nhất trước' : 'GEN mới nhất trước'}
                    className="absolute right-1.5 top-1/2 inline-flex h-8 min-w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-[#a1001f] px-2 text-[10px] font-black uppercase text-white shadow-sm transition hover:bg-[#87001a]"
                  >
                    {genSortOrder === 'asc' ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpZA className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-1 pr-1">
                {pagedGens.map((entry) => {
                  const isActive = activeGenKey === entry.key;
                  const progress = entry.trainingProgress;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => handleSelectEntry(entry)}
                      className={`flex w-full items-start justify-between rounded-xl border px-3 py-2.5 text-left transition-all ${
                        isActive
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm'
                          : 'border-transparent bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-extrabold ${isActive ? 'text-emerald-700' : 'text-gray-900'}`}>{entry.genCode}</span>
                          {entry.isTeacher4Plus && (
                            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-amber-700">
                              T4+
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[10px] font-medium text-gray-400 mt-0.5">{entry.regionLabel}</p>
                        {progress && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${PROGRESS_STYLES[progress.status]}`}>
                              {progress.label}
                            </span>
                            <span className="text-[10px] font-semibold text-gray-400">
                              {progress.helper}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[10px] font-bold text-gray-400">
                          {entry.count} UV
                        </span>
                        {progress?.sessionCount ? (
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-black text-gray-500">
                            {progress.sessionCount} buổi
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
                {filteredGens.length === 0 && (
                  <p className="py-8 text-center text-xs text-gray-400 font-medium italic">Không tìm thấy GEN phù hợp</p>
                )}
              </div>

              {filteredGens.length > GEN_PAGE_SIZE && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">
                    {((currentGenPage - 1) * GEN_PAGE_SIZE) + 1}-{Math.min(currentGenPage * GEN_PAGE_SIZE, filteredGens.length)} / {filteredGens.length}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setGenPage((page) => Math.max(1, page - 1))}
                      disabled={currentGenPage <= 1}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Trang trước"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    {pageTabs.map((page, index) =>
                      page === 'gap' ? (
                        <span key={`gap-${index}`} className="px-1 text-[10px] font-bold text-gray-300">...</span>
                      ) : (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setGenPage(page)}
                          className={`h-7 min-w-7 rounded-lg px-2 text-[11px] font-black transition ${
                            page === currentGenPage
                              ? 'bg-[#a1001f] text-white shadow-sm'
                              : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      onClick={() => setGenPage((page) => Math.min(genPageCount, page + 1))}
                      disabled={currentGenPage >= genPageCount}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Trang sau"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </motion.aside>
      ) : (
        <motion.div
          key="sidebar-closed"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="flex flex-col gap-3"
        >
          {/* Minimized toggle placeholder or handle could go here if needed */}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
