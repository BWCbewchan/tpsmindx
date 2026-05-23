'use client';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PageContainer } from '@/components/PageContainer';
import { SkeletonTable } from '@/components/skeletons';
import { Edit, List, Plus, Trash2, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/app-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Assignment {
  id: number;
  video_id: number;
  video_title: string;
  assignment_title: string;
  assignment_type: string;
  description: string;
  question_count: number;
}

interface TrainingVideoOption {
  id: number;
  title: string;
  lesson_number?: number;
}

export default function AssignmentManagementPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [videos, setVideos] = useState<TrainingVideoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromVideoId = searchParams.get('from_video'); // video_id được truyền từ video-setup

  const [formData, setFormData] = useState({
    video_id: '',
    assignment_title: '',
    assignment_type: 'quiz',
    description: '',
  });

  useEffect(() => {
    fetchAssignments();
    fetchVideos();
  }, []);

  // Nếu có from_video → tự mở modal và điền sẵn video_id
  useEffect(() => {
    if (fromVideoId && videos.length > 0) {
      setFormData(prev => ({ ...prev, video_id: fromVideoId }));
      setShowModal(true);
    }
  }, [fromVideoId, videos]);

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/training-videos');
      const data = await response.json();
      if (data.success) {
        setVideos(data.data);
      }
    } catch (err) {
      console.error('Error fetching videos:', err);
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/training-assignments');
      const data = await response.json();
      if (data.success) {
        setAssignments(data.data);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId 
        ? `/api/training-assignments?id=${editingId}` 
        : '/api/training-assignments';
      
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId 
        ? { id: editingId, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.success) {
        toast.success(editingId ? 'Cập nhật assignment thành công!' : 'Tạo assignment thành công!');
        setShowModal(false);
        resetForm();
        fetchAssignments();
        // Sau khi tạo mới: chuyển đến trang quản lý câu hỏi
        if (!editingId && data.data?.id) {
          router.push(`/admin/assignment-questions?assignment_id=${data.data.id}`);
        }
      } else {
        toast.error('Lỗi: ' + data.error);
      }
    } catch (err) {
      console.error('Error saving assignment:', err);
      toast.error('Lỗi khi lưu assignment');
    }
  };

  const handleEdit = (assignment: Assignment) => {
    setEditingId(assignment.id);
    setFormData({
      video_id: assignment.video_id.toString(),
      assignment_title: assignment.assignment_title,
      assignment_type: assignment.assignment_type,
      description: assignment.description || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa assignment này?')) return;
    
    try {
      const response = await fetch(`/api/training-assignments?id=${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Xóa assignment thành công!');
        fetchAssignments();
      } else {
        toast.error('Lỗi: ' + data.error);
      }
    } catch (err) {
      console.error('Error deleting assignment:', err);
      toast.error('Lỗi khi xóa assignment');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      video_id: '',
      assignment_title: '',
      assignment_type: 'quiz',
      description: '',
    });
  };

  const handleManageQuestions = (assignmentId: number) => {
    router.push(`/admin/assignment-questions?assignment_id=${assignmentId}`);
  };

  if (loading) {
    return (
      <PageContainer title="Quản lý Assignment" description="Quản lý câu hỏi và bài tập">
        <SkeletonTable />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Cấu hình bài kiểm tra"
      description="Tạo và quản lý bài tập, quiz cho video đào tạo"
    >
      {/* Create Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-[#a1001f] hover:bg-[#c41230] text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tạo Assignment mới
        </button>
      </div>

      <Card>
        {error ? (
          <div className="text-red-600 text-center py-8">{error}</div>
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={List}
            title="Chưa có assignment"
            description='Nhấn "Tạo Assignment mới" để thêm bài tập cho video'
            action={{
              label: "Tạo Assignment",
              onClick: () => { resetForm(); setShowModal(true); }
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Tên Assignment</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-center">Câu hỏi</TableHead>
                  <TableHead className="text-center">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment, idx) => (
                  <TableRow key={assignment.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="max-w-xs truncate">{assignment.video_title}</TableCell>
                    <TableCell className="font-medium">{assignment.assignment_title}</TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                        {assignment.assignment_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{assignment.question_count || 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleManageQuestions(assignment.id)}
                          className="p-1.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                          title="Quản lý câu hỏi"
                        >
                          <List className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(assignment)}
                          className="p-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                          title="Sửa"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(assignment.id)}
                          className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
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
        )}
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {editingId ? 'Chỉnh sửa Assignment' : 'Tạo Assignment mới'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-sm font-medium">Video ID *</label>
                  <select
                    required
                    value={formData.video_id}
                    onChange={e => setFormData({...formData, video_id: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                  >
                    <option value="">-- Chọn video --</option>
                    {videos.map((video) => (
                      <option key={video.id} value={video.id.toString()}>
                        #{video.id} {video.lesson_number ? `• L${video.lesson_number}` : ''} • {video.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">Loại *</label>
                  <select
                    value={formData.assignment_type}
                    onChange={e => setFormData({...formData, assignment_type: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                  >
                    <option value="quiz">Quiz</option>
                    <option value="test">Test</option>
                    <option value="exam">Exam</option>
                    <option value="practice">Practice</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Tên Assignment *</label>
                <input
                  type="text"
                  required
                  value={formData.assignment_title}
                  onChange={e => setFormData({...formData, assignment_title: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#a1001f] hover:bg-[#c41230] text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {editingId ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
