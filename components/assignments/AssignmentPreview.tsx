'use client';

import { DIFFICULTY_LEVELS } from '@/lib/assignment-constants';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { Question } from '@/types/assignment';
import { Award, CheckCheck, CheckSquare, Clock, FileText, ListChecks, PenLine, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/app-toast';

interface AssignmentPreviewProps {
  assignment: {
    assignment_title: string;
    assignment_description?: string;
    assignment_type?: string;
    time_limit?: number;
    video_title?: string;
  };
  questions: Question[];
  onClose: () => void;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  CheckSquare,
  CheckCheck,
  ListChecks,
  PenLine,
  FileText
};

export function AssignmentPreview({ assignment, questions, onClose }: AssignmentPreviewProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const decodeEscapedHtml = (value: string) => {
    if (!value || !value.includes('&lt;')) return value;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  };
  const hasHtmlMarkup = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);
  const totalPoints = questions.reduce((sum, q) => {
    const points = Number(q.points) || 0;
    return sum + points;
  }, 0);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const getQuestionIcon = (type: string) => {
    const iconName = {
      'multiple_choice': 'CheckSquare',
      'multiple_select': 'ListChecks',
      'true_false': 'CheckCheck',
      'short_answer': 'PenLine',
      'essay': 'FileText'
    }[type] || 'FileText';

    const IconComponent = iconMap[iconName];
    return IconComponent;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{assignment.assignment_title}</h2>
              {assignment.video_title && (
                <p className="text-sm text-gray-600 mt-1">Video: {assignment.video_title}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Info Bar */}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
              <Award className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-blue-700">{totalPoints} điểm</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg">
              <FileText className="w-4 h-4 text-purple-600" />
              <span className="font-semibold text-purple-700">{questions.length} câu hỏi</span>
            </div>
            {assignment.time_limit && (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="font-semibold text-orange-700">{assignment.time_limit} phút</span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {assignment.assignment_description && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <p className="text-gray-700">{assignment.assignment_description}</p>
          </div>
        )}

        {/* Questions */}
        <div className="px-6 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {questions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Chưa có câu hỏi nào</p>
            </div>
          ) : (
            questions.map((question, index) => {
              const IconComponent = getQuestionIcon(question.question_type);
              const difficultyLevel = DIFFICULTY_LEVELS.find(d => d.value === question.difficulty);

              // Map Bloom colors to Tailwind classes
              const getDifficultyColor = () => {
                const colorMap: Record<string, { bg: string; text: string }> = {
                  green: { bg: 'bg-green-100', text: 'text-green-700' },
                  blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
                  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
                  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
                  orange: { bg: 'bg-orange-100', text: 'text-orange-700' },
                  purple: { bg: 'bg-purple-100', text: 'text-purple-700' },
                  red: { bg: 'bg-red-100', text: 'text-red-700' }
                };
                return colorMap[difficultyLevel?.color || 'blue'];
              };

              const difficultyColors = getDifficultyColor();

              return (
                <div key={question.id} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  {/* Question Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                          {IconComponent && <IconComponent className="w-4 h-4 text-blue-600" />}
                        </div>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                          {question.points || 0} điểm
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${difficultyColors.bg} ${difficultyColors.text}`}>
                          {difficultyLevel?.icon} {difficultyLevel?.label}
                        </span>
                      </div>
                      <div
                        className="text-gray-900 font-medium text-lg prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.question_text) }}
                      />
                    </div>
                  </div>

                  {/* Question Image */}
                  {question.image_url && (
                    <div className="mb-4 pl-13">
                      { }
                      <img
                        src={question.image_url}
                        alt="Question"
                        width={400}
                        height={300}
                        className="rounded-lg border border-gray-300"
                      />
                    </div>
                  )}

                  {/* Answer Options */}
                  <div className="pl-13">
                    {/* Multiple Choice */}
                    {question.question_type === 'multiple_choice' && question.options && (
                      <div className="space-y-2">
                        {question.options.map((option, idx) => (
                          <label
                            key={idx}
                            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${answers[question.id] === option
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                              }`}
                          >
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value={option}
                              checked={answers[question.id] === option}
                              onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                              className="w-5 h-5"
                            />
                            {(() => {
                              const normalizedOption = decodeEscapedHtml(String(option));
                              const renderAsHtml = hasHtmlMarkup(normalizedOption);

                              if (renderAsHtml) {
                                return (
                                  <div
                                    className="prose prose-sm max-w-none flex-1 font-medium text-gray-900 [&_.tiptap-image]:inline-block [&_.tiptap-image]:max-w-full [&_img]:h-auto"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(normalizedOption) }}
                                  />
                                );
                              }

                              return <span className="flex-1 font-medium text-gray-900">{normalizedOption}</span>;
                            })()}
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Multiple Select */}
                    {question.question_type === 'multiple_select' && question.options && (
                      <div className="space-y-2">
                        <p className="text-xs text-blue-600 font-medium mb-1">Chọn tất cả đáp án đúng</p>
                        {(() => {
                          let selectedArr: string[] = [];
                          try { selectedArr = JSON.parse(answers[question.id] || '[]'); } catch { selectedArr = []; }
                          return question.options.map((option, idx) => {
                            const isChecked = selectedArr.includes(option);
                            return (
                              <label
                                key={idx}
                                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  isChecked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const next = isChecked
                                      ? selectedArr.filter(a => a !== option)
                                      : [...selectedArr, option];
                                    setAnswers({ ...answers, [question.id]: JSON.stringify(next) });
                                  }}
                                  className="w-5 h-5 rounded mt-0.5"
                                />
                                {(() => {
                                  const normalizedOption = decodeEscapedHtml(String(option));
                                  if (hasHtmlMarkup(normalizedOption)) {
                                    return (
                                      <div
                                        className="prose prose-sm max-w-none flex-1 font-medium text-gray-900"
                                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(normalizedOption) }}
                                      />
                                    );
                                  }
                                  return <span className="flex-1 font-medium text-gray-900">{normalizedOption}</span>;
                                })()}
                              </label>
                            );
                          });
                        })()}
                      </div>
                    )}

                    {/* True/False */}
                    {question.question_type === 'true_false' && (
                      <div className="flex gap-3">
                        {['Đúng', 'Sai'].map((option) => (
                          <label
                            key={option}
                            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${answers[question.id] === option
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                              }`}
                          >
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value={option}
                              checked={answers[question.id] === option}
                              onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                              className="w-5 h-5"
                            />
                            <span className="font-semibold text-gray-900">{option}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Short Answer */}
                    {question.question_type === 'short_answer' && (
                      <input
                        type="text"
                        placeholder="Nhập câu trả lời..."
                        value={answers[question.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    )}

                    {/* Essay */}
                    {question.question_type === 'essay' && (
                      <textarea
                        placeholder="Nhập câu trả lời chi tiết..."
                        value={answers[question.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                        rows={6}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">{Object.keys(answers).length}</span> / {questions.length} câu đã trả lời
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Đóng
            </button>
            <button
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              onClick={() => {
                toast.error('Đây là chế độ xem trước. Không thể nộp bài.');
              }}
            >
              Nộp bài (Demo)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
