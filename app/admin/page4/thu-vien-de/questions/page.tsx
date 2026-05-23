'use client';

import { PageContainer } from '@/components/PageContainer';
import { QuestionBuilder, QuestionList } from '@/components/assignments';
import { Question } from '@/types/assignment';
import { ArrowLeft, Download, FileText, Upload } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/app-toast';

type DbDifficulty = 'easy' | 'medium' | 'hard';

interface SetQuestionRequestPayload {
  set_id: number;
  question_text: string;
  question_type: Question['question_type'];
  correct_answer: string;
  options: string[] | null;
  image_url: string | null;
  explanation: string;
  points: number;
  order_number: number;
  difficulty: DbDifficulty;
}

interface ExamSetInfo {
  id: number;
  set_code: string;
  set_name: string;
  subject_name: string;
}

const mapDifficultyToDb = (difficulty?: Question['difficulty'] | string): DbDifficulty => {
  switch (difficulty) {
    case 'easy':
      return 'easy';
    case 'hard':
      return 'hard';
    case 'medium':
    default:
      return 'medium';
  }
};

function ExamSetQuestionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setId = searchParams.get('set_id');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [setInfo, setSetInfo] = useState<ExamSetInfo | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (setId) {
      fetchQuestions();
      fetchSetInfo();
    }
  }, [setId]);

  const fetchSetInfo = async () => {
    try {
      const response = await fetch(`/api/exam-sets?id=${setId}`);
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        setSetInfo(data.data[0]);
      }
    } catch (error) {
      console.error('Error fetching set info:', error);
    }
  };

  const fetchQuestions = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch(`/api/exam-set-questions?set_id=${setId}`);
      const data = await response.json();
      if (data.success) {
        setQuestions(data.data);
      }
    } catch (error) {
      console.error('Error fetching set questions:', error);
      toast.error('Lỗi tải câu hỏi');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async (questionData: Partial<Question>) => {
    try {
      const isEditing = editingQuestion?.id;
      const method = isEditing ? 'PUT' : 'POST';
      const questionText = (questionData.question_text || '').trim();
      const normalizedQuestionText = questionText || '[Tạm] Chưa dán nội dung từ doc';
      const questionType: Question['question_type'] = questionData.question_type || 'multiple_choice';
      const normalizedOptions = Array.isArray(questionData.options)
        ? questionData.options.map((option) => option.trim()).filter(Boolean)
        : null;
      let correctAnswer = String(questionData.correct_answer || '').trim();

      if (questionType === 'multiple_choice') {
        if (!normalizedOptions || normalizedOptions.length < 2) {
          toast.error('Câu hỏi trắc nghiệm cần ít nhất 2 đáp án');
          return;
        }

        if (!correctAnswer) {
          toast.error('Vui lòng chọn đáp án đúng');
          return;
        }

        if (!normalizedOptions.includes(correctAnswer)) {
          const indexAnswer = Number.parseInt(correctAnswer, 10);
          if (!Number.isNaN(indexAnswer) && indexAnswer >= 0 && indexAnswer < normalizedOptions.length) {
            correctAnswer = normalizedOptions[indexAnswer];
          } else {
            toast.error('Đáp án đúng phải khớp với một trong các đáp án');
            return;
          }
        }
      }

      const payload: SetQuestionRequestPayload = {
        set_id: Number(setId),
        question_text: normalizedQuestionText,
        question_type: questionType,
        correct_answer: correctAnswer,
        options: questionType === 'multiple_choice' || questionType === 'true_false' || questionType === 'multiple_select'
          ? normalizedOptions
          : null,
        image_url: questionData.image_url || null,
        explanation: questionData.explanation || '',
        points: Number(questionData.points || 1),
        order_number: isEditing ? editingQuestion.order_number : questions.length + 1,
        difficulty: mapDifficultyToDb(questionData.difficulty),
      };

      const requestPayload = isEditing
        ? { ...payload, id: editingQuestion.id }
        : payload;

      // --- OPTIMISTIC UI ---
      // Close modal and update state immediately
      setShowBuilder(false);
      setEditingQuestion(null);

      if (!isEditing) {
        const optimisticQuestion: Question = {
          id: -Date.now(), // Temporary ID
          ...payload,
          assignment_id: 0, // Satisfy Question type
          difficulty: payload.difficulty as any
        };
        setQuestions(prev => [...prev, optimisticQuestion]);
      } else {
        setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? { ...q, ...payload, assignment_id: 0 } as Question : q));
      }
      // ---------------------

      const response = await fetch('/api/exam-set-questions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(isEditing ? 'Cập nhật câu hỏi thành công!' : 'Tạo câu hỏi thành công!');
        fetchQuestions(true); // Sync with DB silently
      } else {
        toast.error('Lỗi: ' + data.error);
        fetchQuestions(true); // Rollback
      }
    } catch (error) {
      console.error('Error saving set question:', error);
      toast.error('Lỗi khi lưu câu hỏi');
      fetchQuestions(true); // Rollback
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    try {
      // --- OPTIMISTIC UI ---
      const originalQuestions = [...questions];
      setQuestions(prev => prev.filter(q => q.id !== id));
      // ---------------------

      const response = await fetch(`/api/exam-set-questions?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Xóa câu hỏi thành công!');
        fetchQuestions(true); // Sync silently
      } else {
        toast.error('Lỗi: ' + data.error);
        setQuestions(originalQuestions); // Rollback
      }
    } catch (error) {
      console.error('Error deleting set question:', error);
      toast.error('Lỗi khi xóa câu hỏi');
      fetchQuestions(true); // Rollback
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setShowBuilder(true);
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setShowBuilder(true);
  };

  const handleReorderQuestions = (reorderedQuestions: Question[]) => {
    setQuestions(reorderedQuestions);
  };

  const handleImportCSV = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Vui lòng chọn file CSV');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('set_id', setId || '');

    try {
      setImporting(true);
      const response = await fetch('/api/exam-set-questions/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message || `Import thành công ${data.imported} câu hỏi!`);
        fetchQuestions();
      } else {
        toast.error(data.error || 'Lỗi khi import');
      }
    } catch (error) {
      console.error('Error importing set questions:', error);
      toast.error('Lỗi khi import câu hỏi');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/exam-set-questions/template');
      if (!response.ok) {
        toast.error('Lỗi khi tải file mẫu');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mau_cau_hoi_bo_de.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Tải file mẫu thành công!');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Lỗi khi tải file mẫu');
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`/api/exam-set-questions/export?set_id=${setId}`);

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Lỗi khi export');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cau_hoi_bo_de_${setId}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Export thành công!');
    } catch (error) {
      console.error('Error exporting set questions:', error);
      toast.error('Lỗi khi export câu hỏi');
    }
  };

  if (!setId) {
    return (
      <PageContainer title="Quản lý câu hỏi bộ đề">
        <div className="text-center py-12">
          <p className="text-red-600">Không tìm thấy bộ đề</p>
          <button
            onClick={() => router.push('/admin/thu-vien-de')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Quay lại thư viện đề
          </button>
        </div>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer title="Quản lý câu hỏi bộ đề">
        <div className="animate-pulse space-y-6 p-6">
          <div className="h-8 bg-gray-300 rounded w-1/3"></div>
          <div className="h-10 bg-gray-300 rounded"></div>
          <div className="grid grid-cols-1 gap-4">
            <div className="h-24 bg-gray-300 rounded"></div>
            <div className="h-24 bg-gray-300 rounded"></div>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Quản lý câu hỏi bộ đề"
      description={setInfo ? `${setInfo.set_code} - ${setInfo.set_name} (${setInfo.subject_name})` : 'Tạo và chỉnh sửa câu hỏi cho bộ đề'}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/admin/thu-vien-de')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại thư viện đề</span>
        </button>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
              title="Tải file mẫu CSV"
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">File mẫu</span>
            </button>

            <button
              onClick={handleImportCSV}
              disabled={importing}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              <span className="text-sm font-medium">{importing ? 'Đang import...' : 'Import'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={questions.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export</span>
            </button>
          </div>
        </div>
      </div>

      <QuestionList
        questions={questions}
        onAddQuestion={handleAddQuestion}
        onEditQuestion={handleEditQuestion}
        onDeleteQuestion={handleDeleteQuestion}
        onReorder={handleReorderQuestions}
        onImportCSV={handleImportCSV}
        onExportCSV={handleExportCSV}
      />

      {showBuilder && (
        <QuestionBuilder
          onSave={handleSaveQuestion}
          onCancel={() => {
            setShowBuilder(false);
            setEditingQuestion(null);
          }}
          initialData={editingQuestion || undefined}
          assignmentId={Number(setId)}
        />
      )}
    </PageContainer>
  );
}

export default function ExamSetQuestionsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ExamSetQuestionsContent />
    </Suspense>
  );
}
