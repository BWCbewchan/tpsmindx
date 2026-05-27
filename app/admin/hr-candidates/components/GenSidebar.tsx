'use client';

import { useMemo, useState } from 'react';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  LayoutGrid, 
  WandSparkles, 
  Plus, 
  Loader2, 
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GenEntry } from '../types';

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

function sortGenEntries(a: GenEntry, b: GenEntry, order: 'asc' | 'desc') {
  const compareByCode = a.genCode.localeCompare(b.genCode, 'vi', { numeric: true });
  if (compareByCode !== 0) {
    return order === 'desc' ? -compareByCode : compareByCode;
  }
  return a.regionCode.localeCompare(b.regionCode, 'vi');
}

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
  const [genSearchInput, setGenSearchInput] = useState('');
  const [genSortOrder, setGenSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredGens = useMemo(() => {
    const normalized = genSearchInput.trim().toLowerCase();
    const candidates = normalized
      ? genEntries.filter((entry) =>
          `${entry.genCode} ${entry.regionLabel}`.toLowerCase().includes(normalized)
        )
      : genEntries;

    return [...candidates].sort((a, b) => sortGenEntries(a, b, genSortOrder));
  }, [genEntries, genSearchInput, genSortOrder]);

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
          <div className="w-80 space-y-4 pr-1 flex flex-col h-full mt-2">
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
                  {!showCreateGen && (
                    <button
                      type="button"
                      onClick={onToggle}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-all duration-300 hover:rotate-90 hover:shadow-sm"
                      title="Đóng bộ lọc"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mb-2 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    value={genSearchInput}
                    onChange={(e) => setGenSearchInput(e.target.value)}
                    placeholder="Tìm GEN..."
                    className="w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGenSortOrder('asc')}
                    className={`flex-1 inline-flex h-8 items-center justify-center rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      genSortOrder === 'asc'
                        ? 'border-[#a1001f] bg-[#a1001f] text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Tăng dần
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenSortOrder('desc')}
                    className={`flex-1 inline-flex h-8 items-center justify-center rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      genSortOrder === 'desc'
                        ? 'border-[#a1001f] bg-[#a1001f] text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Giảm dần
                  </button>
                </div>
              </div>
              
              <div className="overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                {filteredGens.map((entry) => {
                  const isActive = activeGenKey === entry.key;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => onSelectGen(entry)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all ${
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
                      </div>
                      <span className="ml-2 shrink-0 text-[10px] font-bold text-gray-400">
                        {entry.count} UV
                      </span>
                    </button>
                  );
                })}
                {filteredGens.length === 0 && (
                  <p className="py-8 text-center text-xs text-gray-400 font-medium italic">Không tìm thấy GEN phù hợp</p>
                )}
              </div>
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
