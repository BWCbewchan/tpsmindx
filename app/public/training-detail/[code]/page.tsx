'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface VideoScore {
  video_id: string;
  video_title: string;
  video_link: string | null;
  video_description: string;
  score: number | null;
  completion_status: string | null;
  time_spent_seconds: number;
  viewed_at: string | null;
  completed_at: string | null;
  submission_id: number | null;
  attempt_logs: {
    submission_id: number;
    assignment_id: number;
    attempt_number: number;
    score: number | null;
    total_points: number | null;
    percentage: number | null;
    status: string;
    created_at: string | null;
    submitted_at: string | null;
    graded_at: string | null;
    answers_count: number;
  }[];
  answers: Record<string, string> | null;
}

interface TeacherDetail {
  teacher_code: string;
  full_name: string;
  center: string;
  teaching_block: string;
  total_score: number;
  status: string;
}

interface ApiResponse {
  success: boolean;
  teacher: TeacherDetail;
  video_scores: VideoScore[];
  stats?: {
    total_public_videos: number;
    watched_videos: number;
  };
  error?: string;
}

function formatTime(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'completed') {
    return <Badge variant="success" size="sm" shape="pill">✓ Hoàn thành</Badge>;
  }
  if (status === 'in_progress' || status === 'watched') {
    return <Badge variant="info" size="sm" shape="pill">👁 Đã xem</Badge>;
  }
  return <Badge variant="default" size="sm" shape="pill">— Chưa xem</Badge>;
}

export default function TrainingDetailPage() {
  const params = useParams();
  const code = params.code as string;
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'log'>('overview');
  const videoScores = data?.video_scores || [];

  const allAttemptLogs = useMemo(() => {
    // Đánh số thứ tự lại theo từng video (1, 2, 3...) thay vì dùng attempt_number từ DB
    // vì DB có thể có gaps (lần 1 bị bỏ qua do không có answers)
    const videoAttemptCounters = new Map<string, number>();

    const flattened = videoScores.flatMap((video) =>
      (video.attempt_logs || []).map((attempt) => {
        const key = String(video.video_id);
        const displayIndex = (videoAttemptCounters.get(key) ?? 0) + 1;
        videoAttemptCounters.set(key, displayIndex);
        return {
          ...attempt,
          display_attempt_number: displayIndex,
          video_id: video.video_id,
          video_title: video.video_title,
          latest_time: attempt.graded_at || attempt.submitted_at || attempt.created_at,
        };
      })
    );

    return flattened.sort((a, b) => {
      const aTime = a.latest_time ? new Date(a.latest_time).getTime() : 0;
      const bTime = b.latest_time ? new Date(b.latest_time).getTime() : 0;
      return bTime - aTime;
    });
  }, [videoScores]);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/public/training-detail?code=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then((res: ApiResponse) => {
        if (res.success) setData(res);
        else setError(res.error || 'Không tìm thấy dữ liệu');
      })
      .catch(() => setError('Lỗi kết nối'))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-200 p-8 text-center max-w-sm">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="font-semibold text-slate-800 mb-2">Không tìm thấy</h2>
          <p className="text-slate-500 text-sm">{error || 'Dữ liệu không tồn tại.'}</p>
        </div>
      </div>
    );
  }

  const { teacher, video_scores } = data;
  const totalVideos = data.stats?.total_public_videos ?? video_scores.length;
  const watchedCount = data.stats?.watched_videos ?? 0;
  const completionPct = totalVideos > 0 ? Math.round((watchedCount / totalVideos) * 100) : 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🎓</span>
            <h1 className="text-xl font-bold text-slate-800">Chi tiết đào tạo giáo viên</h1>
          </div>
          <p className="text-xs text-slate-400 ml-9">MindX Training Portal · Dữ liệu công khai</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Teacher Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{teacher.full_name}</h2>
              <p className="text-slate-500 text-sm mt-0.5">Mã GV: <span className="font-mono font-medium text-slate-700">{teacher.teacher_code}</span></p>
              <div className="flex flex-wrap gap-2 mt-3">
                {teacher.center && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                    🏫 {teacher.center}
                  </span>
                )}
                {teacher.teaching_block && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                    📚 Khối {teacher.teaching_block}
                  </span>
                )}
              </div>
            </div>
            <div className="text-center bg-red-600 text-white rounded-2xl px-6 py-4 shadow-sm">
              <div className="text-3xl font-bold">{teacher.total_score.toFixed(1)}</div>
              <div className="text-xs opacity-90 mt-0.5">Điểm tổng kết</div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-800">{totalVideos}</div>
              <div className="text-xs text-slate-500">Video được giao</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{watchedCount}</div>
              <div className="text-xs text-slate-500">Đã xem</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{completionPct}%</div>
              <div className="text-xs text-slate-500">Tỉ lệ hoàn thành</div>
            </div>
          </div>
        </div>

        {/* Video Scores Table */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              TỔNG QUAN
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('log')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'log'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Log bai lam ({allAttemptLogs.length})
            </button>
          </div>
          {activeTab === 'overview' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-800">Chi tiết từng video</h3>
                <a
                  href={`/api/public/training-detail-log?code=${encodeURIComponent(teacher.teacher_code)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  title="Xuất log JSON toàn bộ lượt làm"
                >
                  Tai log JSON
                </a>
              </div>
              {video_scores.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Chưa có dữ liệu video</div>
              ) : (
                <div className="">
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="px-4 py-3 font-medium text-slate-600">Video</th>
                        <th className="px-4 py-3 font-medium text-slate-600 text-center">Trạng thái</th>
                        <th className="px-4 py-3 font-medium text-slate-600 text-center">Điểm</th>
                        <th className="px-4 py-3 font-medium text-slate-600 text-center">Minh chứng</th>
                        <th className="px-4 py-3 font-medium text-slate-600 text-center">Thời gian xem</th>
                        <th className="px-4 py-3 font-medium text-slate-600 text-center">Hoàn thành lúc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {video_scores.map((v) => (
                        <tr key={v.video_id} className="hover:bg-slate-50 transition-all relative z-10 hover:z-50 group/row">
                          <td className="px-4 py-3">
                            {v.video_link ? (
                              <a
                                href={v.video_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-slate-800 hover:text-blue-600 hover:underline flex items-center gap-1 group"
                              >
                                {v.video_title}
                                <svg className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </a>
                            ) : (
                              <div className="font-medium text-slate-800">{v.video_title}</div>
                            )}
                            {v.video_description && (
                              <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{v.video_description}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center relative">
                            <StatusBadge status={v.completion_status} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {v.score != null ? (
                              <span className="font-semibold text-blue-600">{v.score.toFixed(1)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center relative z-20 group-hover/row:z-[100]">
                            {v.attempt_logs && v.attempt_logs.length > 0 ? (
                              <div className="flex flex-col items-center gap-1.5">
                                <span className="text-[11px] text-slate-500">
                                  {v.attempt_logs.length} luot lam
                                </span>
                                <div className="flex flex-wrap items-center justify-center gap-1.5">
                                  {v.attempt_logs.slice(0, 2).map((attempt, idx) => (
                                    <a
                                      key={attempt.submission_id}
                                      href={`/public/training-submission-detail/${attempt.submission_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 transition-colors"
                                      title={`Lan ${idx + 1} - ${attempt.answers_count} cau tra loi`}
                                    >
                                      Lan {idx + 1}
                                    </a>
                                  ))}
                                  
                                  {v.attempt_logs.length > 2 && (
                                    <div className="relative group/popover">
                                      <span className="cursor-default inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-100 rounded hover:bg-slate-100 transition-colors">
                                        +{v.attempt_logs.length - 2} luot khac
                                      </span>
                                      
                                      {/* Popover */}
                                        <div className="invisible group-hover/popover:visible absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 z-[9999] animate-in fade-in slide-in-from-top-2 duration-200">
                                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1 border-b border-slate-50">
                                            Các lượt làm khác
                                          </div>
                                         <div className="max-h-40 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                           {v.attempt_logs.slice(2).map((attempt, idx) => (
                                             <a
                                               key={attempt.submission_id}
                                               href={`/public/training-submission-detail/${attempt.submission_id}`}
                                               target="_blank"
                                               rel="noopener noreferrer"
                                               className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-50 text-[11px] transition-colors group/item"
                                             >
                                               <span className="font-medium text-slate-700">Lan {idx + 3}</span>
                                               <span className="text-slate-400 group-hover/item:text-blue-500 font-mono">
                                                 {attempt.score !== null ? attempt.score.toFixed(1) : '—'} đ
                                               </span>
                                             </a>
                                           ))}
                                         </div>
                                         {/* Arrow pointing up */}
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-8 border-transparent border-b-white drop-shadow-sm"></div>
                                       </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs italic">Chưa làm bài</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {formatTime(v.time_spent_seconds)}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500 text-xs">
                            {v.completed_at
                              ? new Date(v.completed_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'log' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-800">Log bai lam (moi nhat truoc)</h3>
                <a
                  href={`/api/public/training-detail-log?code=${encodeURIComponent(teacher.teacher_code)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Mo JSON day du
                </a>
              </div>

              {allAttemptLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Chua co log bai lam</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="px-4 py-3 font-medium text-slate-600">Thoi gian</th>
                        <th className="px-4 py-3 font-medium text-slate-600">Video</th>
                        <th className="px-4 py-3 font-medium text-slate-600 text-center">Lan</th>
                        <th className="px-4 py-3 font-medium text-slate-600 text-center">Diem</th>
                        <th className="px-4 py-3 font-medium text-slate-600 text-center">Trang thai</th>
                        <th className="px-4 py-3 font-medium text-slate-600 text-center">So cau TL</th>
                        <th className="px-4 py-3 font-medium text-slate-600 text-center">Chi tiet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allAttemptLogs.map((attempt) => (
                        <tr key={attempt.submission_id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                            {attempt.latest_time
                              ? new Date(attempt.latest_time).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{attempt.video_title}</div>
                            <div className="text-[11px] text-slate-400">Video ID: {attempt.video_id}</div>
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-slate-700">{attempt.display_attempt_number}</td>
                          <td className="px-4 py-3 text-center">
                            {attempt.score != null ? (
                              <span className="font-semibold text-blue-600">{attempt.score.toFixed(1)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-600">{attempt.status || '—'}</td>
                          <td className="px-4 py-3 text-center text-slate-700">{attempt.answers_count || 0}</td>
                          <td className="px-4 py-3 text-center">
                            <a
                              href={`/public/training-submission-detail/${attempt.submission_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 transition-colors"
                            >
                              Xem
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 pb-4">
          MindX Training · Dữ liệu cập nhật theo thời gian thực
        </p>
      </div>
    </div>
  );
}
