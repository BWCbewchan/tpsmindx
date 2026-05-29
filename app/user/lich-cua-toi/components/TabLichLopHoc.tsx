'use client';

import StudentInsightsPanel from './StudentInsightsPanel';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { BookOpen, Building2, CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Users, Sparkles } from 'lucide-react';
import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassSlot {
  id: string;
  classId: string;
  className: string;
  students: Array<{ id: string; fullName: string }>;
  courseName: string;
  courseLineName: string;  // tên course line từ LMS (Coding/Robotics/Art)
  centreName: string;
  date: string;            // YYYY-MM-DD (local VN)
  startTime: string;       // ISO string hoặc "HH:MM+07:00"
  endTime: string;
  status: string;
  sessionHour: number | null;
  summary?: string;
  homework?: string;
  teacherNames?: string[];
  classSlots?: ClassSlot[];
  studentAttendance?: Array<{
    _id?: string;
    status?: string;
    comment?: string;
    sendCommentStatus?: string;
    commentByAreas?: Array<{
      content?: string;
      grade?: number | null;
      commentAreaId?: string;
      type?: string;
      courseProcessFinalEvaluationTitle?: string | null;
    }>;
    student?: {
      id: string;
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      imageUrl?: string;
    };
  }>;
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

function getTimeRangeKey(slot: Pick<ClassSlot, 'startTime' | 'endTime'>): string {
  return `${fmtTime(slot.startTime)} - ${fmtTime(slot.endTime)}`;
}

function getTimeRangeSortValue(timeRange: string): number {
  const [start] = timeRange.split(' - ');
  const [hour = '0', minute = '0'] = start.split(':');
  return Number(hour) * 60 + Number(minute);
}

function getTimeRangeLabel(timeRange: string): string {
  const minutes = getTimeRangeSortValue(timeRange);
  if (minutes < 12 * 60) return 'Sáng';
  if (minutes < 18 * 60) return 'Chiều';
  return 'Tối';
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
  const category = useMemo(
    () => getCourseCategory(slot.courseLineName, slot.courseName, slot.className),
    [slot.courseLineName, slot.courseName, slot.className]
  );
  const colors = useMemo(() => getCategoryColors(category), [category]);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200"
      style={{'--category-border': colors.border} as React.CSSProperties}
    >
      <div className="border-l-4 rounded-l-md" style={{borderLeftColor: 'var(--category-border)'}}>
        <div className="p-3">
          <p className="font-semibold text-sm text-gray-800 line-clamp-1">{slot.className}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>{fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
            <Building2 className="w-3 h-3" />
            <span className="line-clamp-1">{slot.centreName}</span>
          </div>
        </div>
      </div>
    </button>
  );
});
ClassCard.displayName = 'ClassCard';


// ─── ClassDetailPanel ─────────────────────────────────────────────────────────

function ClassDetailPanel({
  slot,
  fromDate,
  toDate,
}: {
  slot: ClassSlot;
  fromDate: string;
  toDate: string;
}): React.ReactNode {
  const router = useRouter();
  const [activeSlot, setActiveSlot] = useState<ClassSlot>(slot);
  const classSlots = useMemo(
    () => (slot.classSlots && slot.classSlots.length > 0 ? slot.classSlots : [slot])
      .slice()
      .sort((a, b) => new Date(a.date || a.startTime).getTime() - new Date(b.date || b.startTime).getTime()),
    [slot]
  );

  // Tìm buổi học mới nhất (buổi gần nhất với hôm nay hoặc trong tương lai)
  const latestSessionIndex = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Tìm buổi đầu tiên >= hôm nay
    const futureIndex = classSlots.findIndex(s => {
      const sessionDate = new Date(s.date || s.startTime);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate >= now;
    });
    
    // Nếu có buổi trong tương lai, trả về buổi đó
    if (futureIndex !== -1) return futureIndex;
    
    // Nếu không, trả về buổi cuối cùng (buổi gần nhất trong quá khứ)
    return classSlots.length - 1;
  }, [classSlots]);

  useEffect(() => {
    setActiveSlot(slot);
  }, [slot]);

  const category = useMemo(
    () => getCourseCategory(slot.courseLineName, slot.courseName, slot.className),
    [slot.courseLineName, slot.courseName, slot.className]
  );
  const colors = useMemo(() => getCategoryColors(category), [category]);
  const statusStyle = useMemo(() => getStatusStyle(slot.status), [slot.status]);

  // Hàm xử lý khi bấm nút AI
  const handleAIAnalysis = async () => {
    const sessionNumber = latestSessionIndex + 1;
    
    // Tạo URL với query params để tìm giáo trình
    const params = new URLSearchParams({
      course: slot.courseName || '',
      session: `buoi${sessionNumber}`,
      class: slot.classId || '',
      className: slot.className || '',
      analyze: 'true', // Flag để trigger AI analysis
    });
    
    router.push(`/user/giao-trinh-chuyen-mon?${params.toString()}`);
  };

  return (
    <div className="relative">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-gray-50 rounded-t-lg border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className={`mb-2 inline-flex items-center gap-2 rounded-full py-1 px-3 text-xs font-semibold`} style={{backgroundColor: statusStyle.bg, color: statusStyle.color}}>
              {statusStyle.label}
            </div>
            <h2 className="text-lg font-bold text-gray-900">{slot.className}</h2>
          </div>
          <div className="flex-shrink-0 ml-4">
            <button
              title="Làm mới"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
              onClick={() => {/* TODO: Làm mới dữ liệu */}}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V4a1 1 0 011-1zm12 1a1 1 0 100-2H9a1 1 0 00-1 1v5a1 1 0 102 0V9h4.001A5.002 5.002 0 0014.001 13H11a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 00-1-1h-2.101A7.002 7.002 0 004.399 15.434a1 1 0 101.885-.666A5.002 5.002 0 0114.001 9H16a1 1 0 100-2h-3.999z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-400" />
            <span>{new Date(activeSlot.date).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>{fmtTime(activeSlot.startTime)} - {fmtTime(activeSlot.endTime)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span>{slot.centreName}</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gray-400" />
            <span>{slot.courseName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span>{slot.students?.length || 0} học viên</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full" style={{backgroundColor: colors.accent}}></div>
            </div>
            <span className="font-semibold text-gray-900">{category}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 p-4 sm:p-5">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Danh sách buổi học</h3>
            <span className="text-xs text-gray-500">{classSlots.length} buổi</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {classSlots.map((sessionSlot, index) => {
              const isActive = sessionSlot.id === activeSlot.id;
              const isLatest = index === latestSessionIndex;
              const attendanceCount = sessionSlot.studentAttendance?.length || 0;
              return (
                <div key={sessionSlot.id} className="flex-shrink-0 flex flex-col gap-2">
                  <button
                    onClick={() => setActiveSlot(sessionSlot)}
                    className={`min-w-[116px] rounded-xl border-2 px-3 py-2 text-left transition ${
                      isActive
                        ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm'
                        : isLatest
                        ? 'border-green-500 bg-white text-gray-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-xs font-bold">Buổi {index + 1}</div>
                    <div className="mt-1 text-[11px] text-current opacity-80">
                      {new Date(sessionSlot.date || sessionSlot.startTime).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </div>
                    <div className="mt-1 text-[11px] text-current opacity-70">
                      {fmtTime(sessionSlot.startTime)} - {fmtTime(sessionSlot.endTime)}
                    </div>
                    <div className="mt-1 text-[11px] text-current opacity-70">
                      {attendanceCount}/{sessionSlot.students?.length || 0} điểm danh
                    </div>
                  </button>
                  {isLatest && (
                    <Button
                      size="xs"
                      variant="default"
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md"
                      onClick={handleAIAnalysis}
                    >
                      <Sparkles className="w-3 h-3" />
                      Phân tích AI
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <StudentInsightsPanel
          students={activeSlot.students}
          studentAttendance={activeSlot.studentAttendance || []}
          summary={activeSlot.summary}
          homework={activeSlot.homework}
          teacherNames={activeSlot.teacherNames || []}
        />
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
  const [selectedClass, setSelectedClass] = useState<ClassSlot | null>(null);

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

        // Normalize dữ liệu từ API
        const fixed: ClassSlot[] = (json.slots || []).map((s: any) => ({
          ...s,
          courseLineName: s.courseLineName || '',
          date: toLocalDateKey(s.date || s.startTime),
          students: (s.students || []).slice().sort((a: any, b: any) =>
            String(a.fullName || '').localeCompare(String(b.fullName || '')),
          ),
        }));

        setSlots(fixed);
      })
      .catch(() => { if (!cancelled) setErrorMsg('Lỗi kết nối. Vui lòng thử lại.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [weekMonday]);

  const weekDates = useMemo(() => getWeekDates(weekMonday), [weekMonday]);
  const timeRanges = useMemo(() => {
    return Array.from(new Set(slots.map(getTimeRangeKey)))
      .filter(range => range !== ' - ')
      .sort((a, b) => getTimeRangeSortValue(a) - getTimeRangeSortValue(b));
  }, [slots]);

  const slotsByDateTime = useMemo(() => {
    return slots.reduce((acc, slot) => {
      const timeRange = getTimeRangeKey(slot);
      acc[slot.date] = acc[slot.date] || {};
      acc[slot.date][timeRange] = acc[slot.date][timeRange] || [];
      acc[slot.date][timeRange].push(slot);
      return acc;
    }, {} as Record<string, Record<string, ClassSlot[]>>);
  }, [slots]);

  const stepWeek = (direction: -1 | 1) => {
    setWeekMonday(prev => {
      const next = new Date(prev);
      setSelectedClass(null); // Đóng modal khi chuyển tuần
      next.setDate(prev.getDate() + 7 * direction);
      return next;
    });
  };

  const goToday = () => {
    setSelectedClass(null); // Đóng modal
    setWeekMonday(getWeekMonday(new Date()));
  };

  return (
    <>
      {/* Week navigator */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Tuần {new Date(weekMonday).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' })} - {new Date(new Date(weekMonday).setDate(weekMonday.getDate() + 6)).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' })}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => stepWeek(-1)} className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={goToday} className="px-3 py-1.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition">Hôm nay</button>
          <button onClick={() => stepWeek(1)} className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-gray-200 rounded-lg">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          noLmsToken ? (
            <div className="p-6 text-center text-gray-600 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-800">Chưa kết nối LMS</h4>
              <p className="mt-1 text-sm">Vui lòng đăng nhập bằng tài khoản LMS để xem lịch lớp học.</p>
            </div>
          ) :
          errorMsg ? (
            <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg">{errorMsg}</div>
          ) : slots.length === 0 ? (
            <div className="text-center text-gray-500 py-10 text-sm">
              Không có lớp học nào trong tuần này.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1180px] grid grid-cols-[112px_repeat(7,minmax(140px,1fr))] gap-px bg-gray-200">
                <div className="bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700">
                  Khung giờ
                </div>
                {weekDates.map((date) => {
                  const isToday = formatDateKey(new Date()) === formatDateKey(date);
                  return (
                    <div key={formatDateKey(date)} className="bg-gray-50 px-3 py-3 text-center">
                      <p className="text-xs font-medium text-gray-500">{DAYS_OF_WEEK[date.getDay()]}</p>
                      <p className={`mt-1 text-sm font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                        {date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                      </p>
                    </div>
                  );
                })}

                {timeRanges.map((timeRange) => (
                  <Fragment key={timeRange}>
                    <div className="bg-gray-50 px-3 py-4 border-r border-gray-200">
                      <div className="text-sm font-semibold text-gray-900">{timeRange}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">
                        {getTimeRangeLabel(timeRange)}
                      </div>
                    </div>

                    {weekDates.map((date) => {
                      const dateKey = formatDateKey(date);
                      const cellSlots = slotsByDateTime[dateKey]?.[timeRange] || [];
                      const groupedByCentre = cellSlots.reduce((acc, slot) => {
                        const key = slot.centreName || 'Không rõ cơ sở';
                        (acc[key] = acc[key] || []).push(slot);
                        return acc;
                      }, {} as Record<string, ClassSlot[]>);

                      return (
                        <div key={`${dateKey}-${timeRange}`} className="bg-white min-h-[132px] p-2">
                          {cellSlots.length === 0 ? (
                            <div className="h-full min-h-[96px] flex items-center justify-center text-xs text-gray-300">—</div>
                          ) : (
                            <div className="space-y-2">
                              {Object.entries(groupedByCentre).map(([centreName, centreSlots]) => (
                                <div key={centreName} className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                                  <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-200 pb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 truncate">
                                      {centreName}
                                    </span>
                                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                                      {centreSlots.length}
                                    </span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {centreSlots.map(slot => (
                                      <ClassCard
                                        key={slot.id}
                                        slot={slot}
                                        onClick={() => setSelectedClass(slot)}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* Modal chi tiết lớp học & insights học viên */}
      {selectedClass && (
        <Modal maxWidth="7xl" 
          isOpen={!!selectedClass}
          onClose={() => setSelectedClass(null)}
          title="Chi tiết lớp học"
        >
          <ClassDetailPanel
            slot={selectedClass}
            fromDate={formatDateKey(weekMonday)}
            toDate={formatDateKey(new Date(new Date(weekMonday).setDate(weekMonday.getDate() + 6)))}
          />
        </Modal>
      )}
    </>
  );
}
