'use client';

import { Question } from '@/types/assignment';
import { CheckCircle, Download, FileText, Filter, Plus, Search, Smile, SortAsc, Target, Upload } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { QuestionCard } from './QuestionCard';

interface QuestionListProps {
  questions: Question[];
  onAddQuestion: () => void;
  onEditQuestion: (question: Question) => void;
  onDeleteQuestion: (id: number) => void;
  onReorder?: (questions: Question[]) => void;
  onImportCSV?: () => void;
  onExportCSV?: () => void;
}

export function QuestionList({
  questions,
  onAddQuestion,
  onEditQuestion,
  onDeleteQuestion,
  onReorder,
  onImportCSV,
  onExportCSV
}: QuestionListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevQuestionsLength = useRef(questions.length);

  // Auto scroll to bottom when a new question is added
  useEffect(() => {
    if (questions.length > prevQuestionsLength.current) {
      const timer = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }, 50);
      return () => clearTimeout(timer);
    }
    prevQuestionsLength.current = questions.length;
  }, [questions.length]);

  const handleAddClick = () => {
    onAddQuestion();
    // Also scroll to bottom to show where the new question will appear/the placeholder
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 50);
  };

  const totalPoints = questions.reduce((sum, q) => {
    const points = Number(q.points) || 0;
    return sum + points;
  }, 0);

  // Filter questions
  const filteredQuestions = questions.filter(q => {
    // Strip HTML tags for search
    const plainText = q.question_text.replace(/<[^>]*>/g, '').toLowerCase();
    const matchesSearch = plainText.includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || q.question_type === filterType;
    const matchesDifficulty = filterDifficulty === 'all' || q.difficulty === filterDifficulty;
    return matchesSearch && matchesType && matchesDifficulty;
  }).sort((a, b) => a.order_number - b.order_number);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === filteredQuestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQuestions.map(q => q.id));
    }
  }, [selectedIds, filteredQuestions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Tìm kiếm câu hỏi..."]') as HTMLInputElement;
        searchInput?.focus();
      }
      // Ctrl/Cmd + N: Add new question
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleAddClick();
      }
      // Ctrl/Cmd + A: Select all (when not in input)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !(e.target as HTMLElement).matches('input, textarea')) {
        e.preventDefault();
        toggleSelectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAddQuestion, toggleSelectAll]);

  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;

    const items = Array.from(filteredQuestions);
    const draggedQuestion = items[draggedItem];
    items.splice(draggedItem, 1);
    items.splice(index, 0, draggedQuestion);

    // Update order numbers
    const reordered = items.map((q, idx) => ({
      ...q,
      order_number: idx + 1
    }));

    onReorder?.(reordered);
    setDraggedItem(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedIds.length === 0) return;

    if (bulkAction === 'delete') {
      if (confirm(`Xóa ${selectedIds.length} câu hỏi đã chọn?`)) {
        selectedIds.forEach(id => onDeleteQuestion(id));
        setSelectedIds([]);
        setBulkAction('');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      {questions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {questions.length}
                </div>
                <div className="text-xs text-gray-600">Tổng câu hỏi</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {totalPoints}
                </div>
                <div className="text-xs text-gray-600">Tổng điểm</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {questions.filter(q => q.question_type === 'multiple_choice').length}
                </div>
                <div className="text-xs text-gray-600">Trắc nghiệm</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Smile className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {questions.filter(q => q.difficulty === 'easy').length}
                </div>
                <div className="text-xs text-gray-600">Mức Dễ</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with Search & Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="text-sm text-gray-600">
            {filteredQuestions.length} / {questions.length} câu hỏi
            {selectedIds.length > 0 && ` • ${selectedIds.length} câu đã chọn`}
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <select
                  value={bulkAction}
                  onChange={(e) => {
                    setBulkAction(e.target.value);
                    if (e.target.value) {
                      setTimeout(() => handleBulkAction(), 0);
                    }
                  }}
                  className="text-sm border-none bg-transparent focus:outline-none font-medium text-blue-700"
                >
                  <option value="">Chọn thao tác...</option>
                  <option value="delete">🗑️ Xóa đã chọn</option>
                </select>
              </div>
            )}
            
            {onImportCSV && (
              <button
                onClick={onImportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                title="Import câu hỏi từ CSV"
              >
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">Import</span>
              </button>
            )}
            {onExportCSV && questions.length > 0 && (
              <button
                onClick={onExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                title="Export câu hỏi ra CSV"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">Export</span>
              </button>
            )}
            <button
              onClick={handleAddClick}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-200/50 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium">Thêm câu hỏi</span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm câu hỏi..."
              title="Tìm kiếm (Ctrl/Cmd + K)"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>

          {/* Filter by Type */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none"
            >
              <option value="all">Tất cả loại</option>
              <option value="multiple_choice">Trắc nghiệm</option>
              <option value="multiple_select">Chọn nhiều</option>
              <option value="true_false">Đúng/Sai</option>
              <option value="short_answer">Trả lời ngắn</option>
              <option value="essay">Tự luận</option>
            </select>
          </div>

          {/* Filter by Difficulty */}
          <div className="relative">
            <SortAsc className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none"
            >
              <option value="all">Tất cả độ khó</option>
              <option value="easy">😊 Dễ</option>
              <option value="medium">😐 Trung bình</option>
              <option value="hard">😰 Khó</option>
            </select>
          </div>
        </div>
        
        {/* Select All Checkbox */}
        {filteredQuestions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200">
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={selectedIds.length === filteredQuestions.length && filteredQuestions.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                Chọn tất cả ({filteredQuestions.length})
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Questions */}
      {filteredQuestions.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-xl">
          <div className="text-7xl mb-4">📝</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {searchTerm || filterType !== 'all' || filterDifficulty !== 'all'
              ? 'Không tìm thấy câu hỏi nào'
              : 'Chưa có câu hỏi nào'}
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {searchTerm || filterType !== 'all' || filterDifficulty !== 'all'
              ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'
              : 'Bắt đầu bằng cách thêm câu hỏi mới hoặc import từ CSV'}
          </p>
          {!searchTerm && filterType === 'all' && filterDifficulty === 'all' && (
            <button
              onClick={handleAddClick}
              className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg font-semibold"
            >
              <Plus className="w-5 h-5" />
              <span>Tạo câu hỏi đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((question, index) => (
            <div
              key={question.id}
              draggable={onReorder !== undefined}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative ${
                draggedItem === index ? 'opacity-50' : 'opacity-100'
              } ${selectedIds.includes(question.id) ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}
            >
              {/* Checkbox overlay */}
              <label 
                className="absolute top-4 left-4 z-10 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(question.id)}
                  onChange={() => toggleSelect(question.id)}
                  className="w-5 h-5 text-blue-600 rounded border-2 border-gray-300"
                />
              </label>
              
              <QuestionCard
                question={question}
                index={index}
                onEdit={onEditQuestion}
                onDelete={onDeleteQuestion}
                isDraggable={onReorder !== undefined}
              />
            </div>
          ))}

          {/* Add Question Placeholder Card */}
          {!searchTerm && filterType === 'all' && filterDifficulty === 'all' && (
            <div 
              onClick={handleAddClick}
              className="group bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer border-dashed hover:border-blue-400 hover:bg-blue-50/30"
            >
              <div className="flex items-start gap-3">
                {/* Drag Handle Placeholder */}
                {onReorder !== undefined && (
                  <div className="pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-5 h-5 bg-gray-100 rounded" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-gray-100 group-hover:bg-blue-100 rounded-lg flex items-center justify-center transition-colors">
                      <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                    </div>
                    <span className="px-2 py-0.5 bg-gray-100 group-hover:bg-blue-100 text-gray-500 group-hover:text-blue-700 rounded text-xs font-semibold transition-colors">
                      Câu {questions.length + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-400 group-hover:text-blue-500 italic transition-colors">
                      (Chưa lưu - Bấm để thêm mới)
                    </span>
                    <span className="ml-auto text-sm font-bold text-gray-300">
                      ? điểm
                    </span>
                  </div>
                  
                  <div className="text-gray-400 font-medium mb-2 italic">
                    Bấm vào đây để thêm câu hỏi mới...
                  </div>

                  <div className="flex gap-2">
                    <div className="h-8 px-4 bg-gray-50 rounded-md border border-gray-100 flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full border border-gray-300" />
                       <div className="h-2 w-12 bg-gray-200 rounded" />
                    </div>
                    <div className="h-8 px-4 bg-gray-50 rounded-md border border-gray-100 flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full border border-gray-300" />
                       <div className="h-2 w-12 bg-gray-200 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-10 w-full" />
        </div>
      )}
    </div>
  );
}
