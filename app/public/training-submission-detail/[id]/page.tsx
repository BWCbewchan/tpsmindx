'use client';

import { sanitizeHtml } from '@/lib/sanitize-html';
import { AlertCircle, CheckCircle, Clock, User, XCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface SubmissionDetail {
  id: number;
  assignment_title: string;
  assignment_type: string;
  teacher_name: string;
  center: string;
  score: number | null;
  total_points: number;
  percentage: number | null;
  status: string;
  submitted_at: string;
  attempt_number: number;
}

interface QuestionAnswer {
  question_id: number;
  question_text: string;
  question_type: string;
  image_url: string;
  max_points: number;
  answer_text: string; // JSON string for multiple choice usually
  is_correct: boolean;
  points_earned: number;
  correct_answer: string;
  options: any;
  explanation: string;
}

interface ApiResponse {
  success: boolean;
  submission: SubmissionDetail;
  answers: QuestionAnswer[];
  error?: string;
}

export default function SubmissionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/public/training-submission-detail?id=${id}`)
      .then(r => r.json())
      .then((res: ApiResponse) => {
        if (res.success) setData(res);
        else setError(res.error || 'Không tìm thấy dữ liệu');
      })
      .catch((err) => {
        console.error(err);
        setError('Lỗi kết nối');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Không thể tải dữ liệu</h2>
          <p className="text-slate-600">{error || 'Bài làm không tồn tại'}</p>
        </div>
      </div>
    );
  }

  const { submission, answers } = data;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const parseAnswer = (text: string) => {
    try {
      // If it looks like JSON array (for multiple selections), try parse
      if (text && (text.startsWith('[') || text.startsWith('{'))) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed.join(', ');
        return text;
      }
      return text;
    } catch {
      return text;
    }
  };

  const getOptionLabel = (options: any, value: string) => {
    if (!value) return value;
    // multiple_select: value là JSON array → hiển thị danh sách
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr)) return arr.join(', ');
    } catch { /* không phải JSON */ }
    if (!options || !Array.isArray(options)) return value;
    const opt = options.find((o: any) => o.value === value);
    return opt ? opt.label : value;
  };

  const FormattedText = ({ html }: { html: string }) => {
    if (!html) return null;
    return (
      <div 
        className="prose prose-xs sm:prose-sm max-w-none prose-p:my-0 prose-slate"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} 
      />
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-6 text-white">
            <h1 className="text-2xl font-bold mb-2">{submission.assignment_title}</h1>
            <div className="flex flex-wrap gap-4 text-blue-100 text-sm">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {submission.teacher_name}
              </div>
              <div className="flex items-center gap-1.5">
                 <Clock className="w-4 h-4" />
                 {formatDate(submission.submitted_at)}
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {submission.status === 'in_progress' ? (
              <div className="flex items-center justify-center gap-3 py-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                <Clock className="w-6 h-6 shrink-0" />
                <div>
                  <p className="font-semibold text-base">Bài làm đang trong tiến trình</p>
                  <p className="text-sm text-amber-600 mt-0.5">Giáo viên chưa nộp bài, điểm số chưa được tính.</p>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-center">
                 <div className="text-sm text-slate-500 mb-1">Điểm số</div>
                 <div className="text-3xl font-bold text-slate-800">
                   {submission.score ?? '—'} <span className="text-lg text-slate-400 font-normal">/ {submission.total_points}</span>
                 </div>
               </div>
               
               <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-center">
                 <div className="text-sm text-slate-500 mb-1">Kết quả</div>
                 <div className={`text-3xl font-bold ${(submission.percentage ?? 0) >= 70 ? 'text-emerald-600' : 'text-red-600'}`}>
                   {submission.percentage != null ? `${submission.percentage}%` : '—'}
                 </div>
               </div>

               <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-center">
                 <div className="text-sm text-slate-500 mb-1">Trạng thái</div>
                 <div className="flex justify-center items-center h-full pt-1">
                   {(submission.percentage ?? 0) >= 70 ? (
                      <Badge variant="success" size="lg" shape="pill" icon={CheckCircle}>
                        Đạt
                      </Badge>
                   ) : (
                      <Badge variant="danger" size="lg" shape="pill" icon={XCircle}>
                        Chưa đạt
                      </Badge>
                   )}
                 </div>
               </div>
            </div>
            )}
          </div>
        </div>

        {/* Answers List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800 px-1">Chi tiết bài làm</h2>
          
          {answers.map((ans, idx) => (
            <div key={idx} className={`bg-white rounded-xl shadow-sm border p-6 transition-all ${
              ans.is_correct ? 'border-emerald-200 ring-1 ring-emerald-50' : 'border-red-200 ring-1 ring-red-50'
            }`}>
              <div className="flex justify-between items-start gap-4 mb-3">
                <h3 className="font-medium text-slate-800 flex-1">
                  <div className="flex items-start gap-2">
                    <span className="inline-block bg-slate-100 text-slate-600 rounded px-2 py-0.5 text-xs font-bold min-w-[24px] text-center mt-0.5">
                      {idx + 1}
                    </span>
                    <FormattedText html={ans.question_text} />
                  </div>
                </h3>
                <div className="shrink-0">
                  {ans.is_correct ? (
                    <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium bg-emerald-50 px-2 py-1 rounded">
                      <CheckCircle className="w-4 h-4" />
                      +{ans.points_earned} đ
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-600 text-sm font-medium bg-red-50 px-2 py-1 rounded">
                      <XCircle className="w-4 h-4" />
                      0 / {ans.max_points} đ
                    </div>
                  )}
                </div>
              </div>

              {ans.image_url && (
                <div className="mb-4 ml-8">
                  <img src={ans.image_url} alt="Question" className="rounded-lg max-h-60 border border-slate-200 object-contain bg-slate-50" />
                </div>
              )}

              <div className="ml-8 space-y-3">
                {/* User Answer */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
                    Câu trả lời của bạn
                  </div>
                  <div className={`font-medium ${ans.is_correct ? 'text-emerald-700' : 'text-red-700'}`}>
                    <FormattedText html={getOptionLabel(ans.options, ans.answer_text)} />
                    {!ans.answer_text && <span className="text-slate-400 italic">Chưa trả lời</span>}
                  </div>
                </div>

                {/* Correct Answer (Show only if incorrect) */}
                {!ans.is_correct && (
                  <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                     <div className="text-xs text-emerald-600 uppercase tracking-wide font-semibold mb-1">
                        Đáp án đúng
                     </div>
                     <div className="font-medium text-emerald-800">
                        <FormattedText html={getOptionLabel(ans.options, ans.correct_answer)} />
                     </div>
                  </div>
                )}
                
                {ans.explanation && (
                  <div className="mt-2 text-sm text-slate-600 bg-blue-50/50 p-3 rounded-md border border-blue-100">
                    <div className="font-semibold text-blue-700 mb-1">💡 Giải thích:</div>
                    <FormattedText html={ans.explanation} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
