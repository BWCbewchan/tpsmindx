'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Info,
  Monitor,
  User,
  Users,
  X
} from 'lucide-react';
import { toast } from '@/lib/app-toast';
import { authHeaders } from '@/lib/auth-headers';
import { useAuth } from '@/lib/auth-context';
import { GenEntry } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────
const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const SESSION_STYLES = {
  1: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', label: 'Day 1' },
  2: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Day 2' },
  3: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', label: 'Day 3' },
  4: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', label: 'Day 4' },
} as const;
const FALLBACK_SESSION_STYLE = { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', label: 'Day' };

export type TrainingScheduleEvent = {
  id?: number;
  gen: string;
  region: string;
  session: number;
  date: string;
  time: string;
  location: string;
  centerMapUrl?: string | null;
  mentorName?: string | null;
  trainingMode?: 'offline' | 'online';
};

type CalendarViewMode = 'day' | 'week' | 'month';

// ─── Utils ──────────────────────────────────────────────────────────────────
function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function buildCalendarCells(focusDate: Date) {
  const startMonth = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const endMonth = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0);
  
  const cells = [];
  
  // Padding from prev month
  const startDay = (startMonth.getDay() + 6) % 7;
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

function startOfWeekMonday(date: Date) {
  const d = startOfDay(date);
  const dayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayOffset);
  return d;
}

function buildWeekCells(focusDate: Date) {
  const start = startOfWeekMonday(focusDate);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, isCurrentMonth: date.getMonth() === focusDate.getMonth() };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
interface GenOverviewTabProps {
  genEntries: GenEntry[];
  regionFilter: string;
  activeGenKey: string;
  activeGenInfo: { genCode: string; regionCode: string } | null;
  onSelectGen: (entry: GenEntry) => void;
  schedules?: TrainingScheduleEvent[];
  scopeLabel?: string;
  hideInfoBox?: boolean;
}

export default function GenOverviewTab({ 
  genEntries, 
  regionFilter,
  activeGenKey,
  activeGenInfo,
  onSelectGen,
  schedules,
  scopeLabel,
  hideInfoBox = false,
}: GenOverviewTabProps) {
  const { token } = useAuth();
  const [focusDate, setFocusDate] = useState(new Date());
  const [apiSchedules, setApiSchedules] = useState<TrainingScheduleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TrainingScheduleEvent | null>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  const selectedGen = useMemo(() => {
    if (!activeGenKey) return null;
    return genEntries.find((entry) => entry.key === activeGenKey) ?? null;
  }, [activeGenKey, genEntries]);

  // ── Logic ──────────────────────────────────────────────────────────────────
  const cells = useMemo(() => {
    if (viewMode === 'day') return [{ date: focusDate, isCurrentMonth: true }];
    if (viewMode === 'week') return buildWeekCells(focusDate);
    return buildCalendarCells(focusDate);
  }, [focusDate, viewMode]);

  const filteredSchedules = useMemo(() => {
    const source = schedules || apiSchedules;
    if (!activeGenKey || schedules) return source;
    return source.filter(s => s.gen === activeGenInfo?.genCode);
  }, [activeGenKey, activeGenInfo, apiSchedules, schedules]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, TrainingScheduleEvent[]>();
    filteredSchedules.forEach(s => {
      if (!s.date) return;
      const key = formatDateKey(parseDateKey(s.date));
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    });
    return map;
  }, [filteredSchedules]);

  const moveMonth = (offset: number) => {
    const next = new Date(focusDate);
    if (viewMode === 'day') {
      next.setDate(next.getDate() + offset);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() + offset * 7);
    } else {
      next.setMonth(next.getMonth() + offset);
    }
    setFocusDate(next);
  };

  const currentMonthLabel = useMemo(() => {
    if (viewMode === 'day') {
      return focusDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }
    if (viewMode === 'week') {
      const start = startOfWeekMonday(focusDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    }
    return focusDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  }, [focusDate, viewMode]);

  const visibleWeekdayLabels = viewMode === 'day'
    ? [focusDate.toLocaleDateString('vi-VN', { weekday: 'short' })]
    : WEEKDAY_LABELS;

  useEffect(() => {
    if (schedules) return;

    let cancelled = false;
    const loadSchedules = () => {
      const params = new URLSearchParams();
      if (selectedGen?.id) params.set('genId', String(selectedGen.id));
      else if (selectedGen?.genCode) params.set('gen', selectedGen.genCode);
      if (regionFilter && regionFilter !== 'all') params.set('region', regionFilter);

      setLoading(true);
      fetch(`/api/hr/training-schedules?${params.toString()}`, {
        headers: authHeaders(token),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Không thể tải lịch training.');
          return data;
        })
        .then((data) => {
          if (!cancelled) {
            const rows = Array.isArray(data.schedules) ? data.schedules : [];
            const datedRows = rows.filter((item: TrainingScheduleEvent) => Boolean(item.date));
            setApiSchedules(datedRows);
            if (datedRows.length > 0) {
              setFocusDate(parseDateKey(datedRows[0].date));
            }
          }
        })
        .catch((error) => {
          if (!cancelled) toast.error(error instanceof Error ? error.message : 'Không thể tải lịch training.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    loadSchedules();
    window.addEventListener('hr-training-schedules-updated', loadSchedules);

    return () => {
      cancelled = true;
      window.removeEventListener('hr-training-schedules-updated', loadSchedules);
    };
  }, [regionFilter, schedules, selectedGen, token]);

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
                  {loading ? 'Đang tải lịch training...' : scopeLabel || (activeGenKey ? `Đang xem: ${activeGenInfo?.genCode}` : 'Lịch training tất cả GEN')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden rounded-xl border border-gray-200 bg-white p-1 shadow-sm sm:flex">
                {[
                  { value: 'day', label: 'Ngày' },
                  { value: 'week', label: 'Tuần' },
                  { value: 'month', label: 'Tháng' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setViewMode(item.value as CalendarViewMode)}
                    className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                      viewMode === item.value
                        ? 'bg-[#a1001f] text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
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
          <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm sm:hidden">
            {[
              { value: 'day', label: 'Ngày' },
              { value: 'week', label: 'Tuần' },
              { value: 'month', label: 'Tháng' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setViewMode(item.value as CalendarViewMode)}
                className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                  viewMode === item.value
                    ? 'bg-[#a1001f] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={`grid ${viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'} gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 shadow-sm`}>
            {/* Weekdays */}
            {visibleWeekdayLabels.map(label => (
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
                  className={`${viewMode === 'day' ? 'min-h-[420px]' : viewMode === 'week' ? 'min-h-[260px]' : 'min-h-[100px] sm:min-h-[140px]'} bg-white p-2 transition-colors hover:bg-gray-50/50 ${!cell.isCurrentMonth ? 'opacity-40 bg-gray-50/20' : ''}`}
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
                      const style = SESSION_STYLES[ev.session as keyof typeof SESSION_STYLES] || FALLBACK_SESSION_STYLE;
                      return (
                        <div 
                          key={evIdx}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedEvent(ev)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedEvent(ev);
                            }
                          }}
                          className={`group relative rounded-lg border p-1.5 text-left shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-1 ${style.bg} ${style.text} ${style.border}`}
                          title={`${ev.gen} - Session ${ev.session}\nMode: ${ev.trainingMode === 'online' ? 'Online' : 'Offline'}\nTime: ${ev.time}\nLoc: ${ev.location}`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[9px] font-black truncate">GEN {ev.gen}</span>
                            <span className="text-[8px] font-bold opacity-70 whitespace-nowrap">S{ev.session}</span>
                          </div>
                          <div className="hidden sm:block">
                            <div className="mb-0.5 text-[8px] font-bold uppercase opacity-80">
                              {ev.trainingMode === 'online' ? 'Online' : 'Offline'}
                            </div>
                            <div className="flex items-center gap-1 text-[8px] opacity-80 mb-0.5">
                              <Clock className="h-2 w-2" />
                              <span className="truncate">{ev.time}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[8px] opacity-80">
                              <MapPin className="h-2 w-2" />
                              <span className="truncate">{ev.location}</span>
                            </div>
                            {ev.mentorName && (
                              <div className="mt-0.5 truncate text-[8px] opacity-80">
                                {ev.mentorName}
                              </div>
                            )}
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
        {!hideInfoBox && (
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
        )}
      </section>

      {selectedEvent && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#a1001f] px-5 py-4 text-white">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/70">Chi tiết lịch training</p>
                <h3 className="text-lg font-black">GEN {selectedEvent.gen} · Buổi {selectedEvent.session}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Đóng chi tiết lịch"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Ngày học</p>
                  <p className="text-sm font-black text-gray-900">{selectedEvent.date}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <Clock className="h-3 w-3" />
                    Thời gian
                  </p>
                  <p className="text-sm font-black text-gray-900">{selectedEvent.time}</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {selectedEvent.trainingMode === 'online' ? <Monitor className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                  Hình thức
                </p>
                <p className="text-sm font-black text-gray-900">{selectedEvent.trainingMode === 'online' ? 'Online' : 'Offline'}</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <MapPin className="h-3 w-3" />
                  {selectedEvent.trainingMode === 'online' ? 'Link học / ghi chú' : 'Địa điểm / room'}
                </p>
                <p className="break-words text-sm font-bold text-gray-900">{selectedEvent.location || 'Chưa có thông tin'}</p>
                {selectedEvent.trainingMode === 'offline' && selectedEvent.centerMapUrl && (
                  <a
                    href={selectedEvent.centerMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs font-bold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                  >
                    Mở Google Maps
                  </a>
                )}
                {selectedEvent.trainingMode === 'online' && selectedEvent.location && /^https?:\/\//i.test(selectedEvent.location) && (
                  <a
                    href={selectedEvent.location}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs font-bold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                  >
                    Mở link học
                  </a>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <User className="h-3 w-3" />
                  Mentor / người phụ trách
                </p>
                <p className="text-sm font-bold text-gray-900">{selectedEvent.mentorName || 'Chưa có thông tin'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
