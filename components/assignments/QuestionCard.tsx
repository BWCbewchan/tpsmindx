'use client';

import { DIFFICULTY_LEVELS, QUESTION_TEMPLATES } from '@/lib/assignment-constants';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { Question } from '@/types/assignment';
import { Edit, GripVertical, Trash2 } from 'lucide-react';
import Image from 'next/image';

interface QuestionCardProps {
  question: Question;
  index: number;
  onEdit: (question: Question) => void;
  onDelete: (id: number) => void;
  isDraggable?: boolean;
}

export function QuestionCard({ question, index, onEdit, onDelete, isDraggable = false }: QuestionCardProps) {
  const template = QUESTION_TEMPLATES[question.question_type];
  const difficultyLevel = DIFFICULTY_LEVELS.find(d => d.value === question.difficulty);
  const IconComponent = template.icon;

  const decodeEscapedHtml = (value: string) => {
    if (!value || !value.includes('&lt;')) return value;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  };

  const hasHtmlMarkup = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

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
    <div className="group bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        {isDraggable && (
          <div className="cursor-move opacity-0 group-hover:opacity-100 transition-opacity pt-1">
            <GripVertical className="w-5 h-5 text-gray-400" />
          </div>
        )}

        {/* Question Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              {IconComponent && <IconComponent className="w-5 h-5 text-blue-600" />}
            </div>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
              Câu {index + 1}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${difficultyColors.bg} ${difficultyColors.text}`}>
              {difficultyLevel?.icon} {difficultyLevel?.label}
            </span>
            <span className="ml-auto text-sm font-bold text-gray-700">
              {question.points} điểm
            </span>
          </div>

          <div 
            className="text-gray-900 font-medium mb-2 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.question_text) }}
          />

          {question.image_url && (
            <div className="mb-2">
              { }
              <img
                src={question.image_url}
                alt="Question"
                width={200}
                height={150}
                className="rounded border border-gray-200"
              />
            </div>
          )}

          {/* Options Display */}
          {(question.question_type === 'multiple_choice' || question.question_type === 'multiple_select') && question.options && (
            <div className="space-y-1 mb-2">
              {question.question_type === 'multiple_select' && (
                <p className="text-xs text-blue-600 mb-1 font-medium">Chọn nhiều đáp án đúng</p>
              )}
              {question.options.map((option, idx) => {
                let isCorrect = false;
                if (question.question_type === 'multiple_select') {
                  try {
                    const arr = JSON.parse(question.correct_answer || '[]');
                    isCorrect = Array.isArray(arr) && arr.includes(option);
                  } catch { isCorrect = false; }
                } else {
                  isCorrect = option === question.correct_answer;
                }
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 p-2 rounded text-sm ${
                      isCorrect
                        ? 'bg-green-50 border border-green-300 font-semibold'
                        : 'bg-gray-50'
                    }`}
                  >
                    {(() => {
                      const normalizedOption = decodeEscapedHtml(String(option));
                      const renderAsHtml = hasHtmlMarkup(normalizedOption);
                      return (
                        <>
                          <span className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-gray-300 text-xs shrink-0">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          {renderAsHtml ? (
                            <div
                              className="prose prose-sm max-w-none flex-1 text-gray-900 [&_.tiptap-image]:inline-block [&_.tiptap-image]:max-w-full [&_img]:h-auto"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(normalizedOption) }}
                            />
                          ) : (
                            <span className="flex-1">{normalizedOption}</span>
                          )}
                        </>
                      );
                    })()}
                    {isCorrect && (
                      <span className="ml-auto text-green-600 text-xs shrink-0">✓ Đúng</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {question.question_type === 'true_false' && (
            <div className="flex gap-2 mb-2">
              <span className={`px-3 py-1 rounded text-sm ${
                question.correct_answer === 'Đúng'
                  ? 'bg-green-100 text-green-700 font-semibold'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                ✓ Đúng
              </span>
              <span className={`px-3 py-1 rounded text-sm ${
                question.correct_answer === 'Sai'
                  ? 'bg-red-100 text-red-700 font-semibold'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                ✗ Sai
              </span>
            </div>
          )}

          {(question.question_type === 'short_answer' || question.question_type === 'essay') && (
            <div className="p-2 bg-gray-50 rounded text-sm text-gray-700 mb-2">
              <span className="font-semibold">Đáp án mẫu: </span>
              {question.correct_answer}
            </div>
          )}

          {question.explanation && (
            <div className="p-2 bg-blue-50 border-l-4 border-blue-500 rounded text-sm text-gray-700">
              <span className="font-semibold">💡 Giải thích: </span>
              <span 
                className="prose prose-sm max-w-none inline"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.explanation) }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(question)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Sửa"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('Bạn có chắc muốn xóa câu hỏi này?')) {
                onDelete(question.id);
              }
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Xóa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
