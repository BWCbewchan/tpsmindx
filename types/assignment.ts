// Shared types for Assignments and Questions

export interface Assignment {
  id: number;
  video_id: number;
  video_title?: string;
  assignment_title: string;
  assignment_type: 'quiz' | 'exam' | 'practice';
  description: string;
  total_points: number;
  passing_score: number;
  time_limit_minutes: number;
  max_attempts: number;
  is_required: boolean;
  due_date: string | null;
  status: 'draft' | 'published' | 'archived';
  question_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Question {
  id: number;
  assignment_id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'essay';
  correct_answer: string;
  options: string[] | null;
  image_url: string | null;
  explanation: string;
  points: number;
  order_number: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuestionFormData {
  question_text: string;
  question_type: Question['question_type'];
  correct_answer: string;
  options: string[];
  image_url: string;
  explanation: string;
  points: number;
  difficulty: Question['difficulty'];
}

export interface AssignmentFormData {
  video_id: string;
  assignment_title: string;
  assignment_type: Assignment['assignment_type'];
  description: string;
  total_points: string;
  passing_score: string;
  time_limit_minutes: string;
  max_attempts: string;
  is_required: boolean;
  due_date: string;
  status: Assignment['status'];
}

export interface Submission {
  id: number;
  teacher_code: string;
  assignment_id: number;
  attempt_number: number;
  score: number;
  total_points: number;
  percentage: number;
  is_passed: boolean;
  status: 'in_progress' | 'submitted' | 'graded';
  started_at: string;
  submitted_at: string | null;
  time_spent_seconds: number;
}
