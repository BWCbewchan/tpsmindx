'use client';

import { useState, useEffect, useCallback } from 'react';
import { Edit3, Eye, ExternalLink, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import type { PortfolioQCStudent } from '@/lib/portfolio/types';

interface StudentDetailPanelProps {
  classId: string;
  className: string;
  centreName?: string;
  courseLine?: string;
  courseName?: string;
  teacherName?: string;
}

export default function StudentDetailPanel({
  classId,
  className,
  centreName = '',
  courseLine = '',
  courseName = '',
  teacherName = '',
}: StudentDetailPanelProps) {
  const [students, setStudents] = useState<PortfolioQCStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/portfolio/classes/${classId}/students?className=${encodeURIComponent(className)}`,
      );
      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
      } else {
        setError(data.error || 'Không thể tải dữ liệu');
      }
    } catch (err) {
      setError('Lỗi kết nối');
    } finally {
      setIsLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-mindx-red" />
        <span className="ml-2 text-sm text-neutral-500">Đang tải học viên...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 text-center text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-neutral-500">
        Không có học viên trong lớp
      </div>
    );
  }

  return (
    <div className="bg-neutral-50/80 border-t border-neutral-200">
      {/* Header */}
      <div className="px-5 py-3 border-b border-neutral-200">
        <h4 className="text-sm font-semibold text-neutral-700">
          CHI TIẾT HỌC VIÊN ({students.length})
        </h4>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
              <th className="px-5 py-2.5 w-[60px]"></th>
              <th className="px-3 py-2.5">Học viên</th>
              <th className="px-3 py-2.5">Trạng thái Sản phẩm</th>
              <th className="px-3 py-2.5 w-[140px]">Portfolio</th>
              <th className="px-3 py-2.5 w-[180px] text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {students.map((student, idx) => {
              // Generate avatar color from name
              const colors = [
                'bg-red-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
                'bg-purple-500', 'bg-pink-500', 'bg-cyan-500', 'bg-orange-500',
              ];
              const colorIdx =
                student.studentName
                  .split('')
                  .reduce((acc, c) => acc + c.charCodeAt(0), 0) %
                colors.length;
              const avatarColor = colors[colorIdx];
              const initials = student.studentName.charAt(0).toUpperCase();
              const builderParams = new URLSearchParams({
                studentId: student.studentId,
                classId,
                studentName: student.studentName,
                className,
              });
              const builderHref = student.portfolioId
                ? `/admin/kiem-soat-spck/builder/${student.portfolioId}?${builderParams.toString()}`
                : `/admin/kiem-soat-spck/builder/new?${builderParams.toString()}`;

              const totalWorks = student.representativeProduct?.totalSubmissions || (student.hasSubmission ? 1 : 0);
              const subLink = student.submissionLink || student.representativeProduct?.link;

              return (
                <tr
                  key={student.studentId}
                  className="hover:bg-white/60 transition-colors"
                >
                  {/* Avatar */}
                  <td className="px-5 py-3">
                    <div
                      className={`w-8 h-8 ${avatarColor} rounded-full flex items-center justify-center
                                  text-white text-xs font-bold shadow-sm`}
                    >
                      {initials}
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-3 py-3">
                    <span className="font-medium text-neutral-800">
                      {student.studentName}
                    </span>
                  </td>

                  {/* Representative Product Status Badge & Details */}
                  <td className="px-3 py-3">
                    {student.representativeProduct ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          {student.representativeProduct.category === 'approved' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Đã duyệt
                            </span>
                          ) : student.representativeProduct.category === 'rejected' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Bị từ chối
                            </span>
                          ) : student.representativeProduct.category === 'pending' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Chờ duyệt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 w-fit">
                              Bản nháp
                            </span>
                          )}
                          {totalWorks > 1 ? (
                            <span className="text-[10px] text-neutral-500 font-medium bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                              {totalWorks} bài nộp
                            </span>
                          ) : null}
                        </div>
                        {student.submissionTitle ? (
                          subLink ? (
                            <a
                              href={subLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-medium inline-flex items-center gap-1 truncate max-w-[200px]"
                              title={student.submissionTitle}
                            >
                              <span className="truncate">{student.submissionTitle}</span>
                              <ExternalLink size={10} className="shrink-0 text-blue-500" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-neutral-600 truncate max-w-[200px]" title={student.submissionTitle}>
                              {student.submissionTitle}
                            </span>
                          )
                        ) : null}
                      </div>
                    ) : student.hasSubmission ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Đã nộp bài
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-500 border border-neutral-200">
                        Chưa nộp
                      </span>
                    )}
                  </td>

                  {/* Portfolio status */}
                  <td className="px-3 py-3">
                    {student.portfolioStatus === 'none' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">
                        Chưa tạo
                      </span>
                    ) : student.portfolioStatus === 'draft' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Bản nháp
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Đã tạo
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3 text-right">
                    {student.portfolioStatus === 'none' ? (
                      <Link
                        href={builderHref}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-mindx-red text-white text-xs 
                                   font-medium rounded-lg hover:bg-mindx-red-dark active:scale-[0.97]
                                   transition-all shadow-sm"
                        title="Tạo Portfolio"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Tạo Portfolio
                      </Link>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        {student.portfolioSlug ? (
                          <Link
                            href={`/public/portfolio/${student.portfolioSlug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                                       text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg 
                                       hover:bg-emerald-100 transition-all"
                            title="Xem Portfolio"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Xem
                          </Link>
                        ) : null}
                        <Link
                          href={builderHref}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                                     text-amber-700 bg-amber-50 border border-amber-200 rounded-lg 
                                     hover:bg-amber-100 transition-all"
                          title="Sửa Portfolio"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Sửa
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
