'use client';

import { PageContainer } from '@/components/PageContainer';
import { PageSkeleton } from '@/components/skeletons/PageSkeleton';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/auth-headers';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { normalizeStorageUrl } from '@/lib/storage-url';
import { useTeacher } from '@/lib/teacher-context';
import { AlertCircle, ArrowLeft, Award, BookOpen, CheckCircle, Clock, FileText, Send } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/app-toast';

interface ExamQuestion {
  id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  options: string[] | null;
  correct_answer: string | null;
  image_url: string | null;
  points: number;
  order_number: number;
}

interface ExamAssignment {
  id: number;
  teacher_code: string;
  subject_code: string;
  set_code: string;
  set_name: string;
  open_at: string;
  close_at: string;
  total_points: number;
  passing_score: number;
  assignment_status: string;
  score: number | null;
  time_limit_minutes: number;
}

export default function ExamAssignmentTakingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token } = useAuth();
  const { teacherProfile, isLoading: isTeacherLoading } = useTeacher();

  const assignmentIdParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const assignmentId = Number(assignmentIdParam);

  const [teacherCode, setTeacherCode] = useState('');
  const [assignment, setAssignment] = useState<ExamAssignment | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [examStartedAt, setExamStartedAt] = useState<number | null>(null); // ms timestamp
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [percentage, setPercentage] = useState<number>(0);

  const getDraftStorageKey = (assignmentIdValue: number | string, teacherCodeValue: string) =>
    `exam_draft_v1:${String(assignmentIdValue)}:${String(teacherCodeValue || 'unknown').trim().toLowerCase()}`;

  const decodeEscapedHtml = (value: string) => {
    if (!value) return '';
    let decoded = String(value);

    // Some payloads are escaped multiple times (e.g. &amp;lt;img...&amp;gt;).
    for (let i = 0; i < 4; i += 1) {
      if (!decoded.includes('&')) break;
      const textarea = document.createElement('textarea');
      textarea.innerHTML = decoded;
      const next = textarea.value;
      if (next === decoded) break;
      decoded = next;
    }

    return decoded;
  };

  const sanitizeHtmlForRender = (value: string) => {
    const decoded = decodeEscapedHtml(value || '');
    // blob: URLs are temporary and should not be rendered from persisted content.
    return decoded.replace(/<img[^>]+src=["']blob:[^"']*["'][^>]*>/gi, '');
  };

  const hasHtmlMarkup = (value: string) => /<[^>]+>/.test(value || '');

  const stripHtml = (value: string) =>
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizeAnswerForCompare = (value: string) =>
    stripHtml(sanitizeHtmlForRender(value || '')).toLowerCase();

  const normalizeQuestionOptions = (rawOptions: unknown): string[] | null => {
    if (Array.isArray(rawOptions)) {
      return rawOptions.map((item) => String(item ?? '')).filter(Boolean);
    }

    if (typeof rawOptions === 'string') {
      const trimmed = rawOptions.trim();
      if (!trimmed) return null;

      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item ?? '')).filter(Boolean);
        }
        if (parsed && typeof parsed === 'object') {
          return Object.values(parsed as Record<string, unknown>)
            .map((item) => String(item ?? ''))
            .filter(Boolean);
        }
      } catch {
      }

      return [trimmed];
    }

    if (rawOptions && typeof rawOptions === 'object') {
      return Object.values(rawOptions as Record<string, unknown>)
        .map((item) => String(item ?? ''))
        .filter(Boolean);
    }

    return null;
  };

  const normalizeQuestion = (raw: any): ExamQuestion => {
    const questionText =
      typeof raw?.question_text === 'string'
        ? raw.question_text
        : raw?.question_text
        ? JSON.stringify(raw.question_text)
        : '';

    return {
      id: Number(raw?.id || 0),
      question_text: questionText,
      question_type: (raw?.question_type || 'short_answer') as ExamQuestion['question_type'],
      options: normalizeQuestionOptions(raw?.options),
      correct_answer: raw?.correct_answer == null ? null : String(raw.correct_answer),
      image_url: raw?.image_url == null ? null : normalizeStorageUrl(String(raw.image_url)),
      points: Number(raw?.points || 0),
      order_number: Number(raw?.order_number || 0),
    };
  };

  useEffect(() => {
    if (!user?.email) return;
    if (isTeacherLoading) return;

    if (teacherProfile?.code) {
      setTeacherCode(String(teacherProfile.code).trim());
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/teachers/info?email=${encodeURIComponent(user.email)}`, {
          headers: authHeaders(token),
        });
        const data = await res.json();
        if (data?.success && data?.teacher?.code) {
          setTeacherCode(String(data.teacher.code).trim());
          return;
        }
      } catch {
      }

      const fallback = user.email.split('@')[0];
      setTeacherCode(fallback);
    })();
  }, [user, token, isTeacherLoading, teacherProfile]);

  useEffect(() => {
    if (!assignmentIdParam || Number.isNaN(assignmentId)) return;

    (async () => {
      try {
        setLoading(true);

        const detailsRes = await fetch(`/api/exam-assignment-questions?assignment_id=${encodeURIComponent(assignmentIdParam)}`);
        const detailsData = await detailsRes.json();

        if (!detailsData.success) {
          toast.error(detailsData.error || 'Không thể tải dữ liệu bài thi');
          router.push('/user/assignments');
          return;
        }

        const assignmentData: ExamAssignment | null = detailsData.assignment || null;
        if (!assignmentData || !assignmentData.id) {
          toast.error('Dữ liệu bài thi không hợp lệ');
          router.push('/user/assignments');
          return;
        }

        const questionData: ExamQuestion[] = Array.isArray(detailsData.questions)
          ? detailsData.questions.map(normalizeQuestion).filter((item: ExamQuestion) => item.id > 0)
          : [];

        const now = new Date();
        const openAt = new Date(assignmentData.open_at);
        const closeAt = new Date(assignmentData.close_at);

        if (now < openAt) {
          toast.error('Bài thi chưa đến thời gian mở');
          router.push('/user/assignments');
          return;
        }

        if (now > closeAt || assignmentData.assignment_status === 'expired') {
          toast.error('Bài thi đã quá hạn');
          router.push('/user/assignments');
          return;
        }

        const resolvedTeacherCode =
          (teacherCode || '').trim() ||
          String(assignmentData.teacher_code || '').trim() ||
          (user?.email?.split('@')[0] || '').trim();

        if (!resolvedTeacherCode) {
          toast.error('Không xác định được mã giáo viên để bắt đầu bài thi');
          router.push('/user/assignments');
          return;
        }

        if (teacherCode !== resolvedTeacherCode) {
          setTeacherCode(resolvedTeacherCode);
        }

        const startRes = await fetch('/api/exam-submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignment_id: assignmentData.id, teacher_code: resolvedTeacherCode }),
        });
        const startData = await startRes.json();

        if (!startData.success) {
          toast.error(startData.error || 'Không thể bắt đầu bài thi');
          router.push('/user/assignments');
          return;
        }

        // Restore saved draft answers for this teacher + assignment when reopening/reloading.
        try {
          const draftKey = getDraftStorageKey(assignmentData.id, resolvedTeacherCode);
          const savedDraftRaw = window.localStorage.getItem(draftKey);
          if (savedDraftRaw) {
            const parsed = JSON.parse(savedDraftRaw) as { answers?: Record<string, string> };
            const validQuestionIds = new Set(questionData.map((q) => q.id));
            const restoredAnswers: Record<number, string> = {};

            Object.entries(parsed?.answers || {}).forEach(([qid, answer]) => {
              const numericQuestionId = Number(qid);
              if (!Number.isFinite(numericQuestionId) || !validQuestionIds.has(numericQuestionId)) return;
              restoredAnswers[numericQuestionId] = String(answer || '');
            });

            if (Object.keys(restoredAnswers).length > 0) {
              setAnswers(restoredAnswers);
            }
          }
        } catch {
        }

        // Ghi nhớ thời điểm bắt đầu để đếm ngược chính xác
        const rawStartedAt = startData.data?.started_at;
        const startedAtMs = rawStartedAt ? new Date(rawStartedAt).getTime() : Date.now();
        setExamStartedAt(startedAtMs);

        setAssignment(assignmentData);
        setQuestions(questionData);
      } catch (error) {
        console.error('Error loading exam assignment:', error);
        toast.error('Có lỗi xảy ra khi tải bài thi');
        router.push('/user/assignments');
      } finally {
        setLoading(false);
      }
    })();
  }, [teacherCode, assignmentIdParam, assignmentId, router, user?.email]);

  useEffect(() => {
    if (!assignment || submitted || examStartedAt === null) return;

    const durationMs = (assignment.time_limit_minutes || 90) * 60_000;
    // Deadline = started_at + duration; also cap at close_at to respect exam window
    const durationDeadline = examStartedAt + durationMs;
    const closeDeadline = new Date(assignment.close_at).getTime();
    const deadline = Math.min(durationDeadline, closeDeadline);

    const tick = () => {
      const remain = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setTimeRemaining(remain);
      if (remain === 0 && !submitted) {
        handleSubmit(true);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [assignment, submitted, examStartedAt]);

  const unansweredCount = useMemo(
    () => questions.length - Object.keys(answers).length,
    [questions.length, answers]
  );

  const progress = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round(((questions.length - unansweredCount) / questions.length) * 100);
  }, [questions.length, unansweredCount]);

  useEffect(() => {
    if (!assignment?.id) return;

    const activeTeacherCode =
      (teacherCode || '').trim() ||
      String(assignment.teacher_code || '').trim() ||
      (user?.email?.split('@')[0] || '').trim();

    if (!activeTeacherCode) return;

    const draftKey = getDraftStorageKey(assignment.id, activeTeacherCode);

    if (submitted) {
      window.localStorage.removeItem(draftKey);
      return;
    }

    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({
          assignment_id: assignment.id,
          teacher_code: activeTeacherCode,
          updated_at: new Date().toISOString(),
          answers,
        })
      );
    } catch {
    }
  }, [assignment?.id, assignment?.teacher_code, teacherCode, user?.email, answers, submitted]);

  const formatTime = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const scrollToQuestion = (questionId: number) => {
    const el = document.getElementById(`exam-question-${questionId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (auto = false) => {
    if (!assignment || submitting || submitted) return;

    const resolvedTeacherCode =
      (teacherCode || '').trim() ||
      String(assignment.teacher_code || '').trim() ||
      (user?.email?.split('@')[0] || '').trim();

    if (!resolvedTeacherCode) {
      toast.error('Không xác định được mã giáo viên để nộp bài');
      return;
    }

    if (!auto && unansweredCount > 0) {
      const confirmed = window.confirm(`Bạn còn ${unansweredCount} câu chưa trả lời. Bạn có chắc muốn nộp bài?`);
      if (!confirmed) return;
    }

    try {
      setSubmitting(true);
      const answerPayload = Object.entries(answers)
        .map(([questionId, answerText]) => ({
          question_id: Number(questionId),
          answer_text: String(answerText || ''),
        }))
        .filter((item) => Number.isFinite(item.question_id) && item.question_id > 0);

      const response = await fetch('/api/exam-submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          teacher_code: resolvedTeacherCode,
          answers: answerPayload,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Không thể nộp bài');
        return;
      }

      const serverScore = Number(data?.data?.calculated_score ?? data?.data?.raw_score ?? 0);
      const serverPercentage = Number(data?.data?.percentage ?? 0);

      setScore(Number.isFinite(serverScore) ? serverScore : 0);
      setPercentage(Number.isFinite(serverPercentage) ? serverPercentage : 0);

      try {
        const submittedTeacherCode =
          (resolvedTeacherCode || '').trim() ||
          String(assignment.teacher_code || '').trim() ||
          (user?.email?.split('@')[0] || '').trim();
        if (submittedTeacherCode) {
          window.localStorage.removeItem(getDraftStorageKey(assignment.id, submittedTeacherCode));
        }
      } catch {
      }

      setSubmitted(true);
      toast.success(auto ? 'Hết giờ, hệ thống đã nộp bài tự động' : 'Nộp bài thành công');
    } catch (error) {
      console.error('Error submitting exam assignment:', error);
      toast.error('Có lỗi xảy ra khi nộp bài');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageSkeleton variant="form" itemCount={6} showHeader={true} />
  }

  if (Number.isNaN(assignmentId)) {
    return (
      <PageContainer>
        <div className="p-8 text-center text-red-600">ID bài thi không hợp lệ.</div>
      </PageContainer>
    );
  }

  if (!assignment) {
    return (
      <PageContainer>
        <div className="p-8 text-center text-red-600">Không tìm thấy bài thi.</div>
      </PageContainer>
    );
  }

  if (submitted) {
    return (
      <PageContainer>
        <div className="max-w-3xl mx-auto py-4 md:py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 text-center">
            <CheckCircle className="w-14 h-14 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Hoàn thành bài thi</h1>
            <p className="text-gray-600 mb-2">{assignment.subject_code}</p>
            <p className="text-sm text-gray-500 mb-5">{assignment.set_code} - {assignment.set_name}</p>

            <div className="inline-flex items-end gap-2 mb-2">
              <span className="text-4xl font-bold text-blue-600">{score}</span>
              <span className="text-lg text-gray-400">/ {assignment.total_points}</span>
            </div>
            <p className="text-sm text-gray-500 mb-6">Tỷ lệ đúng: {percentage.toFixed(1)}%</p>

            <Link href="/user/assignments" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <ArrowLeft className="w-4 h-4" />
              Quay lại My Assignment
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="w-full">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <div className="lg:hidden mb-4 rounded-xl bg-white border border-gray-200 p-4">
              <h1 className="text-xl font-bold text-gray-900 mb-1">{assignment.subject_code}</h1>
              <p className="text-sm text-gray-600 flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4" />
                {assignment.set_code} - {assignment.set_name}
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-4 h-4" />
                <span className="font-semibold">{timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
              {questions.map((question, index) => {
                const isAnswered = Boolean(answers[question.id]);
                const questionBody = sanitizeHtmlForRender(question.question_text || '');

                return (
                  <div
                    key={question.id}
                    id={`exam-question-${question.id}`}
                    className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                      isAnswered
                        ? 'border-green-200 bg-green-50/30'
                        : 'border-gray-200 hover:border-blue-200'
                    } lg:col-span-2`}
                  >
                    <div className="p-4 md:p-6">
                      <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
                        <div
                          className={`shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-sm md:text-base font-bold ${
                            isAnswered ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                            {hasHtmlMarkup(questionBody) ? (
                              <div
                                className="prose prose-sm max-w-none flex-1 text-gray-900 [&_.tiptap-image]:inline-block [&_.tiptap-image]:max-w-full [&_img]:h-auto"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(questionBody) }}
                              />
                            ) : (
                              <p className="text-base text-gray-900 flex-1">{questionBody}</p>
                            )}

                            <span className="self-start px-2 md:px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] md:text-xs font-semibold shrink-0">
                              {question.points} điểm
                            </span>
                          </div>
                          {question.image_url && (
                            <img
                              src={question.image_url}
                              alt="Question"
                              className="mt-3 max-h-80 max-w-full rounded-lg border border-gray-200 bg-gray-50 object-contain"
                            />
                          )}
                        </div>
                      </div>

                      <div className="ml-11 md:ml-14">
                        {Array.isArray(question.options) && question.options.length > 0 ? (
                          <div className="space-y-2">
                            {question.options.map((opt, idx) => {
                              const optionBody = sanitizeHtmlForRender(String(opt || ''));

                              return (
                                <label
                                  key={idx}
                                  className={`flex items-start gap-2 md:gap-3 p-3 md:p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                    answers[question.id] === opt
                                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`q-${question.id}`}
                                    value={opt}
                                    checked={answers[question.id] === opt}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    className="w-4 md:w-5 h-4 md:h-5 text-blue-600"
                                  />
                                  {hasHtmlMarkup(optionBody) ? (
                                    <span
                                      className="prose prose-sm max-w-none flex-1 text-sm text-gray-900 [&_.tiptap-image]:inline-block [&_.tiptap-image]:max-w-full [&_img]:h-auto"
                                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(optionBody) }}
                                    />
                                  ) : (
                                    <span className="flex-1 text-sm md:text-base text-gray-900">{optionBody}</span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <textarea
                            value={answers[question.id] || ''}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            rows={question.question_type === 'essay' ? 6 : 3}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                            placeholder="Nhập câu trả lời..."
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 sticky bottom-0 lg:hidden">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-4">
                <Link
                  href="/user/assignments"
                  className="inline-flex items-center justify-center gap-2 px-4 md:px-6 py-3 font-medium text-gray-700 text-sm md:text-base h-auto rounded-md border border-gray-300"
                >
                  <ArrowLeft className="w-4 md:w-5 h-4 md:h-5" />
                  Quay lại
                </Link>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
                  {unansweredCount > 0 && (
                    <div className="flex items-center justify-center gap-2 text-amber-600 py-2 md:py-0">
                      <AlertCircle className="w-4 md:w-5 h-4 md:h-5" />
                      <span className="text-xs md:text-sm font-medium">Còn {unansweredCount} câu chưa trả lời</span>
                    </div>
                  )}

                  <Button
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 px-6 md:px-8 py-3 font-semibold shadow-md text-sm md:text-base h-auto"
                  >
                    <Send className="w-4 md:w-5 h-4 md:h-5" />
                    {submitting ? 'Đang nộp...' : 'Nộp bài'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h2 className="text-base font-bold text-gray-900 mb-1 line-clamp-2">{assignment.subject_code}</h2>
                <p className="text-xs text-gray-600 flex items-center gap-1.5 line-clamp-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  {assignment.set_code} - {assignment.set_name}
                </p>
              </div>

              {timeRemaining !== null && (
                <div className={`rounded-lg shadow-sm border-2 p-4 ${
                  timeRemaining < 300 ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-300'
                }`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Clock className={`w-4 h-4 ${timeRemaining < 300 ? 'text-red-600' : 'text-blue-600'}`} />
                    <span className={`text-xs font-semibold ${timeRemaining < 300 ? 'text-red-700' : 'text-blue-700'}`}>
                      Thời gian còn lại
                    </span>
                  </div>
                  <div className={`font-mono text-2xl font-bold ${timeRemaining < 300 ? 'text-red-700' : 'text-blue-700'}`}>
                    {formatTime(timeRemaining)}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700">Tiến độ</span>
                  <span className="text-xl font-bold text-blue-600">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-gray-600 text-center">{questions.length - unansweredCount}/{questions.length} câu đã trả lời</p>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Ma trận câu hỏi</p>
                  <div className="grid grid-cols-5 gap-2">
                    {questions.map((q, index) => {
                      const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
                      return (
                        <button
                          type="button"
                          key={q.id}
                          onClick={() => scrollToQuestion(q.id)}
                          className={`
                            flex items-center justify-center text-[10px] font-bold h-7 rounded transition-all duration-200 cursor-pointer
                            ${isAnswered
                              ? 'bg-green-500 text-white shadow-sm ring-1 ring-green-600'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }
                          `}
                          title={`Câu ${index + 1}: ${isAnswered ? 'Đã làm' : 'Chưa làm'}`}
                          aria-label={`Đi tới câu ${index + 1}`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="text-xs font-semibold text-gray-700 mb-3">Thông tin bài thi</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Số câu hỏi</p>
                      <p className="text-base font-bold text-gray-900">{questions.length}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Award className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Tổng điểm</p>
                      <p className="text-base font-bold text-gray-900">{assignment.total_points}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Điểm đạt</p>
                      <p className="text-base font-bold text-gray-900">{assignment.passing_score}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {unansweredCount > 0 && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
                    <div className="flex items-start gap-2 text-amber-700">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="text-xs font-medium">Còn {unansweredCount} câu chưa trả lời</span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-semibold shadow-md h-auto"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Đang nộp...' : 'Nộp bài'}
                </Button>

                <Link
                  href="/user/assignments"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Quay lại My Assignment
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
