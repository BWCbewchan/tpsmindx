'use client';

import DOMPurify from 'isomorphic-dompurify';
import { BookOpen, CheckCircle2, ClipboardList, MessageSquareText, UserRound, XCircle } from 'lucide-react';

interface StudentAttendanceRow {
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
}

interface StudentInfo {
  id: string;
  fullName: string;
}

interface StudentInsightsPanelProps {
  students: StudentInfo[];
  studentAttendance?: StudentAttendanceRow[];
  summary?: string;
  homework?: string;
  teacherNames?: string[];
}

function statusMeta(status?: string) {
  const value = String(status || '').toUpperCase();
  if (['PRESENT', 'ATTENDED', 'DONE'].includes(value)) {
    return {
      label: 'Có mặt',
      icon: CheckCircle2,
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (value.includes('ABSENT')) {
    return {
      label: value.includes('NOTICE') ? 'Vắng có phép' : 'Vắng',
      icon: XCircle,
      className: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }
  return {
    label: status || 'Chưa điểm danh',
    icon: ClipboardList,
    className: 'bg-slate-50 text-slate-600 border-slate-200',
  };
}

function getCommentText(attendance?: StudentAttendanceRow): string {
  const direct = String(attendance?.comment || '').trim();
  if (direct) return direct;

  const areas = attendance?.commentByAreas || [];
  return areas
    .map(area => String(area.content || '').trim())
    .filter(Boolean)
    .join('\n');
}

function stripHtml(html?: string): string {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeHtml(html?: string): string {
  return DOMPurify.sanitize(String(html || ''), {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'span', 'div'],
    ALLOWED_ATTR: ['style'],
  });
}

export default function StudentInsightsPanel({
  students,
  studentAttendance = [],
  summary,
  homework,
  teacherNames = [],
}: StudentInsightsPanelProps) {
  const attendanceByStudent = new Map(
    studentAttendance
      .filter(row => row.student?.id)
      .map(row => [row.student!.id, row] as const),
  );

  const rows = students.map(student => {
    const attendance = attendanceByStudent.get(student.id);
    return {
      student,
      attendance,
      comment: getCommentText(attendance),
      status: statusMeta(attendance?.status),
    };
  });

  const commentedCount = rows.filter(row => row.comment).length;
  const absentCount = rows.filter(row => String(row.attendance?.status || '').toUpperCase().includes('ABSENT')).length;
  const summaryText = stripHtml(summary);
  const homeworkText = stripHtml(homework);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Học viên</div>
          <div className="mt-1 text-xl font-bold text-slate-900">{students.length}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs text-emerald-700">Có nhận xét</div>
          <div className="mt-1 text-xl font-bold text-emerald-800">{commentedCount}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <div className="text-xs text-rose-700">Vắng</div>
          <div className="mt-1 text-xl font-bold text-rose-800">{absentCount}</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="text-xs text-blue-700">Giáo viên</div>
          <div className="mt-1 text-sm font-semibold text-blue-800 line-clamp-2">
            {teacherNames.length ? teacherNames.join(', ') : '—'}
          </div>
        </div>
      </div>

      {(summaryText || homeworkText) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Nội dung buổi học
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{summaryText || 'Chưa có nội dung'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2">
              <ClipboardList className="w-4 h-4 text-amber-600" />
              Bài tập về nhà
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{homeworkText || 'Chưa có bài tập'}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <MessageSquareText className="w-4 h-4 text-blue-600" />
            Nhận xét học viên trong buổi
          </div>
          <div className="text-xs text-slate-500">{rows.length} học viên</div>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Chưa có danh sách học viên</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map(({ student, attendance, comment, status }) => {
              const StatusIcon = status.icon;
              return (
                <div key={student.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                    <div className="flex items-start gap-3 min-w-0 lg:w-64">
                      <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
                        <UserRound className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-900 truncate">
                          {attendance?.student?.fullName || student.fullName || 'Học viên'}
                        </div>
                        <div className="text-xs text-slate-500 truncate">ID: {student.id}</div>
                      </div>
                    </div>

                    <div className="lg:w-36 flex-shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${status.className}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status.label}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      {comment ? (
                        <div
                          className="text-sm text-slate-700 leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold [&_b]:font-semibold"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment) }}
                        />
                      ) : (
                        <p className="text-sm text-slate-400 italic">Chưa có nhận xét cho học viên này</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
