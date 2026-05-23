'use client';

import { ASSIGNMENT_TYPES, TIME_PRESETS } from '@/lib/assignment-constants';
import { Assignment, AssignmentFormData } from '@/types/assignment';
import { Check, ChevronRight, FileText, Settings, Video } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

interface AssignmentWizardProps {
  onSubmit: (data: AssignmentFormData) => void;
  onCancel: () => void;
  initialData?: Partial<Assignment>;
  isSubmitting?: boolean;
  isEditing?: boolean;
}

type Step = 1 | 2 | 3;

interface TrainingVideoOption {
  id: number;
  title: string;
  description?: string;
  start_date?: string;
  duration_minutes?: number;
  lesson_number?: number;
}

export function AssignmentWizard({ onSubmit, onCancel, initialData, isSubmitting = false, isEditing = false }: AssignmentWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [videos, setVideos] = useState<TrainingVideoOption[]>([]);
  
  const [formData, setFormData] = useState<AssignmentFormData>({
    video_id: initialData?.video_id?.toString() || '',
    assignment_title: initialData?.assignment_title || '',
    assignment_type: initialData?.assignment_type || 'quiz',
    description: initialData?.description || '',
    total_points: initialData?.total_points?.toString() || '10',
    passing_score: initialData?.passing_score?.toString() || '7',
    time_limit_minutes: initialData?.time_limit_minutes?.toString() || '30',
    max_attempts: initialData?.max_attempts?.toString() || '0',
    is_required: initialData?.is_required ?? true,
    due_date: initialData?.due_date || '',
    status: initialData?.status || 'draft'
  });

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  const fetchVideos = useCallback(async () => {
    try {
      const response = await fetch('/api/training-videos');
      const data = await response.json();
      if (data.success) {
        setVideos(data.data);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const steps = [
    { number: 1, title: 'Chọn video', icon: Video },
    { number: 2, title: 'Thông tin cơ bản', icon: FileText },
    { number: 3, title: 'Cài đặt', icon: Settings }
  ];

  const canProceed = () => {
    if (currentStep === 1) return formData.video_id !== '';
    if (currentStep === 2) return formData.assignment_title.trim() !== '';
    return true;
  };

  const selectedVideo = videos.find((video) => video.id.toString() === formData.video_id);

  const handleNext = () => {
    if (canProceed() && currentStep < 3) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const handleSubmit = () => {
    if (canProceed()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header with Steps */}
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {isEditing ? 'Chỉnh sửa bài tập' : 'Tạo bài tập mới'}
          </h2>
          
          {/* Step Indicator */}
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              
              return (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <div className="ml-3">
                      <div
                        className={`text-sm font-semibold ${
                          isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        Bước {step.number}
                      </div>
                      <div className={`text-xs ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                        {step.title}
                      </div>
                    </div>
                  </div>
                  
                  {idx < steps.length - 1 && (
                    <div className="flex-1 h-0.5 mx-4 bg-gray-200">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isCompleted ? 'bg-green-500 w-full' : 'bg-gray-200 w-0'
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Step 1: Chọn Video */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Chọn video liên kết</h3>
                <p className="text-sm text-gray-600">Bài tập này sẽ được gắn với video nào?</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Video ID <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.video_id}
                  onChange={(e) => setFormData({ ...formData, video_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn video muốn tạo assignment --</option>
                  {videos.map((video) => (
                    <option key={video.id} value={video.id}>
                      #{video.id} {video.lesson_number ? `• L${video.lesson_number}` : ''} • {video.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedVideo && (
                <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                  <div className="font-semibold text-gray-900">{selectedVideo.title}</div>
                  {selectedVideo.description && (
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">{selectedVideo.description}</div>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                    {selectedVideo.start_date && (
                      <span>📅 {new Date(selectedVideo.start_date).toLocaleDateString('vi-VN')}</span>
                    )}
                    {!!selectedVideo.duration_minutes && <span>⏱️ {selectedVideo.duration_minutes} phút</span>}
                    {selectedVideo.lesson_number && <span className="px-2 py-0.5 bg-white rounded">L{selectedVideo.lesson_number}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Thông tin cơ bản */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Thông tin cơ bản</h3>
                <p className="text-sm text-gray-600">Điền thông tin chi tiết cho bài tập</p>
              </div>

              {/* Assignment Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Loại bài tập <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ASSIGNMENT_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.assignment_type === type.value
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <input
                        type="radio"
                        name="type"
                        value={type.value}
                        checked={formData.assignment_type === type.value}
                        onChange={(e) => setFormData({ ...formData, assignment_type: e.target.value as any })}
                        className="sr-only"
                      />
                      <div className="text-4xl">{type.icon}</div>
                      <div className="font-semibold text-center">{type.label}</div>
                      <div className="text-xs text-gray-500 text-center">{type.description}</div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tiêu đề <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.assignment_title}
                  onChange={(e) => setFormData({ ...formData, assignment_title: e.target.value })}
                  placeholder="VD: Bài kiểm tra cuối khóa Python cơ bản"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mô tả
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả ngắn gọn về bài tập này..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 3: Cài đặt */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Cài đặt bài tập</h3>
                <p className="text-sm text-gray-600">Thiết lập điểm số và quy định</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Total Points */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tổng điểm
                  </label>
                  <input
                    type="number"
                    value={formData.total_points}
                    onChange={(e) => setFormData({ ...formData, total_points: e.target.value })}
                    min="1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Passing Score */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Điểm đạt
                  </label>
                  <input
                    type="number"
                    value={formData.passing_score}
                    onChange={(e) => setFormData({ ...formData, passing_score: e.target.value })}
                    min="1"
                    max={formData.total_points}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Time Limit */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Thời gian làm bài (phút)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {TIME_PRESETS.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setFormData({ ...formData, time_limit_minutes: time.toString() })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.time_limit_minutes === time.toString()
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {time}'
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={formData.time_limit_minutes}
                  onChange={(e) => setFormData({ ...formData, time_limit_minutes: e.target.value })}
                  min="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Max Attempts */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Số lần làm tối đa
                </label>
                <input
                  type="number"
                  value={formData.max_attempts}
                  onChange={(e) => setFormData({ ...formData, max_attempts: e.target.value })}
                  min="0"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Nhập 0 để không giới hạn</p>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Hạn nộp
                </label>
                <input
                  type="datetime-local"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_required}
                    onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Bắt buộc hoàn thành</div>
                    <div className="text-xs text-gray-600">Giáo viên phải hoàn thành bài tập này</div>
                  </div>
                </label>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Trạng thái
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="draft">Nháp</option>
                    <option value="published">Công bố</option>
                    <option value="archived">Lưu trữ</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            Hủy
          </button>
          
          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Quay lại
              </button>
            )}
            
            {currentStep < 3 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Tiếp tục</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-5 w-5 bg-white/50 rounded-full animate-pulse"></div>
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>{isEditing ? 'Cập nhật' : 'Tạo bài tập'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
