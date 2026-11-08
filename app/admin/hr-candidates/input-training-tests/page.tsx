'use client';
import { useQueryState } from '@/lib/use-query-state'


import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpenCheck,
  CheckCircle2,
  Edit,
  FileQuestion,
  Layers3,
  ListChecks,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { SkeletonTable } from '@/components/skeletons';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { authHeaders } from '@/lib/auth-headers';
import { toast } from '@/lib/app-toast';
import { useAuth } from '@/lib/auth-context';

type TrainingStage = 'centralized_training' | 'pedagogy_training';
type TargetRef = 'gen_test' | 'lesson_1' | 'lesson_2' | 'lesson_3' | 'lesson_4';

interface InputTrainingAssignment {
  id: number;
  video_id: number | null;
  video_title: string | null;
  lesson_number?: number | null;
  assignment_title: string;
  assignment_type: string;
  description: string | null;
  question_count: number;
  assignment_context?: string;
  training_stage?: TrainingStage;
  target_ref?: TargetRef | null;
}

interface TrainingVideoOption {
  id: number;
  title: string;
  lesson_number?: number | null;
}

const PAGE_PATH = '/admin/hr-candidates/input-training-tests';

const STAGE_OPTIONS: Array<{ value: TrainingStage; label: string; description: string }> = [
  {
    value: 'centralized_training',
    label: 'Đào tạo tập trung',
    description: 'Bài kiểm tra/bài tập dùng trong các buổi đào tạo đầu vào tập trung.',
  },
  {
    value: 'pedagogy_training',
    label: 'Tập huấn sư phạm',
    description: 'Bài kiểm tra sau video hoặc bài tập theo từng lesson tập huấn sư phạm.',
  },
];

const TARGET_OPTIONS: Record<TrainingStage, Array<{ value: TargetRef; label: string }>> = {
  centralized_training: [
    { value: 'gen_test', label: 'Bài kiểm tra GEN / buổi tập trung' },
  ],
  pedagogy_training: [
    { value: 'lesson_1', label: 'Lesson 1' },
    { value: 'lesson_2', label: 'Lesson 2' },
    { value: 'lesson_3', label: 'Lesson 3' },
    { value: 'lesson_4', label: 'Lesson 4' },
  ],
};

const ASSIGNMENT_TYPES = [
  { value: 'quiz', label: 'Quiz sau video' },
  { value: 'test', label: 'Bài kiểm tra' },
  { value: 'practice', label: 'Bài tập' },
  { value: 'exam', label: 'Bài đánh giá' },
];

function stageLabel(value?: string | null) {
  return STAGE_OPTIONS.find((item) => item.value === value)?.label || 'Đào tạo đầu vào';
}

function normalizedTrainingStage(value?: string | null): TrainingStage {
  return value === 'pedagogy_training' ? 'pedagogy_training' : 'centralized_training';
}

function targetLabel(stage?: string | null, target?: string | null) {
  const options = TARGET_OPTIONS[(stage as TrainingStage) || 'centralized_training'] || [];
  return options.find((item) => item.value === target)?.label || target || 'Chưa phân nhóm';
}

function typeLabel(value?: string) {
  return ASSIGNMENT_TYPES.find((item) => item.value === value)?.label || value || 'Quiz';
}

function defaultTarget(stage: TrainingStage): TargetRef {
  return TARGET_OPTIONS[stage][0].value;
}

export default function InputTrainingTestsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<InputTrainingAssignment[]>([]);
  const [videos, setVideos] = useState<TrainingVideoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stageFilter, setStageFilter] = useQueryState<TrainingStage>('stage', 'centralized_training', { values: ["centralized_training","pedagogy_training"] });
  const [search, setSearch] = useQueryState<string>('search', '');
  const [formData, setFormData] = useState({
    video_id: '',
    assignment_title: '',
    assignment_type: 'quiz',
    description: '',
    training_stage: 'centralized_training' as TrainingStage,
    target_ref: 'gen_test' as TargetRef,
  });

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/training-assignments?assignment_context=input_training', {
        headers: authHeaders(token),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Không thể tải thư viện bài kiểm tra.');
      setAssignments(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/hr/onboarding/videos', { headers: authHeaders(token) });
      const data = await response.json();
      if (data.success) setVideos(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error('Error fetching onboarding videos:', err);
    }
  };

  useEffect(() => {
    fetchAssignments();
    fetchVideos();
  }, [token]);

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments.filter((assignment) => {
      const matchesStage = normalizedTrainingStage(assignment.training_stage) === stageFilter;
      const matchesSearch =
        !q ||
        [
          assignment.assignment_title,
          assignment.description,
          assignment.video_title,
          stageLabel(assignment.training_stage),
          targetLabel(assignment.training_stage, assignment.target_ref),
        ].some((value) => (value || '').toLowerCase().includes(q));
      return matchesStage && matchesSearch;
    });
  }, [assignments, search, stageFilter]);

  const summary = useMemo(() => {
    const totalQuestions = assignments.reduce((sum, item) => sum + Number(item.question_count || 0), 0);
    const pedagogyCount = assignments.filter((item) => normalizedTrainingStage(item.training_stage) === 'pedagogy_training').length;
    return { total: assignments.length, totalQuestions, pedagogyCount };
  }, [assignments]);

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      video_id: '',
      assignment_title: '',
      assignment_type: 'quiz',
      description: '',
      training_stage: 'centralized_training',
      target_ref: 'gen_test',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleStageChange = (nextStage: TrainingStage) => {
    setFormData((prev) => ({
      ...prev,
      training_stage: nextStage,
      target_ref: defaultTarget(nextStage),
    }));
  };

  const isAssessment = formData.assignment_type === 'exam';

  const handleEdit = (assignment: InputTrainingAssignment) => {
    const nextStage = normalizedTrainingStage(assignment.training_stage);
    setEditingId(assignment.id);
    setFormData({
      video_id: assignment.video_id ? String(assignment.video_id) : '',
      assignment_title: assignment.assignment_title,
      assignment_type: assignment.assignment_type || 'quiz',
      description: assignment.description || '',
      training_stage: nextStage,
      target_ref: assignment.target_ref || defaultTarget(nextStage),
    });
    setShowModal(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        ...formData,
        video_id: formData.video_id || null,
        target_ref: isAssessment ? null : formData.target_ref,
        assignment_context: 'input_training',
      };
      const response = await fetch(
        editingId ? `/api/training-assignments?id=${editingId}` : '/api/training-assignments',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
          body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
        },
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Không thể lưu bài kiểm tra.');

      toast.success(editingId ? 'Đã cập nhật bài kiểm tra.' : 'Đã tạo bài kiểm tra.');
      setShowModal(false);
      resetForm();
      await fetchAssignments();
      if (!editingId && data.data?.id) {
        router.push(`/admin/assignment-questions?assignment_id=${data.data.id}&return_to=${encodeURIComponent(PAGE_PATH)}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi lưu bài kiểm tra.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài kiểm tra này? Toàn bộ câu hỏi bên trong cũng sẽ bị xóa.')) return;
    try {
      const response = await fetch(`/api/training-assignments?id=${id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Không thể xóa bài kiểm tra.');
      toast.success('Đã xóa bài kiểm tra.');
      fetchAssignments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi xóa bài kiểm tra.');
    }
  };

  const manageQuestions = (id: number) => {
    router.push(`/admin/assignment-questions?assignment_id=${id}&return_to=${encodeURIComponent(PAGE_PATH)}`);
  };

  if (loading) {
    return (
      <PageContainer title="Thư viện bài kiểm tra đầu vào" description="Quản lý bài kiểm tra cho đào tạo tập trung và tập huấn sư phạm.">
        <SkeletonTable />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Thư viện bài kiểm tra đầu vào"
      description="Cấu hình bài kiểm tra GEN, bài tập buổi đào tạo tập trung và quiz sau video cho các lesson tập huấn sư phạm."
      maxWidth="full"
      padding="md"
    >
      <div className="space-y-5 pb-20">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-gray-500">Tổng bài</p>
            <p className="mt-1 text-2xl font-bold text-gray-950">{summary.total}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-gray-500">Câu hỏi</p>
            <p className="mt-1 text-2xl font-bold text-gray-950">{summary.totalQuestions}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-gray-500">Tập huấn sư phạm</p>
            <p className="mt-1 text-2xl font-bold text-gray-950">{summary.pedagogyCount}</p>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/70 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-base font-bold text-gray-950">Danh sách bài kiểm tra</p>
              <p className="mt-0.5 text-xs text-gray-500">{filteredAssignments.length} kết quả sau lọc</p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm tên bài, lesson, video..."
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm font-medium outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/10 md:w-72"
                />
              </div>
              <div className="grid w-full grid-cols-2 rounded-lg border border-gray-200 bg-white p-1 md:w-auto">
                {STAGE_OPTIONS.map((stage) => (
                  <button key={stage.value} type="button" onClick={() => setStageFilter(stage.value)} className={`min-h-9 rounded-md px-3 text-sm font-semibold leading-tight transition ${stageFilter === stage.value ? 'bg-[#a1001f] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {stage.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#a1001f] px-4 text-sm font-bold text-white transition hover:bg-[#c41230]"
              >
                <Plus className="h-4 w-4" />
                Tạo bài
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Tên bài</TableHead>
                  <TableHead className="w-44">Nhóm</TableHead>
                  <TableHead className="w-64">Gắn video</TableHead>
                  <TableHead className="w-32">Loại</TableHead>
                  <TableHead className="w-20 text-center">Câu hỏi</TableHead>
                  <TableHead className="w-36 text-center">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm font-semibold text-gray-500">
                      Chưa có bài kiểm tra đầu vào phù hợp.
                    </TableCell>
                  </TableRow>
                ) : filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="text-sm font-bold leading-5 text-gray-950">{assignment.assignment_title}</p>
                        {assignment.description && (
                          <p className="mt-1 line-clamp-2 text-xs font-medium text-gray-500">{assignment.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="inline-flex whitespace-nowrap items-center gap-1 rounded-full bg-[#a1001f]/10 px-2 py-1 text-xs font-bold text-[#a1001f]">
                          <Layers3 className="h-3 w-3" />
                          {stageLabel(normalizedTrainingStage(assignment.training_stage))}
                        </span>
                        <p className="text-xs font-semibold text-gray-600">{targetLabel(normalizedTrainingStage(assignment.training_stage), assignment.target_ref)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm font-medium text-gray-700">
                      {assignment.video_title || 'Không gắn video'}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{typeLabel(assignment.assignment_type)}</span>
                    </TableCell>
                    <TableCell className="text-center font-black">{assignment.question_count || 0}</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => manageQuestions(assignment.id)}
                          className="rounded-lg bg-purple-50 p-2 text-purple-700 transition hover:bg-purple-100"
                          title="Quản lý câu hỏi"
                        >
                          <ListChecks className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(assignment)}
                          className="rounded-lg bg-amber-50 p-2 text-amber-700 transition hover:bg-amber-100"
                          title="Sửa"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(assignment.id)}
                          className="rounded-lg bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-modal-backdrop-custom flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#a1001f]/10 bg-[#a1001f]/5 text-[#a1001f]">
                    <FileQuestion className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black leading-tight text-gray-950 sm:text-xl">
                      {editingId ? 'Chỉnh sửa bài kiểm tra' : 'Tạo bài kiểm tra đầu vào'}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm font-medium leading-5 text-gray-500">
                      Chọn nhóm đào tạo, lesson và video liên kết nếu bài cần mở sau khi xem video.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2"
                  aria-label="Đóng"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
              <div className="grid gap-3 md:grid-cols-2">
                {STAGE_OPTIONS.map((stage) => {
                  const Icon = stage.value === 'centralized_training' ? BookOpenCheck : CheckCircle2;
                  const checked = formData.training_stage === stage.value;
                  return (
                    <label
                      key={stage.value}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${checked ? 'border-[#a1001f] bg-[#a1001f]/5 ring-2 ring-[#a1001f]/10' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <input
                        type="radio"
                        name="training_stage"
                        value={stage.value}
                        checked={checked}
                        onChange={() => handleStageChange(stage.value)}
                        className="sr-only"
                      />
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#a1001f] shadow-sm">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span>
                          <span className="block text-sm font-black text-gray-950">{stage.label}</span>
                          <span className="mt-1 block text-xs font-medium text-gray-500">{stage.description}</span>
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className={`grid gap-4 ${isAssessment ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
                {!isAssessment && (
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-wide text-gray-500">Lesson / buổi</span>
                    <select
                      value={formData.target_ref}
                      onChange={(event) => setFormData({ ...formData, target_ref: event.target.value as TargetRef })}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/10"
                    >
                      {TARGET_OPTIONS[formData.training_stage].map((target) => (
                        <option key={target.value} value={target.value}>{target.label}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-gray-500">Loại bài</span>
                  <select
                    value={formData.assignment_type}
                    onChange={(event) => setFormData({ ...formData, assignment_type: event.target.value })}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/10"
                  >
                    {ASSIGNMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-gray-500">Tên bài *</span>
                <input
                  required
                  value={formData.assignment_title}
                  onChange={(event) => setFormData({ ...formData, assignment_title: event.target.value })}
                  placeholder="VD: Quiz Lesson 1 - Quy trình đứng lớp"
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-semibold outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/10"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-gray-500">Video liên kết</span>
                <select
                  value={formData.video_id}
                  onChange={(event) => setFormData({ ...formData, video_id: event.target.value })}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/10"
                >
                  <option value="">Không gắn video</option>
                  {videos.map((video) => (
                    <option key={video.id} value={video.id}>
                      #{video.id} {video.lesson_number ? `- L${video.lesson_number}` : ''} - {video.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-gray-500">Mô tả</span>
                <textarea
                  value={formData.description}
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                  rows={3}
                  placeholder="Ghi chú cách dùng, thời điểm làm bài hoặc yêu cầu hoàn thành..."
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/10"
                />
              </label>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#a1001f] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#c41230]"
                >
                  <FileQuestion className="h-4 w-4" />
                  {editingId ? 'Cập nhật' : 'Tạo và thêm câu hỏi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
