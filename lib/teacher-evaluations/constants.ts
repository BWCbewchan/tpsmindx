export const TEACHER_EVALUATION_ROUTE = '/admin/phieu-danh-gia-giao-vien'

export const STUDENT_TEACHING_SURVEY_ID = '676a84b4fe6e69ed05003d81'

export const TEACHER_POINT_SESSION_INDICES = [3, 7] as const

export const TEACHER_POINT_EXEMPTED_REASONS = new Set([
  'CHANGE_CLASS_SCHEDULE_CHANGE',
  'TRANSFER_COURSE_LINE',
  'WRONG_ENROLL',
  'ON_HOLD',
  'DROP_OUT',
])

export const CLASS_INACTIVE_STATUSES = new Set([
  'ABANDONED',
  'REJECTED',
  'CANCELLED',
  'SUSPENDED',
  'PREPARING',
])

export const SHEET_HEADERS = {
  timestamp: 'Timestamp',
  studentName: 'Tên của em là?',
  classCode: 'Mã lớp của em là?',
  centreCode: 'Mã cơ sở của em là?',
  teacherUnderstandability: 'Giáo viên lớp em giảng bài dễ hiểu chứ?',
  teacherAffinity: 'Em yêu thích Giáo viên lớp mình chứ?',
} as const

export const SURVEY_DETAIL_QUESTIONS = [
  'Em có hiểu bài học trước không?',
  'Em có thực hành được bài học trước không?',
  'Hình ảnh/video trong bài học có dễ hiểu không?',
  'Giáo viên có trực tiếp hướng dẫn em không?',
  'Các hoạt động trong lớp có thú vị không?',
  SHEET_HEADERS.teacherUnderstandability,
  SHEET_HEADERS.teacherAffinity,
  'Em mong muốn lớp học cải thiện điều gì?',
] as const

export const LMS_TICKET_STATUSES = [
  'NEW',
  'ASSIGNED',
  'IN_PROCESS',
  'IN_PROGRESS',
  'COMPLAIN',
  'RESOLVED',
  'CLOSED',
] as const

export const LMS_TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

export const LMS_FEEDBACK_TOPICS = [
  'TEACHER',
  'DOCUMENT',
  'EQUIPMENT',
  'OPERATION',
  'OTHER',
] as const

export const RESOLVED_TICKET_STATUSES = new Set(['RESOLVED', 'CLOSED'])

export const VIETNAM_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000
