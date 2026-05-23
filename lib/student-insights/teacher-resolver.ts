import pool from '@/lib/db';
import { findTeacherRowByEmailOrCode } from '@/lib/teacher-profile-bundle';
import { callLmsApi } from '@/lib/lms-api';

const GET_TEACHER_ID_QUERY = /* graphql */ `
  query GetTeacherByCode($code: String) {
    users(payload: {
      filter_textSearch: $code,
      pageIndex: 0,
      itemsPerPage: 10
    }) {
      data {
        id
        username
        code
        email
        fullName
      }
    }
  }
`;

export interface TeacherLmsInfo {
  lmsTeacherId: string;
  teacherCode: string;
  teacherEmail: string;
}

/**
 * Resolve LMS Teacher ID từ session email.
 * Trả về MongoDB ObjectId của teacher trong LMS để dùng cho filter `teacherSlot`.
 */
export async function resolveTeacherLmsId(
  sessionEmail: string,
  authHeader?: string
): Promise<TeacherLmsInfo | null> {
  // 1. Tra DB lấy teacher code từ email
  const teacherRow = await findTeacherRowByEmailOrCode(pool, { email: sessionEmail });
  if (!teacherRow) {
    return null;
  }

  const teacherCode = String(teacherRow.code ?? '').trim();
  const teacherEmail = String(
    teacherRow.work_email ?? teacherRow['Work email'] ?? sessionEmail
  ).trim();

  if (!teacherCode) {
    return null;
  }

  // 2. Lấy LMS teacher ID (MongoDB ObjectId) từ teacher code/email
  let lmsTeacherId: string = teacherCode; // fallback nếu lookup thất bại

  try {
    const lookupTerms = [teacherEmail, teacherCode].filter(Boolean);
    for (const term of lookupTerms) {
      const lookupResult = await callLmsApi<{
        data: {
          users: {
            data: Array<{
              id: string;
              email?: string;
              code?: string;
            }>;
          };
        };
      }>(
        {
          query: GET_TEACHER_ID_QUERY,
          operationName: 'GetTeacherByCode',
          variables: { code: term },
        },
        authHeader
      );

      const users = lookupResult.data?.users?.data || [];
      const matched = users.find(
        (u) =>
          u.email?.toLowerCase() === teacherEmail.toLowerCase() ||
          u.code === teacherCode
      );

      if (matched?.id) {
        lmsTeacherId = matched.id;
        break;
      }
    }
  } catch (lookupErr: any) {
    console.warn(
      '[teacher-resolver] Teacher ID lookup failed, using code as fallback:',
      lookupErr?.message
    );
  }

  return {
    lmsTeacherId,
    teacherCode,
    teacherEmail,
  };
}
