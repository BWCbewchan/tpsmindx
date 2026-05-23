'use client';

import Modal from '@/components/Modal';
import { BookOpen, Building2, CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Users } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassSlot {
  id: string;
  classId: string;
  className: string;
  courseName: string;
  courseLineName: string;  // tên course line từ LMS (Coding/Robotics/Art)
  centreName: string;
  date: string;            // YYYY-MM-DD (local VN)
  startTime: string;       // ISO string hoặc "HH:MM+07:00"
  endTime: string;
  status: string;
  sessionHour: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse ISO → local VN time string HH:MM */
function fmtTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return iso; }
}

/** Parse ISO → local VN date key YYYY-MM-DD */
function toLocalDateKey(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.split('T')[0] ?? iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return iso.split('T')[0] ?? iso; }
}

/** Monday of the week containing `date` */
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Array of 7 dates starting from Monday */
function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Detect course category — ưu tiên courseLineName từ LMS, fallback về text matching */
function getCourseCategory(courseLineName: string, courseName: string, className: string): 'Coding' | 'Robotics' | 'Art' | 'Other' {
  // Ưu tiên courseLine name từ LMS (chính xác nhất)
  const line = courseLineName.toLowerCase();
  if (line.includes('robot') || line.includes('vex') || line.includes('lego') || line.includes('rob')) return 'Robotics';
  if (line.includes('art') || line.includes('x-art') || line.includes('xart')) return 'Art';
  if (line.includes('cod') || line.includes('scratch') || line.includes('python') ||
      line.includes('web') || line.includes('game') || line.includes('javascript') ||
      line.includes('c4k') || line.includes('c4t') || line.includes('jsa') || line.includes('jsi') ||
      line.includes('cs') || line.includes('pro')) return 'Coding';

  // Fallback: text matching trên courseName + className
  const text = `${courseName} ${className}`.toLowerCase();
  if (text.includes('robot') || text.includes('vex') || text.includes('lego') || text.includes('rob')) return 'Robotics';
  if (text.includes('art') || text.includes('x-art') || text.includes('xart') || text.includes('mỹ thuật')) return 'Art';
  if (text.includes('cod') || text.includes('scratch') || text.includes('python') ||
      text.includes('web') || text.includes('game') || text.includes('javascript') ||
      text.includes('c4k') || text.includes('c4t') || text.includes('jsa') || text.includes('jsi')) return 'Coding';
  return 'Other';
}

/** Accent + border colors per category */
function getCategoryColors(category: ReturnType<typeof getCourseCategory>) {
  switch (category) {
    case 'Coding':   return { accent: '#047857', border: '#6ee7b7', bg: 'rgba(5,150,105,0.06)' };
    case 'Robotics': return { accent: '#1e40af', border: '#93c5fd', bg: 'rgba(30,64,175,0.06)' };
    case 'Art':      return { accent: '#b45309', border: '#fcd34d', bg: 'rgba(180,83,9,0.06)' };
    default:         return { accent: '#6b7280', border: '#d1d5db', bg: 'rgba(107,114,128,0.04)' };
  }
}

function getStatusStyle(status: string): { bg: string; color: string; label: string } {
  switch (status?.toUpperCase()) {
    case 'RUNNING':    return { bg: 'rgba(5,150,105,0.1)',  color: '#047857', label: 'Đang mở' };
    case 'PREPARING':  return { bg: 'rgba(59,130,246,0.1)', color: '#1d4ed8', label: 'Chuẩn bị' };
    case 'FINISHED':
    case 'COMPLETED':  return { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: 'Đã kết thúc' };
    case 'ABANDONED':  return { bg: 'rgba(220,38,38,0.08)', color: '#dc2626', label: 'Đã hủy' };
    default:           return { bg: 'rgba(107,114,128,0.08)', color: '#6b7280', label: status || '—' };
  }
}

// ─── ClassCard ────────────────────────────────────────────────────────────────

interface ClassCardProps {
  slot: ClassSlot;
  onClick: () => void;
}

const ClassCard = memo(({ slot, onClick }: ClassCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const category = getCourseCategory(slot.courseLineName, slot.courseName, slot.className);
  const { accent, border, bg } = getCategoryColors(category);
  const statusStyle = getStatusStyle(slot.status);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: '6px 7px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        // Cố định chiều cao để tất cả card đồng đều
        height: 70,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.10)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Top: class name + course (truncate 1 dòng) */}
      <div style={{ overflow: 'hidden', flex: 1, minHeight: 0 }}>
        {/* Class name — tối đa 2 dòng */}
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#111827',
          lineHeight: 1.3,
          marginBottom: 2,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {slot.className || 'Lớp học'}
        </div>

        {/* Course — 1 dòng, truncate */}
        {slot.courseName && (
          <div style={{
            fontSize: 10,
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            overflow: 'hidden',
          }}>
            <BookOpen size={9} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {slot.courseName}
            </span>
          </div>
        )}
      </div>

      {/* Bottom: centre + status badge — luôn ở dưới cùng */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 4, flexShrink: 0 }}>
        {slot.centreName ? (
          <div style={{
            fontSize: 10,
            color: '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            overflow: 'hidden',
            flex: 1,
            minWidth: 0,
          }}>
            <MapPin size={9} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {slot.centreName}
            </span>
          </div>
        ) : <div />}

        <span style={{
          fontSize: 9,
          padding: '1px 5px',
          borderRadius: 4,
          background: statusStyle.bg,
          color: statusStyle.color,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {statusStyle.label}
        </span>
      </div>
    </div>
  );
});
ClassCard.displayName = 'ClassCard';

// ─── ClassDetailModal ─────────────────────────────────────────────────────────

interface ClassDetailModalProps {
  slot: ClassSlot;
}

function ClassDetailModal({ slot }: ClassDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'sessions'>('info');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const category = getCourseCategory(slot.courseLineName, slot.courseName, slot.className);
  const { accent } = getCategoryColors(category);
  const statusStyle = getStatusStyle(slot.status);

  // Fetch chi tiết lớp học khi mở modal
  useEffect(() => {
    if (activeTab === 'sessions' && sessions.length === 0) {
      setLoadingSessions(true);
      // TODO: Gọi API lấy danh sách buổi học của lớp
      // Tạm thời dùng mock data
      setTimeout(() => {
        setSessions([
          { sessionNumber: 1, date: '2026-05-10', status: 'completed' },
          { sessionNumber: 2, date: '2026-05-17', status: 'completed' },
          { sessionNumber: 3, date: '2026-05-24', status: 'upcoming' },
        ]);
        setLoadingSessions(false);
      }, 500);
    }
  }, [activeTab, sessions.length]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        style={{
          borderLeft: `4px solid ${accent}`,
          background: 'rgba(0,0,0,0.02)',
          borderRadius: '0 8px 8px 0',
          padding: '14px 16px',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-tight mb-1">
              {slot.className}
            </h3>
            {slot.courseName && (
              <p className="text-sm text-gray-500 flex items-center gap-1.5">
                <BookOpen size={13} />
                {slot.courseName}
              </p>
            )}
          </div>
          <button
            className="text-blue-600 hover:text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-md border border-blue-200 hover:bg-blue-50 transition-colors"
            onClick={() => {/* TODO: Làm mới dữ liệu */}}
          >
            Làm mới
          </button>
        </div>
      </div>

      {/* Thông tin ca hiện tại */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Thông tin ca hiện tại</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500 text-xs block mb-1">Lớp học/Ca:</span>
            <span className="font-semibold text-gray-900">{slot.className}</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs block mb-1">Giáo viên:</span>
            <span className="font-semibold text-gray-900">—</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs block mb-1">Cơ sở:</span>
            <span className="font-semibold text-gray-900">{slot.centreName || '—'}</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs block mb-1">Thời gian:</span>
            <span className="font-semibold text-gray-900">
              {(() => {
                const d = new Date(slot.startTime);
                if (isNaN(d.getTime())) return slot.date;
                return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
              })()} • {fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500 text-xs block mb-1">Khối:</span>
            <span className="font-semibold text-gray-900">{category}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'info'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Nhận xét giáo viên
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'sessions'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Chuyên cần
          </button>
        </div>

        {/* Tab content */}
        <div className="min-h-[200px]">
          {activeTab === 'info' && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                <p className="mb-2">
                  <span className="font-semibold">Nhận xét giáo viên:</span> Chưa có dữ liệu
                </p>
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                  Tính năng này đang được phát triển. Sẽ hiển thị nhận xét của giáo viên cho từng buổi học.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div>
              {loadingSessions ? (
                <div className="flex justify-center items-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Chưa có dữ liệu buổi học
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>Nhận xét giáo viên: <strong className="text-green-600">0 lỗi</strong></span>
                    <span>Chuyên cần: <strong className="text-green-600">0 học viên</strong></span>
                    <span>Thay đổi lịch: <strong className="text-green-600">0 buổi</strong></span>
                  </div>

                  {/* Timeline buổi học */}
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {sessions.map((session, idx) => (
                      <button
                        key={idx}
                        className={`flex-shrink-0 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                          session.status === 'completed'
                            ? 'bg-gray-100 border-gray-300 text-gray-700'
                            : 'bg-blue-50 border-blue-300 text-blue-700'
                        }`}
                      >
                        <div>B{session.sessionNumber}</div>
                        <div className="text-[10px] font-normal text-gray-500 mt-0.5">
                          {new Date(session.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Bảng chi tiết */}
                  <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 mt-4">
                    Tính năng này đang được phát triển. Sẽ hiển thị chi tiết điểm danh và nhận xét cho từng buổi học.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TabLichLopHoc() {
  const [weekMonday, setWeekMonday] = useState<Date>(() => getWeekMonday(new Date()));
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noLmsToken, setNoLmsToken] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<ClassSlot | null>(null);

  // Fetch khi tuần thay đổi — dùng from/to để cover đúng 7 ngày của tuần
  // (tránh mất dữ liệu khi tuần span qua ranh giới 2 tháng)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    setNoLmsToken(false);

    const weekEnd = new Date(weekMonday);
    weekEnd.setDate(weekMonday.getDate() + 6);

    const fromParam = formatDateKey(weekMonday);
    const toParam   = formatDateKey(weekEnd);

    fetch(`/api/user/lich-lop-hoc?from=${fromParam}&to=${toParam}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.noLmsToken) { setNoLmsToken(true); setSlots([]); return; }
        if (!json.success) { setErrorMsg(json.message || 'Không thể tải lịch lớp học.'); setSlots([]); return; }

        // Normalize date từ startTime (LMS trả ISO hoặc "HH:MM+07:00" đã được API xử lý)
        const fixed: ClassSlot[] = (json.slots || []).map((s: ClassSlot) => ({
          ...s,
          courseLineName: s.courseLineName || '',
          date: s.date || toLocalDateKey(s.startTime),
        }));

        // Chỉ giữ slot chưa qua (lớp RUNNING/PREPARING đã được filter ở API)
        const now = new Date();
        const upcoming = fixed.filter(s => {
          if (!s.startTime) return true;
          try { return new Date(s.startTime) >= now; } catch { return true; }
        });

        setSlots(upcoming);
      })
      .catch(() => { if (!cancelled) setErrorMsg('Lỗi kết nối. Vui lòng thử lại.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [weekMonday]);

  const weekDates = useMemo(() => getWeekDates(weekMonday), [weekMonday]);

  // Tính dynamic time slots từ dữ liệu thực
  const timeSlots = useMemo(() => {
    const weekStart = formatDateKey(weekDates[0]);
    const weekEnd = formatDateKey(weekDates[6]);

    const set = new Set<string>();
    slots.forEach(s => {
      if (!s.startTime || !s.endTime) return;
      const d = toLocalDateKey(s.startTime);
      if (d < weekStart || d > weekEnd) return;
      const start = fmtTime(s.startTime);
      const end = fmtTime(s.endTime);
      set.add(`${start} - ${end}`);
    });

    const sorted = Array.from(set).sort((a, b) => {
      const [aS] = a.split(' - ');
      const [bS] = b.split(' - ');
      return aS.localeCompare(bS);
    });

    return sorted.map(time => {
      const [startStr] = time.split(' - ');
      const h = parseInt(startStr.split(':')[0], 10);
      const label = h < 12 ? 'Sáng' : h < 18 ? 'Chiều' : 'Tối';
      return { time, label };
    });
  }, [slots, weekDates]);

  // Build cell map: `dateKey-timeSlot` → ClassSlot[]
  const cellMap = useMemo(() => {
    const map = new Map<string, ClassSlot[]>();
    const weekStart = formatDateKey(weekDates[0]);
    const weekEnd = formatDateKey(weekDates[6]);

    slots.forEach(s => {
      if (!s.startTime || !s.endTime) return;
      const d = toLocalDateKey(s.startTime);
      if (d < weekStart || d > weekEnd) return;
      const timeKey = `${fmtTime(s.startTime)} - ${fmtTime(s.endTime)}`;
      const cellKey = `${d}-${timeKey}`;
      if (!map.has(cellKey)) map.set(cellKey, []);
      map.get(cellKey)!.push(s);
    });
    return map;
  }, [slots, weekDates]);

  const stepWeek = (delta: number) => {
    setWeekMonday(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  };

  const goToday = () => setWeekMonday(getWeekMonday(new Date()));

  const todayKey = formatDateKey(new Date());

  const periodLabel = (() => {
    const end = weekDates[6];
    const sameMonth = weekMonday.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${weekMonday.getDate()} – ${end.getDate()} tháng ${weekMonday.getMonth() + 1}, ${weekMonday.getFullYear()}`;
    }
    return `${weekMonday.getDate()}/${weekMonday.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
  })();

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar điều hướng tuần */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <span className="font-semibold text-gray-800 text-sm">{periodLabel}</span>
          {!loading && !noLmsToken && !errorMsg && slots.length > 0 && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {slots.length} buổi
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => stepWeek(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
            aria-label="Tuần trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-gray-700"
          >
            Hôm nay
          </button>
          <button
            onClick={() => stepWeek(1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
            aria-label="Tuần sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Nội dung */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Đang tải lịch lớp học...</span>
        </div>
      ) : noLmsToken ? (
        <div className="flex flex-col items-center justify-center py-14 text-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-6">
          <CalendarDays className="w-10 h-10 text-amber-400" />
          <p className="font-semibold text-amber-800">Không có kết nối LMS</p>
          <p className="text-sm text-amber-700 max-w-sm">
            Tính năng này yêu cầu đăng nhập bằng tài khoản LMS (lms.mindx.edu.vn).
            Vui lòng đăng xuất và đăng nhập lại bằng tài khoản LMS của bạn.
          </p>
        </div>
      ) : errorMsg ? (
        <div className="flex flex-col items-center justify-center py-14 text-center gap-3 bg-red-50 border border-red-200 rounded-xl px-6">
          <p className="font-semibold text-red-700">Có lỗi xảy ra</p>
          <p className="text-sm text-red-600">{errorMsg}</p>
        </div>
      ) : (
        <>
          {/* Calendar Grid */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <div style={{ minWidth: 900 }}>
              {/* Header row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px repeat(7, minmax(110px, 1fr))',
                  borderBottom: '2px solid #e5e7eb',
                  background: '#f9fafb',
                }}
              >
                <div style={{ padding: '10px 8px', fontSize: 11, fontWeight: 600, color: '#6b7280', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                  Khung giờ
                </div>
                {weekDates.map((date, i) => {
                  const key = formatDateKey(date);
                  const isToday = key === todayKey;
                  return (
                    <div
                      key={key}
                      style={{
                        padding: '10px 8px',
                        textAlign: 'center',
                        borderRight: i < 6 ? '1px solid #e5e7eb' : undefined,
                        background: isToday ? 'rgba(59,130,246,0.06)' : undefined,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? '#2563eb' : '#374151' }}>
                        {DAYS_OF_WEEK[date.getDay()]}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: isToday ? '#2563eb' : '#9ca3af',
                        marginTop: 2,
                        fontWeight: isToday ? 700 : 400,
                      }}>
                        {date.getDate()}/{date.getMonth() + 1}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time slot rows */}
              {timeSlots.length === 0 ? (
                <div style={{ padding: '48px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  Không có buổi dạy nào trong tuần này
                </div>
              ) : (
                timeSlots.map(ts => (
                  <div
                    key={ts.time}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '110px repeat(7, minmax(110px, 1fr))',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    {/* Time label */}
                    <div style={{
                      padding: '10px 6px',
                      borderRight: '1px solid #e5e7eb',
                      background: '#f9fafb',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: 1,
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                        {ts.time}
                      </span>
                      <span style={{ fontSize: 9, color: '#9ca3af' }}>{ts.label}</span>
                    </div>

                    {/* Day cells */}
                    {weekDates.map((date, i) => {
                      const dateKey = formatDateKey(date);
                      const cellKey = `${dateKey}-${ts.time}`;
                      const cellSlots = cellMap.get(cellKey) || [];
                      const isToday = dateKey === todayKey;

                      return (
                        <div
                          key={dateKey}
                          style={{
                            padding: '5px',
                            minHeight: 86,
                            borderRight: i < 6 ? '1px solid #f3f4f6' : undefined,
                            background: isToday ? 'rgba(59,130,246,0.03)' : undefined,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                          }}
                        >
                          {cellSlots.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 20, justifyContent: 'center', color: '#d1d5db', fontSize: 11 }}>
                              —
                            </div>
                          ) : (
                            cellSlots.map(slot => (
                              <ClassCard
                                key={slot.id}
                                slot={slot}
                                onClick={() => setSelectedSlot(slot)}
                              />
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 px-1 text-xs text-gray-500">
            {[
              { label: 'Coding', color: '#047857' },
              { label: 'Robotics', color: '#1e40af' },
              { label: 'Art', color: '#b45309' },
              { label: 'Khác', color: '#6b7280' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div style={{ width: 3, height: 14, background: color, borderRadius: 2 }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal chi tiết lớp học */}
      <Modal
        isOpen={!!selectedSlot}
        onClose={() => setSelectedSlot(null)}
        title="Quản lý ca học"
      >
        {selectedSlot && <ClassDetailModal slot={selectedSlot} />}
      </Modal>
    </div>
  );
}
