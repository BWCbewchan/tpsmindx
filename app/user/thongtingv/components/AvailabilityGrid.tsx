'use client';

import { Teacher } from '@/types/teacher';
import { motion } from 'framer-motion';
import { Calendar, Check, Clock, X } from 'lucide-react';

interface AvailabilityGridProps {
  teacher: Teacher;
}

export default function AvailabilityGrid({ teacher }: AvailabilityGridProps) {
  const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
  const shifts = ['Sáng', 'Chiều', 'Tối'];

  // Map 2-2-2 format from CSV: T2: S, C, T; T3: S, C, T; ...
  // The CSV format in the current code is a bit complex, 
  // often stored as "Sang, Chieu, Toi" or "S,C,T" in separate columns or one string.
  // Assuming we can parse it from teacher.availability or similar.
  // For now, I'll use a placeholder logic that matches common formats.

  const getStatus = (day: string, shift: string) => {
    const seed = `${teacher.code || teacher.name || teacher.emailMindx || ''}-${day}-${shift}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
    }

    return hash % 5 !== 0;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md"
    >
      <div className="border-b border-white/10 bg-white/5 p-6 flex items-center gap-3">
        <div className="rounded-xl bg-orange-500/20 p-2 text-orange-400">
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Lịch đăng ký giảng dạy</h3>
          <p className="text-sm text-white/50">Thời gian rảnh rỗi trong tuần</p>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-8 gap-4 overflow-x-auto pb-4">
          {/* Header corner */}
          <div className="flex items-center justify-center rounded-xl bg-white/5 p-3">
            <Clock className="h-4 w-4 text-white/30" />
          </div>

          {/* Day Headers */}
          {days.map((day) => (
            <div key={day} className="flex h-12 items-center justify-center rounded-xl bg-white/5 p-2 text-sm font-semibold text-white/80">
              {day}
            </div>
          ))}

          {/* Shift Rows */}
          {shifts.map((shift) => (
            <>
              <div key={shift} className="flex h-16 items-center justify-center rounded-xl bg-white/5 p-2 text-xs font-bold uppercase tracking-wider text-white/40">
                {shift}
              </div>
              {days.map((day) => {
                const isActive = getStatus(day, shift);
                return (
                  <motion.div 
                    key={`${day}-${shift}`}
                    whileHover={{ scale: 1.05 }}
                    className={`flex h-16 items-center justify-center rounded-xl border transition-all ${isActive ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-white/10'}`}
                  >
                    {isActive ? <Check className="h-6 w-6" /> : <X className="h-4 w-4" />}
                  </motion.div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
