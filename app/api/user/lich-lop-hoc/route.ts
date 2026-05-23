import { TPS_SESSION_COOKIE, verifySessionCookieValue } from '@/lib/session-cookie';
import { NextRequest, NextResponse } from 'next/server';
import { callLmsApi } from '@/lib/lms-api';

const GET_ALL_CLASSES_QUERY = /* graphql */ `
  query GetAllClasses($haveSlotFrom: Date, $haveSlotTo: Date) {
    classes(payload: {
      haveSlot_from: $haveSlotFrom,
      haveSlot_to: $haveSlotTo,
      status_in: ["RUNNING", "PREPARING"],
      pageIndex: 0,
      itemsPerPage: 500,
      orderBy: "startDate_asc"
    }) {
      data {
        id
        name
        status
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        slots {
          _id
          date
          startTime
          endTime
          sessionHour
          summary
          homework
          teachers {
            _id
            isActive
            teacher { id fullName username code email }
            role { id name shortName }
          }
          teacherAttendance {
            _id
            status
            note
            teacher { id fullName email }
          }
          studentAttendance {
            _id
            status
            comment
            sendCommentStatus
            commentByAreas {
              content
              grade
              commentAreaId
              type
              courseProcessFinalEvaluationTitle
            }
            student { id fullName phoneNumber email gender imageUrl }
          }
        }
        students {
          _id
          student { id fullName }
          activeInClass
        }
      }
    }
  }
`;

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(TPS_SESSION_COOKIE)?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const session = await verifySessionCookieValue(sessionCookie);
  if (!session?.email) {
    return NextResponse.json({ error: 'Phiên đăng nhập không hợp lệ' }, { status: 401 });
  }

  const firebaseToken = request.cookies.get('lms_firebase_token')?.value || '';
  
  if (!firebaseToken) {
    return NextResponse.json({ 
      success: false,
      noLmsToken: true, 
      slots: [],
      message: 'Tài khoản này không có kết nối LMS.' 
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    
    const LMS_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
    const haveSlotFrom = new Date(new Date(fromParam!).getTime() - LMS_TZ_OFFSET_MS).toISOString();
    const haveSlotTo = new Date(new Date(toParam!).getTime() - LMS_TZ_OFFSET_MS).toISOString();

    const authHeader = `Bearer ${firebaseToken}`;
    const classesResult = await callLmsApi<any>({
      query: GET_ALL_CLASSES_QUERY,
      variables: { haveSlotFrom, haveSlotTo },
    }, authHeader);
    
    if (classesResult.errors?.length) {
      console.error('[lich-lop-hoc] GraphQL errors:', classesResult.errors);
      return NextResponse.json({ 
        success: false, 
        slots: [], 
        message: 'Lỗi khi lấy dữ liệu từ LMS.' 
      });
    }

    const mapSlot = (cls: any, slot: any) => ({
        id: slot._id,
        classId: cls.id,
        className: cls.name,
        courseName: cls.course?.name || '',
        courseLineName: cls.course?.courseLine?.name || '',
        centreName: cls.centre?.shortName || cls.centre?.name || '',
        status: cls.status,
        students: (cls.students || [])
          .filter((s:any) => s.activeInClass)
          .map((s:any) => ({ 
            id: s.student.id, 
            fullName: s.student.fullName 
          })),
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        sessionHour: slot.sessionHour ?? null,
        summary: slot.summary || '',
        homework: slot.homework || '',
        teacherNames: Array.from(new Set([
          ...(slot.teacherAttendance || []).map((ta: any) => ta.teacher?.fullName).filter(Boolean),
          ...(slot.teachers || []).map((t: any) => t.teacher?.fullName).filter(Boolean),
        ])),
        studentAttendance: slot.studentAttendance || [],
      });

    const slots = classesResult.data.classes.data.flatMap((cls: any) => {
      const classSlots = (cls.slots || [])
        .slice()
        .sort((a: any, b: any) => new Date(a.date || a.startTime).getTime() - new Date(b.date || b.startTime).getTime())
        .map((slot: any) => mapSlot(cls, slot));

      return classSlots.map((slot: any) => ({
        ...slot,
        classSlots,
      }));
    }
    );

    return NextResponse.json({ success: true, slots });

  } catch (error: any) {
    console.error('[lich-lop-hoc] Error:', error?.message || error);
    return NextResponse.json({ 
      success: false, 
      slots: [],
      message: 'Không thể kết nối đến LMS API.' 
    }, { status: 500 });
  }
}
