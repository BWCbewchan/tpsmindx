export interface StudentInsightSessionComment {
  classId: string;
  className: string;
  centreId: string;
  centreName: string;
  courseId: string;
  courseName: string;
  slotId: string;
  slotDate: string;
  sessionIndex: number;
  attendanceStatus: string;
  sendCommentStatus: string;
  commentText: string;
  commentByAreas?: Array<{
    content: string;
    grade?: number | null;
    commentAreaId?: string;
    type?: string;
    courseProcessFinalEvaluationTitle?: string | null;
  }>;
  teacherNames: string[];
}

export interface StudentInsightAttendanceItem {
  classId: string;
  className: string;
  slotId: string;
  slotDate: string;
  sessionIndex: number;
  status: string;
}

export interface StudentInsightLearningItem {
  classId: string;
  className: string;
  slotId: string;
  slotDate: string;
  sessionIndex: number;
  summary?: string;
  homework?: string;
}

export interface Class {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  course: { id: string; name: string; shortName: string; courseLine?: { id: string; name: string } };
  centre: { id: string; name: string; shortName: string };
  teachers: Array<{
    _id: string;
    isActive: boolean;
    teacher: { id: string; fullName: string };
    role: { shortName: string };
  }>;
  students: Array<{
    _id: string;
    activeInClass: boolean;
    student: { id: string; fullName: string };
  }>;
  slots: Array<{
    _id: string;
    date: string;
    startTime: string;
    endTime: string;
    sessionHour: number;
    summary: string;
    homework: string;
    teachers: Array<{
      isActive: boolean;
      teacher: { id: string; fullName: string };
      role: { shortName: string };
    }>;
    teacherAttendance: Array<{
      _id: string;
      status: string;
      note: string;
      createdAt: string;
      lastModifiedAt: string;
      teacher: { id: string; fullName: string; email: string };
    }>;
    studentAttendance: Array<{
      _id: string;
      status: string;
      comment: string;
      commentByAreas?: Array<{
        content: string;
        grade?: number | null;
        commentAreaId?: string;
        type?: string;
        courseProcessFinalEvaluationTitle?: string | null;
      }>;
      sendCommentStatus: string;
      student: { id: string; fullName: string; phoneNumber: string; email: string; gender: string; imageUrl: string };
    }>;
  }>;
}
