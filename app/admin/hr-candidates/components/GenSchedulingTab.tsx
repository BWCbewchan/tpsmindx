'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/app-toast';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Save, 
  Info,
  Loader2,
  Monitor,
  Plus,
  Trash2,
  Users,
  Edit3,
  X,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/auth-headers';
import { GenEntry } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────
const SESSION_STYLES = [
  { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
  { color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100' },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────
type SessionSchedule = {
  date: string;
  startTime: string;
  endTime: string;
  centerId: string;
  location: string;
  centerMapUrl: string;
  centerAddress: string;
  mentorCode: string;
  mentorName: string;
  mentorEmail: string;
  trainingMode: 'offline' | 'online';
};

type CenterOption = {
  id: number;
  short_code: string | null;
  full_name: string;
  display_name: string | null;
  region: string | null;
  map_url: string | null;
  address: string | null;
};

type MentorOption = {
  code: string;
  full_name: string;
  email: string | null;
  role_code: string | null;
  role_name: string | null;
  center: string | null;
};

type ApiSchedule = {
  session: number;
  date: string | null;
  startTime: string;
  endTime: string;
  centerId: number | null;
  location: string;
  centerMapUrl: string | null;
  centerAddress: string | null;
  mentorCode: string | null;
  mentorName: string | null;
  mentorEmail: string | null;
  trainingMode: 'offline' | 'online';
};

interface GenSchedulingTabProps {
  genEntries: GenEntry[];
  regionFilter: 'all' | 'south' | 'north';
  activeGenKey: string;
  activeGenInfo: { genCode: string; regionCode: string } | null;
  onSelectGen: (entry: GenEntry) => void;
}

export default function GenSchedulingTab({ 
  genEntries, 
  regionFilter,
  activeGenKey,
  activeGenInfo,
  onSelectGen
}: GenSchedulingTabProps) {
  const { token } = useAuth();
  const [schedules, setSchedules] = useState<Record<string, Record<number, SessionSchedule>>>({});
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSessionNumber, setEditingSessionNumber] = useState<number | null>(null);

  const selectedGen = useMemo(() => {
    if (!activeGenKey) return null;
    return genEntries.find((entry) => entry.key === activeGenKey) ?? null;
  }, [activeGenKey, genEntries]);

  const headerRegionLabel = useMemo(() => {
    const code = activeGenInfo?.regionCode?.toLowerCase();
    if (code === 'south' || code === '1' || code === '3') return 'Miền Nam';
    if (code === 'north' || code === '2' || code === '4' || code === '5') return 'Miền Bắc';
    if (regionFilter === 'south') return 'Miền Nam';
    if (regionFilter === 'north') return 'Miền Bắc';
    return 'Tất cả khu vực';
  }, [activeGenInfo?.regionCode, regionFilter]);

  const activeSessionNumbers = useMemo(() => {
    const numbers = Object.keys(schedules[activeGenKey] ?? {})
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0)
      .sort((a, b) => a - b);

    return numbers.length > 0 ? numbers : [1];
  }, [activeGenKey, schedules]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getSessionStyle = (sessionNumber: number) => {
    return SESSION_STYLES[(sessionNumber - 1) % SESSION_STYLES.length];
  };

  const getSchedule = (genKey: string, sessionNumber: number): SessionSchedule => {
    return schedules[genKey]?.[sessionNumber] ?? {
      date: '',
      startTime: '18:30',
      endTime: '21:00',
      centerId: '',
      location: '',
      centerMapUrl: '',
      centerAddress: '',
      mentorCode: '',
      mentorName: '',
      mentorEmail: '',
      trainingMode: 'offline',
    };
  };

  const handleScheduleChange = <K extends keyof SessionSchedule>(
    sessionNumber: number,
    field: K,
    value: SessionSchedule[K]
  ) => {
    if (!activeGenKey) return;
    setSchedules(prev => {
      const genSchedules = { ...(prev[activeGenKey] ?? {}) };
      const sessionSchedule = { ...(genSchedules[sessionNumber] ?? getSchedule(activeGenKey, sessionNumber)) };
      sessionSchedule[field] = value;
      genSchedules[sessionNumber] = sessionSchedule;
      return { ...prev, [activeGenKey]: genSchedules };
    });
  };

  const handleCenterChange = (sessionNumber: number, centerId: string) => {
    const center = centers.find((item) => String(item.id) === centerId);
    const location = center ? (center.display_name || center.full_name) : '';
    handleScheduleChange(sessionNumber, 'centerId', centerId);
    handleScheduleChange(sessionNumber, 'location', location);
    handleScheduleChange(sessionNumber, 'centerMapUrl', center?.map_url || '');
    handleScheduleChange(sessionNumber, 'centerAddress', center?.address || '');
  };

  const handleMentorChange = (sessionNumber: number, mentorCode: string) => {
    const mentor = mentors.find((item) => item.code === mentorCode);
    handleScheduleChange(sessionNumber, 'mentorCode', mentorCode);
    handleScheduleChange(sessionNumber, 'mentorName', mentor?.full_name || '');
    handleScheduleChange(sessionNumber, 'mentorEmail', mentor?.email || '');
  };

  const handleTrainingModeChange = (sessionNumber: number, trainingMode: 'offline' | 'online') => {
    handleScheduleChange(sessionNumber, 'trainingMode', trainingMode);
    if (trainingMode === 'online') {
      handleScheduleChange(sessionNumber, 'centerId', '');
      handleScheduleChange(sessionNumber, 'centerMapUrl', '');
      handleScheduleChange(sessionNumber, 'centerAddress', '');
      handleScheduleChange(sessionNumber, 'location', '');
    }
  };

  const materializeCurrentSchedules = () => {
    return activeSessionNumbers.reduce<Record<number, SessionSchedule>>((acc, sessionNumber) => {
      acc[sessionNumber] = getSchedule(activeGenKey, sessionNumber);
      return acc;
    }, {});
  };

  const handleAddSession = () => {
    if (!activeGenKey) return;
    const nextSessionNumber = Math.max(0, ...activeSessionNumbers) + 1;
    setSchedules((prev) => ({
      ...prev,
      [activeGenKey]: {
        ...materializeCurrentSchedules(),
        [nextSessionNumber]: getSchedule(activeGenKey, nextSessionNumber),
      },
    }));
    setEditingSessionNumber(nextSessionNumber);
  };

  const handleRemoveSession = (sessionNumber: number) => {
    if (!activeGenKey) return;
    if (activeSessionNumbers.length <= 1) {
      toast.error('Cần giữ ít nhất 1 buổi training.');
      return;
    }

    setSchedules((prev) => {
      const nextGenSchedules = { ...materializeCurrentSchedules() };
      delete nextGenSchedules[sessionNumber];

      const renumbered = Object.keys(nextGenSchedules)
        .map(Number)
        .sort((a, b) => a - b)
        .map((key) => nextGenSchedules[key])
        .reduce<Record<number, SessionSchedule>>((acc, schedule, index) => {
        acc[index + 1] = schedule;
        return acc;
      }, {});

      return { ...prev, [activeGenKey]: renumbered };
    });
    setEditingSessionNumber(null);
  };

  const handleSave = async () => {
    if (!selectedGen) return;

    setSaving(true);
    try {
      const invalidSession = activeSessionNumbers
        .map((sessionNumber) => {
        const schedule = getSchedule(activeGenKey, sessionNumber);
          const missingFields = [
            !schedule.date ? 'ngày học' : '',
            !schedule.startTime ? 'giờ bắt đầu' : '',
            !schedule.endTime ? 'giờ kết thúc' : '',
            !schedule.trainingMode ? 'hình thức training' : '',
            !schedule.location ? (schedule.trainingMode === 'online' ? 'link học online' : 'địa điểm/room') : '',
            !schedule.mentorCode ? 'mentor/người phụ trách' : '',
          ].filter(Boolean);

          return missingFields.length > 0
            ? { sessionNumber, missingFields }
            : null;
        })
        .find(Boolean);

      if (invalidSession) {
        setEditingSessionNumber(invalidSession.sessionNumber);
        toast.error(`Buổi ${invalidSession.sessionNumber} còn thiếu: ${invalidSession.missingFields.join(', ')}.`);
        return;
      }

      const payload = {
        genId: selectedGen.id,
        genName: selectedGen.genCode,
        sessions: activeSessionNumbers.map((sessionNumber) => {
          const schedule = getSchedule(activeGenKey, sessionNumber);
          return {
            sessionNumber,
            title: `Buổi ${sessionNumber}`,
            date: schedule.date || null,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            centerId: schedule.centerId || null,
            location: schedule.location || null,
            mentorCode: schedule.mentorCode || null,
            mentorName: schedule.mentorName || null,
            mentorEmail: schedule.mentorEmail || null,
            trainingMode: schedule.trainingMode,
            status: 'scheduled',
          };
        }),
      };

      const res = await fetch('/api/hr/training-schedules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu lịch training.');

      window.dispatchEvent(new CustomEvent('hr-training-schedules-updated'));
      toast.success(`Đã lưu lịch training cho GEN ${selectedGen.genCode}`);
      setEditingSessionNumber(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu lịch training.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!activeGenKey || !selectedGen) return;

    let cancelled = false;
    const params = new URLSearchParams();
    if (selectedGen.id) params.set('genId', String(selectedGen.id));
    else params.set('gen', selectedGen.genCode);
    if (regionFilter !== 'all') params.set('region', regionFilter);

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
        if (cancelled) return;
        setCenters(Array.isArray(data.centers) ? data.centers : []);
        setMentors(Array.isArray(data.mentors) ? data.mentors : []);

        const next: Record<number, SessionSchedule> = {};
        for (const item of (Array.isArray(data.schedules) ? data.schedules : []) as ApiSchedule[]) {
          next[item.session] = {
            date: item.date || '',
            startTime: item.startTime || '18:30',
            endTime: item.endTime || '21:00',
            centerId: item.centerId ? String(item.centerId) : '',
            location: item.location || '',
            centerMapUrl: item.centerMapUrl || '',
            centerAddress: item.centerAddress || '',
            mentorCode: item.mentorCode || '',
            mentorName: item.mentorName || '',
            mentorEmail: item.mentorEmail || '',
            trainingMode: item.trainingMode || 'offline',
          };
        }
        if (Object.keys(next).length === 0) {
          next[1] = getSchedule(activeGenKey, 1);
        }
        setSchedules((prev) => ({ ...prev, [activeGenKey]: next }));
        setEditingSessionNumber(null);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Không thể tải lịch training.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeGenKey, selectedGen, regionFilter, token]);

  return (
    <div className="w-full">
      {/* ══ RIGHT: Scheduling Content ═════════════════════════════════════ */}
      <section className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">

        {/* Empty state */}
        {!activeGenKey ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-gray-400 border border-gray-100">
              <Calendar className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Chưa chọn GEN</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-xs">
              Vui lòng chọn một GEN từ danh sách bên trái để bắt đầu xếp lịch đào tạo.
            </p>
          </div>
        ) : (
          <>
            {/* Header: GEN Info + Actions */}
            <div className="border-b border-gray-100 bg-gray-50/50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-emerald-100">
                    <Calendar className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900">Lịch đào tạo {activeGenInfo?.genCode}</h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                      Khu vực: {headerRegionLabel}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#a1001f] px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-[#a1001f]/25 transition-all hover:bg-[#87001a] disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Lưu lịch training
                </button>
              </div>
            </div>

            {/* Sessions Grid */}
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-gray-900">Danh sách buổi training</h3>
                  <p className="text-xs font-medium text-gray-500">Thêm hoặc bỏ từng buổi theo lộ trình thực tế của GEN.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddSession}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#a1001f] px-4 py-2 text-xs font-black text-white shadow-sm shadow-[#a1001f]/20 transition hover:bg-[#87001a]"
                >
                  <Plus className="h-4 w-4" />
                  Thêm buổi
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="grid grid-cols-[48px_minmax(0,1fr)_84px] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 sm:grid-cols-[64px_1fr_140px_120px] sm:gap-3 sm:px-4">
                  <span>Buổi</span>
                  <span>Thông tin training</span>
                  <span className="hidden sm:block">Hình thức</span>
                  <span className="text-right">Thao tác</span>
                </div>
                {activeSessionNumbers.map((sessionNumber) => {
                  const schedule = getSchedule(activeGenKey, sessionNumber);
                  const sessionStyle = getSessionStyle(sessionNumber);
                  return (
                    <div
                      key={sessionNumber}
                      className="grid grid-cols-[48px_minmax(0,1fr)_84px] items-center gap-2 border-b border-gray-100 px-3 py-4 last:border-b-0 sm:grid-cols-[64px_1fr_140px_120px] sm:gap-3 sm:px-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black shadow-sm ${sessionStyle.bg} ${sessionStyle.color} ring-1 ${sessionStyle.border}`}>
                          {sessionNumber}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-gray-900">Buổi {sessionNumber}</span>
                          <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase text-gray-500 ring-1 ring-gray-200 sm:hidden">
                            {schedule.trainingMode === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold text-gray-500">
                          {schedule.date || 'Chưa chọn ngày'} · {schedule.startTime} - {schedule.endTime}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-400">
                          {schedule.location || 'Chưa có địa điểm/link'}{schedule.mentorName ? ` · ${schedule.mentorName}` : ''}
                        </p>
                      </div>

                      <div className="hidden sm:block">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
                          schedule.trainingMode === 'online'
                            ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                            : 'bg-[#a1001f]/5 text-[#a1001f] ring-1 ring-[#a1001f]/10'
                        }`}>
                          {schedule.trainingMode === 'online' ? <Monitor className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                          {schedule.trainingMode === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingSessionNumber(sessionNumber)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-[#a1001f]/20 hover:bg-[#a1001f]/5 hover:text-[#a1001f] sm:h-9 sm:w-9"
                          aria-label={`Sửa buổi ${sessionNumber}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSession(sessionNumber)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:h-9 sm:w-9"
                          aria-label={`Xóa buổi ${sessionNumber}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {editingSessionNumber !== null && (() => {
                const schedule = getSchedule(activeGenKey, editingSessionNumber);
                const sessionStyle = getSessionStyle(editingSessionNumber);

                return (
                  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                      <div className="sticky top-0 z-10 flex items-center justify-between bg-[#a1001f] px-5 py-4 text-white">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-sm font-black text-white ring-1 ring-white/30">
                            {editingSessionNumber}
                          </span>
                          <div>
                            <h3 className="text-base font-black text-white">Thiết lập Buổi {editingSessionNumber}</h3>
                            <p className="text-xs font-semibold text-white/75">Cập nhật thời gian, hình thức, địa điểm và mentor.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingSessionNumber(null)}
                          className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                          aria-label="Đóng modal"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="space-y-5 p-5">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" /> Ngày học
                            </label>
                            <input
                              type="date"
                              value={schedule.date}
                              onChange={(e) => handleScheduleChange(editingSessionNumber, 'date', e.target.value)}
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                            />
                          </div>
                          <div className="space-y-1.5 text-right">
                             <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center justify-end gap-1.5">
                              <Clock className="h-3 w-3" /> Thời gian
                            </label>
                            <div className="flex items-center gap-1 group">
                              <input
                                type="time"
                                value={schedule.startTime}
                                onChange={(e) => handleScheduleChange(editingSessionNumber, 'startTime', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm font-bold text-gray-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                              />
                              <span className="text-gray-400 font-bold">-</span>
                              <input
                                type="time"
                                value={schedule.endTime}
                                onChange={(e) => handleScheduleChange(editingSessionNumber, 'endTime', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm font-bold text-gray-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
                            <Monitor className="h-3 w-3" /> Hình thức training
                          </label>
                          <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1 shadow-sm ring-1 ring-gray-200">
                            <button
                              type="button"
                              onClick={() => handleTrainingModeChange(editingSessionNumber, 'offline')}
                              className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${
                                schedule.trainingMode === 'offline'
                                  ? 'bg-[#a1001f] text-white shadow-sm'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <Users className="h-4 w-4" />
                              Offline
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTrainingModeChange(editingSessionNumber, 'online')}
                              className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${
                                schedule.trainingMode === 'online'
                                  ? 'bg-[#a1001f] text-white shadow-sm'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <Monitor className="h-4 w-4" />
                              Online
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
                            <MapPin className="h-3 w-3" />
                            {schedule.trainingMode === 'online' ? 'Link học / ghi chú' : 'Địa điểm / Room'}
                          </label>
                          {schedule.trainingMode === 'offline' && (
                            <select
                              value={schedule.centerId}
                              onChange={(e) => handleCenterChange(editingSessionNumber, e.target.value)}
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                            >
                              <option value="">Chọn center / địa điểm...</option>
                              {centers.map((center) => (
                                <option key={center.id} value={center.id}>
                                  {center.display_name || center.full_name}
                                  {center.region ? ` - ${center.region}` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                          <input
                            value={schedule.location}
                            onChange={(e) => handleScheduleChange(editingSessionNumber, 'location', e.target.value)}
                            placeholder={schedule.trainingMode === 'online' ? 'Link Zoom/Meet/Teams...' : 'Room hoặc ghi chú địa điểm...'}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                          />
                          {(schedule.centerMapUrl || schedule.centerAddress) && (
                            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                              {schedule.centerAddress && (
                                <p className="mb-1 line-clamp-2 text-blue-900">{schedule.centerAddress}</p>
                              )}
                              {schedule.centerMapUrl && (
                                <a
                                  href={schedule.centerMapUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-700 underline underline-offset-2 hover:text-blue-900"
                                >
                                  Mở Google Maps
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
                            <User className="h-3 w-3" /> Mentor / Người phụ trách
                          </label>
                          <select
                            value={schedule.mentorCode}
                            onChange={(e) => handleMentorChange(editingSessionNumber, e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                          >
                            <option value="">Chọn Leader / TE...</option>
                            {mentors.map((mentor) => (
                              <option key={mentor.code} value={mentor.code}>
                                {mentor.full_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setEditingSessionNumber(null)}
                          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                        >
                          Đóng
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSessionNumber(null)}
                          className="rounded-xl bg-[#a1001f] px-4 py-2 text-sm font-bold text-white shadow-sm shadow-[#a1001f]/25 transition hover:bg-[#87001a]"
                        >
                          Xong
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-100 p-5 flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                  <Info className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-blue-900">Lưu ý quan trọng</h4>
                  <p className="text-sm text-blue-700/80 leading-relaxed font-medium">
                    Lịch đào tạo này sẽ được hiển thị cho tất cả ứng viên thuộc GEN đã chọn. Vui lòng kiểm tra kỹ thời gian và địa điểm trước khi lưu chính thức.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
