'use client';

import { motion } from 'framer-motion';
import { BookOpen, GraduationCap, Award, FileText, CheckCircle2, Star } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Certificate {
  id: number;
  certificate_name: string;
  certificate_url: string;
  certificate_type?: string;
  issue_date?: string;
  description?: string;
}

interface TrainingStat {
  teacher_code: string;
  total_score: number;
  completed_lessons?: number;
  total_lessons?: number;
}

interface EducationSectionProps {
  certificates: Certificate[];
  trainingStat?: TrainingStat;
}

export default function EducationSection({ certificates, trainingStat }: EducationSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Training Stats Card */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="col-span-1 flex flex-col rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/20 p-2 text-blue-400">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-white">Tiến độ Đào tạo</h3>
        </div>

        <div className="flex flex-1 flex-col justify-center text-center">
          <div className="relative mx-auto mb-6 flex h-32 w-32 items-center justify-center">
            <svg className="h-full w-full rotate-[-90deg]">
              <circle
                cx="64"
                cy="64"
                r="58"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-white/5"
              />
              <motion.circle
                cx="64"
                cy="64"
                r="58"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeDasharray="364.42"
                initial={{ strokeDashoffset: 364.42 }}
                animate={{ strokeDashoffset: 364.42 - (364.42 * (trainingStat?.total_score || 0)) / 100 }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="text-blue-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white">{trainingStat?.total_score || 0}</span>
              <span className="text-xs font-medium text-white/40 uppercase tracking-tighter">Điểm trung bình</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-white/5 p-4 text-left">
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase">Hoàn thành</p>
                <p className="text-lg font-bold text-white">8/12 Bài học</p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            
            <div className="flex items-center justify-between rounded-2xl bg-white/5 p-4 text-left">
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase">Rank</p>
                <p className="text-lg font-bold text-white">Chuyên gia</p>
              </div>
              <Star className="h-6 w-6 text-orange-400" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Certificates Timeline/List */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="col-span-1 flex flex-col rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md lg:col-span-2"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-purple-500/20 p-2 text-purple-400">
            <Award className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-white">Bằng cấp & Chứng chỉ</h3>
        </div>

        <div className="flex-1 space-y-4">
          {certificates.length > 0 ? (
            certificates.map((cert, index) => (
              <motion.div 
                key={cert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group relative flex cursor-pointer items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-400">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-white group-hover:text-purple-400 transition-colors">
                    {cert.certificate_name}
                  </h4>
                  <p className="text-sm text-white/50">
                    {cert.issue_date && format(new Date(cert.issue_date), 'MMMM yyyy', { locale: vi })} • {cert.certificate_type || 'Chứng chỉ chuyên môn'}
                  </p>
                </div>
                <motion.a 
                  href={cert.certificate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="rounded-full bg-white/10 p-2 text-white/60 hover:bg-white/20 hover:text-white"
                >
                  <BookOpen className="h-5 w-5" />
                </motion.a>
              </motion.div>
            ))
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center opacity-40">
              <FileText className="mb-2 h-12 w-12" />
              <p>Chưa có dữ liệu chứng chỉ</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
