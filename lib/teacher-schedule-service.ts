import { callLmsApi } from './lms-api';

export interface TeacherScheduleSlot {
  id: string;
  classCode: string;
  className: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  date: string;      // YYYY-MM-DD
  room: string;
  subject: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
}

export interface TeacherSchedule {
  teacherCode: string;
  slots: TeacherScheduleSlot[];
}

/**
 * Service to fetch teacher class schedules from LMS API.
 */
export async function fetchTeacherSchedules(teacherCode: string, email: string, authHeader?: string): Promise<TeacherSchedule> {
  // Tính toán khoảng thời gian cho tháng hiện tại (để filter lớp học)
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  const haveSlotFrom = firstDay.toISOString();
  const haveSlotTo = lastDay.toISOString();

  const query = `
    query GetAllClasses($from: Date, $to: Date) {
      classes(payload: {
        haveSlot_from: $from,
        haveSlot_to: $to,
        pageIndex: 0,
        itemsPerPage: 100
      }) {
        data {
          id
          name
          slots {
            _id
            startTime
            endTime
            teachers {
              teacher { code email }
            }
          }
        }
      }
    }
  `;

  try {
    console.log(`[DEBUG] Fetching ALL classes from ${haveSlotFrom} to ${haveSlotTo} to filter for teacher: ${teacherCode}`);
    
    // Gọi API lấy TẤT CẢ các lớp trong khoảng thời gian, SỬ DỤNG authHeader của user hiện tại
    const result = await callLmsApi<{ data: { classes: { data: any[] } } }>({
      query,
      variables: { 
        from: haveSlotFrom, 
        to: haveSlotTo 
      },
    }, authHeader);

    const classes = result.data?.classes?.data || [];
    console.log(`[DEBUG] Found ${classes.length} total classes in this period.`);

    console.log(`[DEBUG] Found ${classes.length} classes for teacher.`);

    // Trích xuất tất cả các slots từ tất cả các lớp
    const allSlots: any[] = [];
    classes.forEach(cls => {
      if (cls.slots) {
        allSlots.push(...cls.slots);
      }
    });

    // Lọc lại một lần nữa để đảm bảo slot này thực sự có giáo viên này (vì teacher_equals có thể trả về lớp mà GV từng dạy)
    const filteredSlots = allSlots.filter((slot: any) => 
      slot.teachers?.some((t: any) => t.teacher?.code === teacherCode || t.teacher?.email === email)
    );

    const finalSlots: TeacherScheduleSlot[] = filteredSlots.map((s: any) => {
      const parentClass = classes.find(c => c.slots?.some((slot: any) => slot._id === s._id));
      return {
        id: s._id,
        classCode: 'N/A',
        className: parentClass?.name || 'Unknown Class',
        startTime: s.startTime,
        endTime: s.endTime,
        date: s.startTime ? s.startTime.split('T')[0] : '',
        room: 'N/A',
        subject: 'N/A',
        status: 'scheduled' as const,
      };
    });

    return {
      teacherCode,
      slots: finalSlots,
    };
  } catch (error: any) {
    console.error(`[CRITICAL ERROR] in fetchTeacherSchedules for ${teacherCode}:`, error);
    return {
      teacherCode,
      slots: [],
    };
  }
}
