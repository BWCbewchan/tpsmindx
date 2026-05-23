'use client';

import { useMemo, useState } from 'react';
import { toast } from '@/lib/app-toast';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Save, 
  Search, 
  LayoutGrid, 
  Info,
  Loader2
} from 'lucide-react';
import { GenEntry } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────
const SESSIONS = [
  { number: 1, label: 'Buổi 1', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  { number: 2, label: 'Buổi 2', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { number: 3, label: 'Buổi 3', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  { number: 4, label: 'Buổi 4', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────
type SessionSchedule = {
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  mentor: string;
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
  // Mock schedule state (GenKey -> SessionNumber -> Schedule)
  const [schedules, setSchedules] = useState<Record<string, Record<number, SessionSchedule>>>({});
  const [saving, setSaving] = useState(false);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getSchedule = (genKey: string, sessionNumber: number): SessionSchedule => {
    return schedules[genKey]?.[sessionNumber] ?? {
      date: '',
      startTime: '18:30',
      endTime: '21:00',
      location: '',
      mentor: '',
    };
  };

  const handleScheduleChange = (sessionNumber: number, field: keyof SessionSchedule, value: string) => {
    if (!activeGenKey) return;
    setSchedules(prev => {
      const genSchedules = { ...(prev[activeGenKey] ?? {}) };
      const sessionSchedule = { ...(genSchedules[sessionNumber] ?? getSchedule(activeGenKey, sessionNumber)) };
      sessionSchedule[field] = value;
      genSchedules[sessionNumber] = sessionSchedule;
      return { ...prev, [activeGenKey]: genSchedules };
    });
  };

  const handleSaveDemo = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Đã lưu bản nháp lịch training (Hệ thống Demo)');
    }, 800);
  };

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
                      Khu vực: {activeGenInfo?.regionCode === 'south' ? 'Miền Nam' : 'Miền Bắc'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveDemo}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-emerald-200 transition-all hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Lưu lịch training
                </button>
              </div>
            </div>

            {/* Sessions Grid */}
            <div className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {SESSIONS.map((session) => {
                  const schedule = getSchedule(activeGenKey, session.number);
                  return (
                    <div 
                      key={session.number}
                      className={`group relative rounded-2xl border transition-all hover:shadow-md ${session.border} ${session.bg} overflow-hidden`}
                    >
                      {/* Session Header */}
                      <div className="border-b border-white/40 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-black shadow-sm ${session.color}`}>
                            {session.number}
                          </span>
                          <span className="text-sm font-bold text-gray-900">{session.label}</span>
                        </div>
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Draft</span>
                      </div>

                      {/* Session Inputs */}
                      <div className="p-5 space-y-4 bg-white/50">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" /> Ngày học
                            </label>
                            <input
                              type="date"
                              value={schedule.date}
                              onChange={(e) => handleScheduleChange(session.number, 'date', e.target.value)}
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
                                onChange={(e) => handleScheduleChange(session.number, 'startTime', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm font-bold text-gray-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                              />
                              <span className="text-gray-400 font-bold">-</span>
                              <input
                                type="time"
                                value={schedule.endTime}
                                onChange={(e) => handleScheduleChange(session.number, 'endTime', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm font-bold text-gray-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
                            <MapPin className="h-3 w-3" /> Địa điểm / Room
                          </label>
                          <input
                            value={schedule.location}
                            onChange={(e) => handleScheduleChange(session.number, 'location', e.target.value)}
                            placeholder="VD: Phòng họp A, Link Zoom..."
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
                            <User className="h-3 w-3" /> Mentor / Người phụ trách
                          </label>
                          <input
                            value={schedule.mentor}
                            onChange={(e) => handleScheduleChange(session.number, 'mentor', e.target.value)}
                            placeholder="Tên mentor phụ trách buổi này..."
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

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
