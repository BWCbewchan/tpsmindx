'use client';

import { useMemo, useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  LayoutGrid, 
  Calendar as CalendarIcon, 
  MapPin, 
  Clock, 
  Search,
  Filter,
  Info
} from 'lucide-react';
import { GenEntry } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────
const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const SESSION_STYLES = {
  1: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', label: 'Day 1' },
  2: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Day 2' },
  3: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', label: 'Day 3' },
  4: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', label: 'Day 4' },
} as const;

// ─── Mock Data ──────────────────────────────────────────────────────────────
const MOCK_SCHEDULES = [
  { gen: '109', region: 'Hà Nội', session: 1, date: '2026-04-06', time: '18:30 - 21:00', location: 'Trường Chinh' },
  { gen: '109', region: 'Hà Nội', session: 2, date: '2026-04-08', time: '18:30 - 21:00', location: 'Trường Chinh' },
  { gen: '109', region: 'Hà Nội', session: 3, date: '2026-04-10', time: '18:30 - 21:00', location: 'Trường Chinh' },
  { gen: '109', region: 'Hà Nội', session: 4, date: '2026-04-12', time: '09:00 - 11:30', location: 'Trường Chinh' },
  { gen: '194', region: 'HCM', session: 1, date: '2026-04-07', time: '18:30 - 21:00', location: '01 Trường Chinh' },
  { gen: '108', region: 'Tỉnh Bắc', session: 1, date: '2026-04-06', time: '19:00 - 21:30', location: 'Online' },
  { gen: '107', region: 'Hà Nội', session: 3, date: '2026-04-06', time: '18:30 - 21:00', location: 'Nguyễn Phong Sắc' },
];

// ─── Utils ──────────────────────────────────────────────────────────────────
function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDateKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function buildCalendarCells(focusDate: Date) {
  const startMonth = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const endMonth = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0);
  
  const cells = [];
  
  // Padding from prev month
  const startDay = startMonth.getDay();
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(startMonth);
    d.setDate(d.getDate() - i - 1);
    cells.push({ date: d, isCurrentMonth: false });
  }
  
  // Current month
  for (let i = 1; i <= endMonth.getDate(); i++) {
    const d = new Date(focusDate.getFullYear(), focusDate.getMonth(), i);
    cells.push({ date: d, isCurrentMonth: true });
  }
  
  // Padding for next month
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(endMonth);
    d.setDate(d.getDate() + i);
    cells.push({ date: d, isCurrentMonth: false });
  }
  
  return cells;
}

// ─── Component ───────────────────────────────────────────────────────────────
interface GenOverviewTabProps {
  genEntries: GenEntry[];
  regionFilter: string;
  activeGenKey: string;
  activeGenInfo: { genCode: string; regionCode: string } | null;
  onSelectGen: (entry: GenEntry) => void;
}

export default function GenOverviewTab({ 
  genEntries, 
  regionFilter,
  activeGenKey,
  activeGenInfo,
  onSelectGen
}: GenOverviewTabProps) {
  const [focusDate, setFocusDate] = useState(new Date());

  // ── Logic ──────────────────────────────────────────────────────────────────
  const cells = useMemo(() => buildCalendarCells(focusDate), [focusDate]);

  const filteredSchedules = useMemo(() => {
    if (!activeGenKey) return MOCK_SCHEDULES;
    return MOCK_SCHEDULES.filter(s => s.gen === activeGenInfo?.genCode);
  }, [activeGenKey, activeGenInfo]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof MOCK_SCHEDULES>();
    filteredSchedules.forEach(s => {
      const key = formatDateKey(new Date(s.date));
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    });
    return map;
  }, [filteredSchedules]);

  const moveMonth = (offset: number) => {
    const next = new Date(focusDate);
    next.setMonth(next.getMonth() + offset);
    setFocusDate(next);
  };

  const currentMonthLabel = focusDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <div className="w-full animate-in fade-in duration-500">
      
      {/* ══ RIGHT: Calendar Area ══════════════════════════════════════════ */}
      <section className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {/* Calendar Header */}
        <div className="border-b border-gray-100 bg-gray-50/50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-blue-100">
                <CalendarIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 capitalize">{currentMonthLabel}</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  {activeGenKey ? `Đang xem: ${activeGenInfo?.genCode}` : 'Lịch training tất cả GEN'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => moveMonth(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button 
                onClick={() => setFocusDate(new Date())}
                className="px-4 h-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm hidden sm:flex"
              >
                Hôm nay
              </button>
              <button 
                onClick={() => moveMonth(1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 bg-gray-50/30 p-4 sm:p-6">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 shadow-sm">
            {/* Weekdays */}
            {WEEKDAY_LABELS.map(label => (
              <div key={label} className="bg-gray-50 py-3 text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
              </div>
            ))}

            {/* Days */}
            {cells.map((cell, idx) => {
              const key = formatDateKey(cell.date);
              const dayEvents = eventsByDate.get(key) || [];
              const isToday = formatDateKey(new Date()) === key;

              return (
                <div 
                  key={idx} 
                  className={`min-h-[100px] sm:min-h-[140px] bg-white p-2 transition-colors hover:bg-gray-50/50 ${!cell.isCurrentMonth ? 'opacity-40 bg-gray-50/20' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${
                      isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-gray-500'
                    }`}>
                      {cell.date.getDate()}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {dayEvents.map((ev, evIdx) => {
                      const style = SESSION_STYLES[ev.session as keyof typeof SESSION_STYLES];
                      return (
                        <div 
                          key={evIdx}
                          className={`group relative rounded-lg border p-1.5 shadow-sm transition-all hover:shadow-md cursor-help ${style.bg} ${style.text} ${style.border}`}
                          title={`${ev.gen} - Session ${ev.session}\nTime: ${ev.time}\nLoc: ${ev.location}`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[9px] font-black truncate">GEN {ev.gen}</span>
                            <span className="text-[8px] font-bold opacity-70 whitespace-nowrap">S{ev.session}</span>
                          </div>
                          <div className="hidden sm:block">
                            <div className="flex items-center gap-1 text-[8px] opacity-80 mb-0.5">
                              <Clock className="h-2 w-2" />
                              <span className="truncate">{ev.time}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[8px] opacity-80">
                              <MapPin className="h-2 w-2" />
                              <span className="truncate">{ev.location}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mr-2">Ghi chú buổi học:</p>
            {Object.entries(SESSION_STYLES).map(([num, style]) => (
              <div key={num} className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-md border ${style.bg} ${style.border}`} />
                <span className="text-xs font-bold text-gray-600">Buổi {num}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="mx-6 mb-6 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm border border-emerald-50">
            <Info className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black text-emerald-900">Tính năng Calendar</h4>
            <p className="text-xs text-emerald-700/80 leading-relaxed font-medium">
              Lịch training giúp HR theo dõi tất cả các buổi đào tạo đang diễn ra. Bạn có thể nhấn vào từng GEN ở sidebar bên trái để lọc riêng lịch của GEN đó.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
