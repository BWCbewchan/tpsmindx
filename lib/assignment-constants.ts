import { CheckCheck, CheckSquare, FileText, ListChecks, PenLine } from 'lucide-react';

export const QUESTION_TEMPLATES = {
  multiple_choice: {
    name: 'Trắc nghiệm',
    icon: CheckSquare,
    description: 'Nhiều lựa chọn, chỉ 1 đáp án đúng',
    defaultOptions: ['', '', '', ''],
    placeholder: 'Nhập câu hỏi trắc nghiệm...'
  },
  multiple_select: {
    name: 'Chọn nhiều',
    icon: ListChecks,
    description: 'Nhiều lựa chọn, có thể chọn nhiều đáp án đúng',
    defaultOptions: ['', '', '', ''],
    placeholder: 'Nhập câu hỏi chọn nhiều đáp án...'
  },
  true_false: {
    name: 'Đúng/Sai',
    icon: CheckCheck,
    description: 'Câu hỏi đúng hoặc sai',
    defaultOptions: ['Đúng', 'Sai'],
    placeholder: 'Nhập câu hỏi đúng/sai...'
  },
  short_answer: {
    name: 'Trả lời ngắn',
    icon: PenLine,
    description: 'Câu hỏi yêu cầu trả lời ngắn (văn bản)',
    defaultOptions: null,
    placeholder: 'Nhập câu hỏi...'
  },
  essay: {
    name: 'Tự luận',
    icon: FileText,
    description: 'Câu hỏi yêu cầu trả lời chi tiết',
    defaultOptions: null,
    placeholder: 'Nhập câu hỏi tự luận...'
  }
};

// Difficulty levels aligned with DB schema
export const DIFFICULTY_LEVELS = [
  { 
    value: 'easy', 
    label: 'Dễ', 
    color: 'green', 
    icon: '🟢',
    description: 'Câu hỏi cơ bản, độ khó thấp'
  },
  { 
    value: 'medium', 
    label: 'Trung bình', 
    color: 'blue', 
    icon: '🟡',
    description: 'Câu hỏi ở mức độ vừa phải'
  },
  {
    value: 'hard',
    label: 'Khó',
    color: 'red',
    icon: '🔴',
    description: 'Câu hỏi nâng cao, độ khó cao'
  }
];

export const ASSIGNMENT_TYPES = [
  { value: 'quiz', label: 'Kiểm tra nhanh', icon: '⚡', description: 'Bài kiểm tra ngắn, nhanh' },
  { value: 'exam', label: 'Bài kiểm tra', icon: '📄', description: 'Bài kiểm tra chính thức' },
  { value: 'practice', label: 'Luyện tập', icon: '💪', description: 'Bài tập thực hành' }
];

export const POINTS_PRESETS = [1, 2, 5, 10];

export const TIME_PRESETS = [15, 30, 45, 60, 90, 120];
