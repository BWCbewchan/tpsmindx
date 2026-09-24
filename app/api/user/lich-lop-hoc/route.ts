import { TPS_SESSION_COOKIE, verifySessionCookieValue } from '@/lib/session-cookie';
import { NextRequest, NextResponse } from 'next/server';
import { callLmsApi } from '@/lib/lms-api';

const GET_ALL_CLASSES_QUERY = /* graphql */ `
  query GetAllClasses($haveSlotFrom: Date, $haveSlotTo: Date, $pageIndex: Int, $itemsPerPage: Int) {
    classes(payload: {
      haveSlot_from: $haveSlotFrom,
      haveSlot_to: $haveSlotTo,
      status_in: ["RUNNING", "PREPARING"],
      pageIndex: $pageIndex,
      itemsPerPage: $itemsPerPage,
      orderBy: "startDate_asc"
    }) {
      pagination { total }
      data {
        id
        name
        status
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        teachers {
          isActive
          teacher { id fullName username code email }
          role { id name shortName }
        }
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

function normalizeEmail(value: unknown): string {
  return String(value ?? '').toLowerCase().trim();
}

function isLecAssignment(assignment: any, userEmail: string): boolean {
  if (assignment?.isActive === false) return false;

  const teacherEmail = normalizeEmail(assignment?.teacher?.email);
  if (!teacherEmail || teacherEmail !== userEmail) return false;

  const roleValues = [
    assignment?.role?.shortName,
    assignment?.role?.name,
    assignment?.role?.code,
  ].map((value) => String(value ?? '').trim().toUpperCase());

  return roleValues.includes('LEC');
}

function hasMatchingTeacherAttendance(slot: any, userEmail: string): boolean {
  return (slot.teacherAttendance || []).some((attendance: any) => {
    return normalizeEmail(attendance?.teacher?.email) === userEmail;
  });
}

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(TPS_SESSION_COOKIE)?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const session = await verifySessionCookieValue(sessionCookie);
  if (!session?.email) {
    return NextResponse.json({ error: 'Phiên đăng nhập không hợp lệ' }, { status: 401 });
  }

  const userEmail = normalizeEmail(session.email);

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

    if (!fromParam || !toParam) {
      return NextResponse.json({
        success: false,
        slots: [],
        message: 'Thiếu khoảng ngày cần tải lịch lớp học.'
      }, { status: 400 });
    }

    const haveSlotFrom = new Date(`${fromParam}T00:00:00.000+07:00`).toISOString();
    const haveSlotTo = new Date(`${toParam}T23:59:59.999+07:00`).toISOString();

    const authHeader = `Bearer ${firebaseToken}`;
    const itemsPerPage = 200;
    const firstResult = await callLmsApi<any>({
      query: GET_ALL_CLASSES_QUERY,
      variables: { haveSlotFrom, haveSlotTo, pageIndex: 0, itemsPerPage },
    }, authHeader);

    if (firstResult.errors?.length) {
      console.error('[lich-lop-hoc] GraphQL errors:', firstResult.errors);
      return NextResponse.json({
        success: false,
        slots: [],
        message: 'Lỗi khi lấy dữ liệu từ LMS.'
      });
    }

    const firstPage = firstResult.data?.classes;
    const allClasses = Array.isArray(firstPage?.data) ? [...firstPage.data] : [];
    const total = Number(firstPage?.pagination?.total || allClasses.length);
    const totalPages = Math.ceil(total / itemsPerPage);
    const maxPages = 20;

    for (let pageIndex = 1; pageIndex < totalPages && pageIndex < maxPages; pageIndex++) {
      const pageResult = await callLmsApi<any>({
        query: GET_ALL_CLASSES_QUERY,
        variables: { haveSlotFrom, haveSlotTo, pageIndex, itemsPerPage },
      }, authHeader);

      if (pageResult.errors?.length) {
        console.error(`[lich-lop-hoc] GraphQL errors on page ${pageIndex}:`, pageResult.errors);
        return NextResponse.json({
          success: false,
          slots: [],
          message: 'Lỗi khi lấy dữ liệu từ LMS.'
        });
      }

      const pageData = pageResult.data?.classes?.data;
      if (!Array.isArray(pageData) || pageData.length === 0) break;
      allClasses.push(...pageData);
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

    const slots = allClasses
      .filter((cls: any) => {
        // Ưu tiên phân công LEC từ LMS; fallback teacherAttendance cho lớp mới
        // khi slot.teachers/class.teachers chưa được đồng bộ nhưng GV đã dạy.
        const hasLecRole =
          (cls.teachers || []).some((t: any) => isLecAssignment(t, userEmail)) ||
          (cls.slots || []).some((slot: any) =>
            (slot.teachers || []).some((t: any) => isLecAssignment(t, userEmail)),
          );

        const hasAttendedSlot = (cls.slots || []).some((slot: any) =>
          hasMatchingTeacherAttendance(slot, userEmail),
        );

        if (!hasLecRole && !hasAttendedSlot) {
          // skip non-LEC classes
        }

        return hasLecRole || hasAttendedSlot;
      })
      .flatMap((cls: any) => {
        const classSlots = (cls.slots || [])
          .slice()
          .sort((a: any, b: any) => new Date(a.date || a.startTime).getTime() - new Date(b.date || b.startTime).getTime())
          .map((slot: any) => mapSlot(cls, slot));

        return classSlots.map((slot: any) => ({
          ...slot,
          classSlots,
        }));
      });

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
