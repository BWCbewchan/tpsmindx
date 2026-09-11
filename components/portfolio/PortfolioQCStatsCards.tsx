'use client';

import React from 'react';
import type { PortfolioQCClass } from '@/lib/portfolio/types';
import {
  FileCheck2,
  AlertCircle,
  TrendingUp,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';

interface PortfolioQCStatsCardsProps {
  classes: PortfolioQCClass[];
  isLoading?: boolean;
  totalClasses?: number;
}

export default function PortfolioQCStatsCards({
  classes,
  isLoading = false,
}: PortfolioQCStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-2xl border border-slate-200/80" />
        ))}
      </div>
    );
  }

  // 1. Số lượng lớp học đang load trong dự án (Yêu cầu 1)
  const loadedClassesCount = classes.length;
  const totalStudents = classes.reduce((sum, c) => sum + (c.totalStudents || 0), 0);
  const totalSubmitted = classes.reduce((sum, c) => sum + (c.submittedCount || 0), 0);
  const totalMissing = classes.reduce((sum, c) => sum + (c.missingCount || 0), 0);

  // 2. Yêu cầu 3: Tỉ lệ nộp SPCK lấy từ trung bình tổng tỉ lệ các lớp đã tính ở dưới
  const avgSubmissionRate = loadedClassesCount > 0
    ? Math.round(
        classes.reduce((sum, c) => {
          const ratio = typeof c.submissionRatio === 'number' ? c.submissionRatio : Math.round(((c.submittedCount || 0) / (c.totalStudents || 1)) * 100);
          return sum + ratio;
        }, 0) / loadedClassesCount,
      )
    : 0;

  // 3. Yêu cầu 4: Tỉ lệ các lớp đã hoàn thành đầy đủ SPCK & các mục nhỏ (Chưa nộp, Đang xử lý, Đạt yêu cầu)
  const completedClasses = classes.filter(
    (c) => c.qcStatus === 'completed' || (c.totalStudents > 0 && c.submittedCount === c.totalStudents),
  ).length;
  const partialClasses = classes.filter(
    (c) => c.qcStatus === 'partial' || (c.submittedCount > 0 && c.submittedCount < c.totalStudents),
  ).length;
  const noneClasses = classes.filter(
    (c) => c.qcStatus === 'none' || c.submittedCount === 0,
  ).length;

  const completedRate = loadedClassesCount > 0 ? Math.round((completedClasses / loadedClassesCount) * 100) : 0;

  // 4. Thống kê tỉ lệ lớp thiếu điểm Checkpoint 1 & 2 từ dữ liệu LMS GraphQL
  const missingCheckpointClasses = classes.filter(
    (c) => c.hasMissingCheckpoint || (c.totalStudents > 0 && (c.missingCount > 0 || c.qcStatus !== 'completed')),
  ).length;
  const missingCheckpointRate = loadedClassesCount > 0
    ? Math.round((missingCheckpointClasses / loadedClassesCount) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. TỔNG SỐ LỚP HỌC (Load theo số lớp đang lấy trong dự án, không có phần phụ bên dưới - Yêu cầu 1 & 2) */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 p-4 shadow-sm transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
            Tổng số lớp học
          </span>
          <div className="p-2 rounded-xl bg-amber-100/80 text-amber-700">
            <BookOpen size={18} />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-amber-950">
            {loadedClassesCount}
          </span>
          <span className="text-xs font-medium text-amber-700">lớp học finished</span>
        </div>
      </div>

      {/* 2. TỈ LỆ NỘP SPCK (Tính trung bình tỉ lệ nộp của các lớp ở dưới - Yêu cầu 3) */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 p-4 shadow-sm transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Tỉ lệ nộp SPCK
          </span>
          <div className="p-2 rounded-xl bg-emerald-100/80 text-emerald-700">
            <FileCheck2 size={18} />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-emerald-950">
            {avgSubmissionRate}%
          </span>
          <span className="text-xs font-medium text-emerald-700">
            ({totalSubmitted}/{totalStudents} học viên)
          </span>
        </div>
        <div className="mt-2.5 w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${avgSubmissionRate}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-emerald-700/90 flex items-center gap-1">
          <TrendingUp size={12} />
          <span>{totalMissing} học viên chưa nộp sản phẩm</span>
        </p>
      </div>

      {/* 3. TỈ LỆ LỚP HOÀN THÀNH 100% SPCK (Chia các mục nhỏ: Chưa nộp, Đang xử lý, Đạt yêu cầu - Yêu cầu 4) */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-sky-50/40 p-4 shadow-sm transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-sky-800 uppercase tracking-wider">
            Tỉ lệ lớp hoàn thành SPCK
          </span>
          <div className="p-2 rounded-xl bg-sky-100/80 text-sky-700">
            <CheckCircle2 size={18} />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-sky-950">
            {completedRate}%
          </span>
          <span className="text-xs font-medium text-sky-700">
            ({completedClasses}/{loadedClassesCount} lớp 100%)
          </span>
        </div>
        <div className="mt-2.5 w-full bg-sky-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-sky-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${completedRate}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {noneClasses} chưa nộp
          </span>
          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {partialClasses} đang xử lý
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {completedClasses} đạt yêu cầu
          </span>
        </div>
      </div>

      {/* 4. TỈ LỆ LỚP THIẾU ĐIỂM CHECKPOINT 1, 2 */}
      <div className="relative overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50/90 via-white to-rose-50/40 p-4 shadow-sm transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
            Tỉ lệ lớp thiếu điểm Checkpoint 1, 2
          </span>
          <div className="p-2 rounded-xl bg-rose-100/80 text-rose-700">
            <AlertCircle size={18} />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-rose-950">
            {missingCheckpointRate}%
          </span>
          <span className="text-xs font-medium text-rose-700">({missingCheckpointClasses}/{loadedClassesCount} lớp)</span>
        </div>
        <div className="mt-2.5 w-full bg-rose-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-rose-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${missingCheckpointRate}%` }}
          />
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span className="text-rose-800 font-medium">
            {missingCheckpointClasses} lớp chưa cập nhật điểm Checkpoint 1 & 2
          </span>
        </div>
      </div>
    </div>
  );
}
