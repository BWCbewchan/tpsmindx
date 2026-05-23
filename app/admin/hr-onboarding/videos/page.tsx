'use client';

import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { PageContainer } from '@/components/PageContainer';
import { SearchBar } from '@/components/SearchBar';
import { SkeletonList } from '@/components/skeletons';
import { Tabs } from '@/components/Tabs';
import { Button } from '@/components/ui/button';
import { useUploadVideo } from '@/components/UploadVideoContext';
import { toast } from '@/lib/app-toast';
import { authHeaders } from '@/lib/auth-headers';
import { useAuth } from '@/lib/auth-context';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  Eye,
  FileVideo,
  HelpCircle,
  ListChecks,
  Lock,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface OnboardingVideo {
  id: number;
  title: string;
  description: string | null;
  video_link: string;
  thumbnail_url: string | null;
  lesson_number: number | null;
  duration_minutes: number | null;
  duration_seconds?: number | null;
  status: 'draft' | 'active' | 'inactive' | string;
  start_date: string | null;
  view_count: number;
  viewers: number;
  created_at: string;
  original_filename?: string | null;
}

type VideoTab = 'active' | 'draft' | 'inactive';

type EditForm = {
  title: string;
  description: string;
  thumbnail_url: string;
  lesson_number: string;
  duration_minutes: string;
  start_date: string;
};

type SetupTab = 'info' | 'questions' | 'assignment';

type InteractiveQuestion = {
  id?: number;
  time: number;
  question: string;
  options: string[];
  answer: number;
};

type AssignmentLink = {
  id: number;
  assignment_title: string;
  assignment_type: string;
  total_points?: number | null;
  time_limit_minutes?: number | null;
  video_id?: number | string | null;
  question_count?: number;
};

const emptyForm: EditForm = {
  title: '',
  description: '',
  thumbnail_url: '',
  lesson_number: '',
  duration_minutes: '30',
  start_date: new Date().toISOString().split('T')[0],
};

function formatDate(date?: string | null) {
  if (!date) return 'Chưa đặt ngày';
  return new Date(date).toLocaleDateString('vi-VN');
}

export default function OnboardingVideosPage() {
  const { token } = useAuth();
  const { uploadState, startUpload } = useUploadVideo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<OnboardingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<VideoTab>('active');
  const [editingVideo, setEditingVideo] = useState<OnboardingVideo | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm);
  const [setupTab, setSetupTab] = useState<SetupTab>('info');
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<InteractiveQuestion[]>([]);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '', '', '']);
  const [newAnswer, setNewAnswer] = useState(0);
  const [addTime, setAddTime] = useState('');
  const [allAssignments, setAllAssignments] = useState<AssignmentLink[]>([]);
  const [currentAssignment, setCurrentAssignment] = useState<AssignmentLink | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    type?: 'danger' | 'warning' | 'info';
    icon?: 'delete' | 'lock' | 'warning';
    requireTextConfirm?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hr/onboarding/videos');
      const data = await res.json();
      if (data.success) {
        setVideos(data.data || []);
      } else {
        toast.error(data.error || 'Không thể tải danh sách video');
      }
    } catch (err) {
      console.error('Error fetching onboarding videos:', err);
      toast.error('Không thể tải danh sách video');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();

    const handleUploadDone = () => {
      setTab('draft');
      fetchVideos();
    };

    window.addEventListener('onboardingVideoUploaded', handleUploadDone);
    return () => window.removeEventListener('onboardingVideoUploaded', handleUploadDone);
  }, [fetchVideos]);

  const filteredVideos = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return videos
      .filter((video) => video.status === tab)
      .filter((video) => {
        if (!keyword) return true;
        return (
          video.title?.toLowerCase().includes(keyword) ||
          video.description?.toLowerCase().includes(keyword) ||
          video.original_filename?.toLowerCase().includes(keyword)
        );
      });
  }, [searchTerm, tab, videos]);

  const tabCounts = useMemo(
    () => ({
      active: videos.filter((video) => video.status === 'active').length,
      draft: videos.filter((video) => video.status === 'draft').length,
      inactive: videos.filter((video) => video.status === 'inactive').length,
    }),
    [videos]
  );

  const stats = useMemo(
    () => ({
      total: videos.length,
      active: tabCounts.active,
      views: videos.reduce((sum, video) => sum + (video.view_count || 0), 0),
      viewers: videos.reduce((sum, video) => sum + (video.viewers || 0), 0),
    }),
    [tabCounts.active, videos]
  );

  const openUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await startUpload(file, {
      saveEndpoint: '/api/hr/onboarding/videos',
      status: 'draft',
      successEventName: 'onboardingVideoUploaded',
      successMessage: 'Tải lên video đầu vào thành công!',
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openEdit = (video: OnboardingVideo) => {
    setEditingVideo(video);
    setForm({
      title: video.title || '',
      description: video.description || '',
      thumbnail_url: video.thumbnail_url || '',
      lesson_number: video.lesson_number?.toString() || '',
      duration_minutes: video.duration_minutes?.toString() || '30',
      start_date: video.start_date ? new Date(video.start_date).toISOString().split('T')[0] : emptyForm.start_date,
    });
    setSetupTab('info');
    setAssignmentTitle(`Bài kiểm tra sau video: ${video.title}`);
    loadQuestions(video.id);
    loadAssignments(video.id);
  };

  const closeEdit = () => {
    setEditingVideo(null);
    setForm(emptyForm);
    setSetupTab('info');
    setQuestions([]);
    setShowQuestionForm(false);
    setEditingQuestionIndex(null);
    setNewQuestion('');
    setNewOptions(['', '', '', '']);
    setNewAnswer(0);
    setAddTime('');
    setAllAssignments([]);
    setCurrentAssignment(null);
    setSelectedAssignmentId('');
    setAssignmentTitle('');
  };

  const saveVideo = async (status?: 'draft' | 'active') => {
    if (!editingVideo) return;
    if (!form.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề video');
      return;
    }
    if (status === 'active' && !currentAssignment) {
      toast.error('Vui lòng liên kết hoặc tạo bài kiểm tra sau video trước khi giao video.');
      setSetupTab('assignment');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/hr/onboarding/videos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingVideo.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          thumbnail_url: form.thumbnail_url.trim() || null,
          lesson_number: form.lesson_number ? Number(form.lesson_number) : null,
          duration_minutes: Number(form.duration_minutes) || 30,
          start_date: form.start_date || null,
          status: status || editingVideo.status,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || 'Không thể lưu video');
        return;
      }

      toast.success(status === 'active' ? 'Đã giao video cho ứng viên!' : 'Đã lưu video');
      closeEdit();
      fetchVideos();
      if (status) setTab(status);
    } catch (err) {
      console.error('Error saving onboarding video:', err);
      toast.error('Không thể lưu video');
    } finally {
      setSaving(false);
    }
  };

  const loadQuestions = async (videoId: number) => {
    setQuestionLoading(true);
    try {
      const response = await fetch(`/api/training-video-questions?video_id=${videoId}`);
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setQuestions(data.data.map((question: any) => ({
          id: question.id,
          time: Number(question.time_in_video) || 0,
          question: question.question_text,
          options: Array.isArray(question.options)
            ? question.options
            : typeof question.options === 'string'
              ? JSON.parse(question.options || '[]')
              : [],
          answer: Number.parseInt(String(question.correct_answer ?? '0'), 10) || 0,
        })));
      } else {
        setQuestions([]);
      }
    } catch (err) {
      console.error('Error loading onboarding video questions:', err);
      toast.error('Không thể tải câu hỏi trong video');
    } finally {
      setQuestionLoading(false);
    }
  };

  const loadAssignments = async (videoId: number) => {
    setAssignmentLoading(true);
    try {
      const res = await fetch('/api/training-assignments');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const assignments = data.data as AssignmentLink[];
        setAllAssignments(assignments);
        const linked = assignments.find((assignment) => Number(assignment.video_id) === videoId) || null;
        setCurrentAssignment(linked);
        setSelectedAssignmentId(linked ? String(linked.id) : '');
      }
    } catch (err) {
      console.error('Error loading onboarding assignments:', err);
      toast.error('Không thể tải bài kiểm tra');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const resetQuestionForm = () => {
    setShowQuestionForm(false);
    setEditingQuestionIndex(null);
    setNewQuestion('');
    setNewOptions(['', '', '', '']);
    setNewAnswer(0);
    setAddTime('');
  };

  const saveQuestionToDb = async (question: InteractiveQuestion) => {
    if (!editingVideo) return undefined;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    };

    const response = await fetch('/api/training-video-questions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        video_id: editingVideo.id,
        question_text: question.question,
        question_type: 'multiple_choice',
        time_in_video: question.time,
        correct_answer: question.answer.toString(),
        options: question.options,
        points: 1,
        order_number: questions.length + 1,
      }),
    });
    const data = await response.json();
    if (!data.success) {
      toast.error(data.error || 'Không thể lưu câu hỏi');
      return undefined;
    }
    return data.data.id as number;
  };

  const deleteQuestionFromDb = async (questionId: number) => {
    const response = await fetch(`/api/training-video-questions?id=${questionId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    const data = await response.json();
    if (!data.success) {
      toast.error(data.error || 'Không thể xóa câu hỏi');
    }
  };

  const handleAddQuestion = async () => {
    const normalizedOptions = newOptions.map((option) => option.trim()).filter(Boolean);
    if (!newQuestion.trim() || normalizedOptions.length < 2) {
      toast.error('Vui lòng nhập câu hỏi và ít nhất 2 đáp án.');
      return;
    }
    if (newAnswer >= normalizedOptions.length) {
      toast.error('Đáp án đúng không hợp lệ.');
      return;
    }

    const questionData: InteractiveQuestion = {
      time: Number.parseInt(addTime, 10) || 0,
      question: newQuestion.trim(),
      options: normalizedOptions,
      answer: newAnswer,
    };

    if (editingQuestionIndex !== null) {
      const currentQuestion = questions[editingQuestionIndex];
      if (currentQuestion?.id) {
        await deleteQuestionFromDb(currentQuestion.id);
      }
      const id = await saveQuestionToDb(questionData);
      setQuestions((prev) => prev.map((item, index) => index === editingQuestionIndex ? { ...questionData, id } : item));
      toast.success('Đã cập nhật câu hỏi');
    } else {
      const id = await saveQuestionToDb(questionData);
      setQuestions((prev) => [...prev, { ...questionData, id }]);
      toast.success('Đã thêm câu hỏi');
    }

    resetQuestionForm();
  };

  const handleEditQuestion = (index: number) => {
    const question = questions[index];
    setNewQuestion(question.question);
    setNewOptions([...question.options, '', '', '', ''].slice(0, 4));
    setNewAnswer(question.answer);
    setAddTime(question.time.toString());
    setEditingQuestionIndex(index);
    setShowQuestionForm(true);
  };

  const handleDeleteQuestion = (index: number) => {
    const question = questions[index];
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa câu hỏi',
      message: `Bạn có chắc muốn xóa câu hỏi "${question.question}"?`,
      confirmText: 'Xóa câu hỏi',
      type: 'danger',
      icon: 'delete',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        if (question.id) {
          await deleteQuestionFromDb(question.id);
        }
        setQuestions((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
        toast.success('Đã xóa câu hỏi');
      },
    });
  };

  const handleLinkAssignment = async () => {
    if (!editingVideo || !selectedAssignmentId) return;
    setAssignmentLoading(true);
    try {
      const response = await fetch(`/api/training-assignments?id=${selectedAssignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: editingVideo.id }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Không thể liên kết bài kiểm tra');
        return;
      }
      toast.success('Đã liên kết bài kiểm tra');
      await loadAssignments(editingVideo.id);
    } catch (err) {
      console.error('Error linking onboarding assignment:', err);
      toast.error('Không thể liên kết bài kiểm tra');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleCreateAssignment = async () => {
    if (!editingVideo || !assignmentTitle.trim()) {
      toast.error('Vui lòng nhập tên bài kiểm tra.');
      return;
    }
    setAssignmentLoading(true);
    try {
      const response = await fetch('/api/training-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: editingVideo.id,
          assignment_title: assignmentTitle.trim(),
          assignment_type: 'quiz',
          description: `Bài kiểm tra sau video ${editingVideo.title}`,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Không thể tạo bài kiểm tra');
        return;
      }
      toast.success('Đã tạo bài kiểm tra');
      await loadAssignments(editingVideo.id);
    } catch (err) {
      console.error('Error creating onboarding assignment:', err);
      toast.error('Không thể tạo bài kiểm tra');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const updateStatus = (video: OnboardingVideo, status: 'active' | 'inactive' | 'draft') => {
    const isLock = status === 'inactive';
    setConfirmDialog({
      isOpen: true,
      title: isLock ? 'Khóa video' : status === 'active' ? 'Giao video' : 'Chuyển về nháp',
      message: isLock
        ? `Bạn có chắc muốn khóa video "${video.title}"?\n\nỨng viên sẽ không còn xem được video này.`
        : status === 'active'
          ? `Bạn có chắc muốn giao video "${video.title}" cho ứng viên?`
          : `Chuyển video "${video.title}" về trạng thái nháp?`,
      confirmText: isLock ? 'Khóa video' : 'Xác nhận',
      type: isLock ? 'warning' : 'info',
      icon: isLock ? 'lock' : 'warning',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          if (status === 'active') {
            const assignmentRes = await fetch(`/api/training-assignments?video_id=${video.id}`);
            const assignmentData = await assignmentRes.json();
            if (!assignmentData.success || !Array.isArray(assignmentData.data) || assignmentData.data.length === 0) {
              toast.error('Vui lòng liên kết bài kiểm tra sau video trước khi giao video.');
              openEdit(video);
              setSetupTab('assignment');
              return;
            }
          }

          const res = await fetch('/api/hr/onboarding/videos', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: video.id, status }),
          });
          const data = await res.json();
          if (!data.success) {
            toast.error(data.error || 'Không thể cập nhật trạng thái');
            return;
          }
          toast.success('Đã cập nhật trạng thái video');
          fetchVideos();
        } catch (err) {
          console.error('Error updating onboarding video status:', err);
          toast.error('Không thể cập nhật trạng thái');
        }
      },
    });
  };

  const deleteVideo = (video: OnboardingVideo) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa video vĩnh viễn',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn video "${video.title}"?\n\nHành động này không thể hoàn tác.`,
      confirmText: 'Xóa video',
      type: 'danger',
      icon: 'delete',
      requireTextConfirm: true,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/hr/onboarding/videos?id=${video.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!data.success) {
            toast.error(data.error || 'Không thể xóa video');
            return;
          }
          toast.success('Đã xóa video');
          fetchVideos();
        } catch (err) {
          console.error('Error deleting onboarding video:', err);
          toast.error('Không thể xóa video');
        }
      },
    });
  };

  if (loading) {
    return (
      <PageContainer title="Video Đào tạo đầu vào" description="Quản lý video đào tạo cho ứng viên mới">
        <SkeletonList items={6} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Video Đào tạo đầu vào"
      description="Quản lý video onboarding theo luồng upload, nháp, giao bài và khóa video"
      headerActions={
        <Button variant="mindx" size="lg" onClick={openUpload} disabled={uploadState.isUploading}>
          <Upload className="h-4 w-4" />
          {uploadState.isUploading ? 'Đang tải lên...' : 'Upload video'}
        </Button>
      }
    >
      <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng video" value={stats.total} tone="default" />
        <StatCard label="Đang giao" value={stats.active} tone="success" />
        <StatCard label="Tổng lượt xem" value={stats.views} tone="primary" />
        <StatCard label="Người xem" value={stats.viewers} tone="violet" />
      </div>

      <Card>
        <Tabs
          tabs={[
            { id: 'active', label: 'Video đã giao', count: tabCounts.active },
            { id: 'draft', label: 'Video nháp', count: tabCounts.draft },
            { id: 'inactive', label: 'Video đã khóa', count: tabCounts.inactive },
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as VideoTab)}
        />

        <div className="my-4">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Tìm kiếm video đầu vào..." />
        </div>

        {filteredVideos.length === 0 ? (
          <EmptyState
            icon={Video}
            title={searchTerm ? 'Không tìm thấy video' : 'Chưa có video'}
            description={searchTerm ? 'Thử tìm kiếm bằng từ khóa khác' : 'Nhấn "Upload video" để thêm video mới'}
            action={!searchTerm ? { label: 'Upload video', onClick: openUpload } : undefined}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredVideos.map((video) => (
              <article
                key={video.id}
                className="group overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
              >
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt={video.title} className="h-full w-full object-cover" />
                  ) : video.video_link ? (
                    <video src={video.video_link} className="h-full w-full object-cover" preload="metadata" muted />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                      <FileVideo className="h-10 w-10" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                    <a
                      href={video.video_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 scale-90 items-center justify-center rounded-full bg-white/95 text-primary opacity-0 shadow-lg transition group-hover:scale-100 group-hover:opacity-100"
                      aria-label="Xem video"
                    >
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </a>
                  </div>
                  {video.lesson_number && (
                    <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-xs font-bold text-white">
                      Bài {video.lesson_number}
                    </span>
                  )}
                  <StatusBadge status={video.status} />
                </div>

                <div className="space-y-3 p-3">
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 min-h-10 text-sm font-bold text-foreground">{video.title}</h3>
                    {video.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{video.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {video.duration_minutes || 0} phút
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      {video.view_count || 0} lượt xem
                    </span>
                    <span className="col-span-2 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(video.start_date)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button variant="outline" size="xs" onClick={() => openEdit(video)}>
                      <Edit2 className="h-3.5 w-3.5" />
                      Sửa
                    </Button>
                    {video.status !== 'active' && (
                      <Button variant="mindx" size="xs" onClick={() => updateStatus(video, 'active')}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Giao
                      </Button>
                    )}
                    {video.status !== 'inactive' && (
                      <Button variant="outline" size="xs" onClick={() => updateStatus(video, 'inactive')}>
                        <Lock className="h-3.5 w-3.5" />
                        Khóa
                      </Button>
                    )}
                    <Button variant="destructive" size="xs" onClick={() => deleteVideo(video)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {editingVideo && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={closeEdit}>
          <div
            className="w-full max-w-6xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border bg-primary p-5 text-primary-foreground">
              <div>
                <h2 className="text-lg font-bold text-primary-foreground">Thiết lập video đầu vào</h2>
                <p className="mt-1 text-sm text-primary-foreground/75">
                  Cập nhật nội dung, câu hỏi trong video và bài kiểm tra sau video.
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={closeEdit} aria-label="Đóng" className="text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto bg-muted/30 p-5">
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <section className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="relative aspect-video bg-muted">
                      {editingVideo.thumbnail_url ? (
                        <img src={editingVideo.thumbnail_url} alt={editingVideo.title} className="h-full w-full object-cover" />
                      ) : editingVideo.video_link ? (
                        <video src={editingVideo.video_link} className="h-full w-full object-cover" preload="metadata" muted controls />
                      ) : (
                        <div className="flex h-full items-center justify-center text-primary">
                          <FileVideo className="h-12 w-12" />
                        </div>
                      )}
                      <StatusBadge status={editingVideo.status} />
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-border p-4 text-center text-sm">
                      <div>
                        <p className="font-black text-foreground">{questions.length}</p>
                        <p className="text-xs font-semibold text-muted-foreground">Câu hỏi</p>
                      </div>
                      <div>
                        <p className="font-black text-foreground">{currentAssignment ? 1 : 0}</p>
                        <p className="text-xs font-semibold text-muted-foreground">Bài kiểm tra</p>
                      </div>
                      <div>
                        <p className="font-black text-foreground">{editingVideo.duration_minutes || 0}</p>
                        <p className="text-xs font-semibold text-muted-foreground">Phút</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-1">
                    {[
                      { id: 'info', label: 'Thông tin', icon: Edit2 },
                      { id: 'questions', label: 'Câu hỏi', icon: HelpCircle },
                      { id: 'assignment', label: 'Bài kiểm tra', icon: ListChecks },
                    ].map((item) => {
                      const Icon = item.icon;
                      const active = setupTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSetupTab(item.id as SetupTab)}
                          className={`inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-bold transition ${
                            active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {setupTab === 'info' && (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <label className="block md:col-span-2">
                        <span className="mb-1.5 block text-sm font-semibold text-foreground">Tên video *</span>
                        <input
                          value={form.title}
                          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                          placeholder="VD: Giới thiệu MindX - Buổi 1"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-semibold text-foreground">Số thứ tự bài</span>
                        <input type="number" value={form.lesson_number} onChange={(event) => setForm((prev) => ({ ...prev, lesson_number: event.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="1, 2, 3..." />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-semibold text-foreground">Ngày bắt đầu</span>
                        <input type="date" value={form.start_date} onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-semibold text-foreground">Thời lượng (phút)</span>
                        <input type="number" value={form.duration_minutes} onChange={(event) => setForm((prev) => ({ ...prev, duration_minutes: event.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-semibold text-foreground">Thumbnail URL</span>
                        <input value={form.thumbnail_url} onChange={(event) => setForm((prev) => ({ ...prev, thumbnail_url: event.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="https://..." />
                      </label>
                      <label className="block md:col-span-2">
                        <span className="mb-1.5 block text-sm font-semibold text-foreground">Mô tả</span>
                        <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={4} className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="Mô tả nội dung video đào tạo đầu vào..." />
                      </label>
                    </div>
                  )}

                  {setupTab === 'questions' && (
                    <div className="mt-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-foreground">Câu hỏi trong video</h3>
                          <p className="text-sm text-muted-foreground">Video sẽ dừng tại thời điểm đặt câu hỏi.</p>
                        </div>
                        <Button variant="mindx" size="sm" onClick={() => setShowQuestionForm(true)}>
                          <Plus className="h-4 w-4" />
                          Thêm câu hỏi
                        </Button>
                      </div>

                      {showQuestionForm && (
                        <div className="rounded-lg border border-border bg-muted/40 p-4">
                          <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                            <label className="block">
                              <span className="mb-1.5 block text-xs font-bold uppercase text-muted-foreground">Giây</span>
                              <input value={addTime} onChange={(event) => setAddTime(event.target.value)} type="number" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="0" />
                            </label>
                            <label className="block">
                              <span className="mb-1.5 block text-xs font-bold uppercase text-muted-foreground">Câu hỏi</span>
                              <input value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="Nhập nội dung câu hỏi..." />
                            </label>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {newOptions.map((option, index) => (
                              <label key={index} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                                <input type="radio" checked={newAnswer === index} onChange={() => setNewAnswer(index)} className="h-4 w-4 text-primary" />
                                <input value={option} onChange={(event) => setNewOptions((prev) => prev.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={`Đáp án ${index + 1}`} />
                              </label>
                            ))}
                          </div>
                          <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={resetQuestionForm}>Hủy</Button>
                            <Button variant="mindx" size="sm" onClick={handleAddQuestion}>{editingQuestionIndex !== null ? 'Cập nhật' : 'Thêm câu hỏi'}</Button>
                          </div>
                        </div>
                      )}

                      {questionLoading ? (
                        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Đang tải câu hỏi...</div>
                      ) : questions.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Chưa có câu hỏi trong video.</div>
                      ) : (
                        <div className="space-y-3">
                          {questions.map((question, index) => (
                            <article key={question.id || index} className="rounded-lg border border-border bg-background p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold uppercase text-primary">Tại giây {question.time}</p>
                                  <h4 className="mt-1 font-bold text-foreground">{question.question}</h4>
                                  <p className="mt-2 text-sm text-muted-foreground">Đáp án đúng: {question.options[question.answer] || '-'}</p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                  <Button variant="outline" size="xs" onClick={() => handleEditQuestion(index)}>Sửa</Button>
                                  <Button variant="destructive" size="xs" onClick={() => handleDeleteQuestion(index)}>Xóa</Button>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {setupTab === 'assignment' && (
                    <div className="mt-5 space-y-4">
                      <div>
                        <h3 className="font-bold text-foreground">Bài kiểm tra sau video</h3>
                        <p className="text-sm text-muted-foreground">Ứng viên hoàn thành video rồi làm bài kiểm tra được liên kết tại đây.</p>
                      </div>

                      {currentAssignment ? (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                          <p className="text-xs font-bold uppercase text-primary">Đang liên kết</p>
                          <h4 className="mt-1 text-lg font-bold text-foreground">{currentAssignment.assignment_title}</h4>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
                            <span className="rounded-full bg-background px-3 py-1">{currentAssignment.assignment_type || 'quiz'}</span>
                            <span className="rounded-full bg-background px-3 py-1">{currentAssignment.question_count || 0} câu hỏi</span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => window.open(`/admin/assignment-questions?assignment_id=${currentAssignment.id}`, '_blank')}>
                              Quản lý câu hỏi
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm font-semibold text-warning">
                          Chưa có bài kiểm tra sau video. Video cần bài kiểm tra trước khi giao cho ứng viên.
                        </div>
                      )}

                      <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4">
                        <label className="block">
                          <span className="mb-1.5 block text-sm font-semibold text-foreground">Chọn bài kiểm tra có sẵn</span>
                          <select value={selectedAssignmentId} onChange={(event) => setSelectedAssignmentId(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">
                            <option value="">-- Chọn bài kiểm tra --</option>
                            {allAssignments.map((assignment) => (
                              <option key={assignment.id} value={assignment.id}>
                                {assignment.assignment_title}{assignment.video_id ? ` (Video #${assignment.video_id})` : ' (Chưa liên kết)'}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button variant="secondary" onClick={handleLinkAssignment} disabled={!selectedAssignmentId || assignmentLoading}>
                          Liên kết bài kiểm tra
                        </Button>
                      </div>

                      <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4">
                        <label className="block">
                          <span className="mb-1.5 block text-sm font-semibold text-foreground">Tạo nhanh bài kiểm tra mới</span>
                          <input value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="Tên bài kiểm tra..." />
                        </label>
                        <Button variant="mindx" onClick={handleCreateAssignment} disabled={assignmentLoading}>
                          <Plus className="h-4 w-4" />
                          Tạo và liên kết
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/40 p-5 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeEdit}>
                Hủy
              </Button>
              <Button variant="secondary" onClick={() => saveVideo('draft')} loading={saving}>
                <Save className="h-4 w-4" />
                Lưu nháp
              </Button>
              <Button variant="mindx" onClick={() => saveVideo('active')} loading={saving}>
                <CheckCircle2 className="h-4 w-4" />
                Giao video
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        type={confirmDialog.type}
        icon={confirmDialog.icon}
        requireTextConfirm={confirmDialog.requireTextConfirm}
      />
    </PageContainer>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'default' | 'success' | 'primary' | 'violet';
}) {
  const toneClass = {
    default: 'text-foreground',
    success: 'text-emerald-600',
    primary: 'text-primary',
    violet: 'text-violet-600',
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config =
    status === 'active'
      ? { label: 'Đã giao', className: 'bg-emerald-100 text-emerald-700' }
      : status === 'inactive'
        ? { label: 'Đã khóa', className: 'bg-slate-200 text-slate-700' }
        : { label: 'Nháp', className: 'bg-amber-100 text-amber-700' };

  return (
    <span className={`absolute right-2 top-2 rounded-md px-2 py-1 text-xs font-bold ${config.className}`}>
      {config.label}
    </span>
  );
}
