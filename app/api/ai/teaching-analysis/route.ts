import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { callLmsApi } from '@/lib/lms-api';
import OpenAI from 'openai';
import { checkRateLimit } from '@/lib/ai-rate-limiter';
import { getCachedAnalysis, setCachedAnalysis, generateTeachingAnalysisCacheKey } from '@/lib/ai-cache';
import { logAIUsage, calculateCost } from '@/lib/ai-usage-tracker';

// Initialize OpenAI client (only if API key is available)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// GraphQL query để lấy thông tin lớp học và các buổi học
// Chỉ lấy classes đang RUNNING để giảm tải và tránh timeout
const GET_CLASS_SESSIONS_QUERY = /* graphql */ `
  query GetClassSessions {
    classes(payload: {
      status_in: ["RUNNING"],
      pageIndex: 0,
      itemsPerPage: 200,
      orderBy: "startDate_desc"
    }) {
      data {
        id
        name
        course { 
          name 
          shortName 
        }
        slots {
          _id
          date
          sessionHour
          summary
          homework
          studentAttendance {
            status
            comment
            commentByAreas {
              content
              grade
              type
            }
            student { 
              fullName 
            }
          }
        }
      }
    }
  }
`;

type LmsCommentArea = {
  content?: string;
  grade?: string;
  type?: string;
};

type LmsAttendance = {
  status?: string;
  comment?: string;
  commentByAreas?: LmsCommentArea[];
  student?: {
    fullName?: string;
  };
};

type LmsSlot = {
  _id?: string;
  date: string;
  sessionHour?: string;
  summary?: string;
  homework?: string;
  studentAttendance?: LmsAttendance[];
};

type LmsClass = {
  id: string;
  name?: string;
  course?: {
    name?: string;
    shortName?: string;
  };
  slots?: LmsSlot[];
};

type LmsClassSessionsResponse = {
  errors?: unknown[];
  data?: {
    classes?: {
      data?: LmsClass[];
    };
  };
};

type AttendanceStats = {
  session: number;
  present: number;
  absent: number;
  late: number;
  total: number;
};

function isOpenAIQuotaError(error: unknown) {
  const err = error as {
    status?: number;
    code?: string;
    type?: string;
    message?: string;
  };
  const message = err.message?.toLowerCase() || '';
  return (
    err.status === 429 &&
    (err.code === 'insufficient_quota' ||
      err.type === 'insufficient_quota' ||
      message.includes('exceeded your current quota') ||
      message.includes('billing details'))
  );
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[teaching-analysis] API called');
  
  const auth = await requireBearerOrSessionCookie(request);
  if (!auth.ok) {
    console.log('[teaching-analysis] Auth failed');
    return auth.response;
  }

  const userEmail = auth.sessionEmail || 'unknown';

  try {
    const body = await request.json();
    console.log('[teaching-analysis] Request body:', body);
    
    const { classId, className, courseName, sessionNumber } = body;

    if (!classId || !sessionNumber) {
      console.log('[teaching-analysis] Missing required params');
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin lớp học hoặc buổi học' },
        { status: 400 }
      );
    }

    // ============================================
    // STEP 1: Check Rate Limit
    // ============================================
    const rateLimit = await checkRateLimit(userEmail, 'teaching-analysis', 10);
    
    if (!rateLimit.allowed) {
      console.log(`[teaching-analysis] Rate limit exceeded for ${userEmail}`);
      
      // Log failed attempt
      await logAIUsage({
        userEmail,
        feature: 'teaching-analysis',
        classId,
        sessionNumber,
        model: 'rate-limited',
        success: false,
        errorMessage: 'Rate limit exceeded',
      });
      
      return NextResponse.json({
        success: false,
        error: rateLimit.message,
        rateLimit: {
          remaining: rateLimit.remaining,
          limit: rateLimit.limit,
          resetAt: rateLimit.resetAt,
        },
      }, { status: 429 });
    }

    console.log(`[teaching-analysis] Rate limit OK: ${rateLimit.remaining}/${rateLimit.limit} remaining`);

    // ============================================
    // STEP 2: Check Cache
    // ============================================
    const cacheKey = generateTeachingAnalysisCacheKey(classId, sessionNumber);
    const cachedAnalysis = await getCachedAnalysis(cacheKey);
    
    if (cachedAnalysis) {
      console.log(`[teaching-analysis] Using cached analysis`);
      
      // Log cache hit (no cost)
      await logAIUsage({
        userEmail,
        feature: 'teaching-analysis',
        classId,
        sessionNumber,
        model: 'cached',
        estimatedCost: 0,
        responseTimeMs: Date.now() - startTime,
        success: true,
      });
      
      return NextResponse.json({
        success: true,
        analysis: cachedAnalysis,
        metadata: {
          classId,
          className,
          courseName,
          sessionNumber,
          cached: true,
          usedAI: false,
          aiProvider: 'Cached',
          rateLimit: {
            remaining: rateLimit.remaining,
            limit: rateLimit.limit,
          },
        },
      });
    }

    // ============================================
    // STEP 3: Fetch LMS Data
    // ============================================
    
    // Lấy Firebase token từ cookie
    const firebaseToken = request.cookies.get('lms_firebase_token')?.value || '';
    if (!firebaseToken) {
      console.log('[teaching-analysis] No Firebase token');
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập LMS' },
        { status: 401 }
      );
    }

    // ============================================
    // STEP 3.1: Check OpenAI API Key (REQUIRED)
    // ============================================
    if (!openai || !process.env.OPENAI_API_KEY) {
      console.error('[teaching-analysis] OpenAI API key not configured');
      
      // Log failed attempt
      await logAIUsage({
        userEmail,
        feature: 'teaching-analysis',
        classId,
        sessionNumber,
        model: 'no-api-key',
        success: false,
        errorMessage: 'OpenAI API key not configured',
      });
      
      return NextResponse.json({
        success: false,
        error: 'Chức năng phân tích AI chưa được cấu hình. Vui lòng liên hệ admin để thêm OpenAI API key vào file .env.local',
      }, { status: 500 });
    }

    console.log('[teaching-analysis] Calling LMS API for class:', classId);

    // Gọi LMS API để lấy thông tin lớp học
    const authHeader = `Bearer ${firebaseToken}`;
    const classData = await callLmsApi<LmsClassSessionsResponse>({
      query: GET_CLASS_SESSIONS_QUERY,
      variables: {},
    }, authHeader);

    console.log('[teaching-analysis] LMS API response:', {
      hasErrors: !!classData.errors,
      hasData: !!classData.data,
      classesCount: classData.data?.classes?.data?.length || 0,
    });

    if (classData.errors?.length) {
      console.error('[teaching-analysis] LMS API errors:', classData.errors);
      return NextResponse.json(
        { success: false, error: `LMS API error: ${JSON.stringify(classData.errors[0])}` },
        { status: 500 }
      );
    }

    if (!classData.data?.classes?.data) {
      console.log('[teaching-analysis] No classes data');
      return NextResponse.json(
        { success: false, error: 'Không thể lấy dữ liệu lớp học từ LMS' },
        { status: 500 }
      );
    }

    // Tìm lớp học theo ID
    const allClasses = classData.data.classes.data;
    const classInfo = allClasses.find((cls) => cls.id === classId);

    if (!classInfo) {
      console.log('[teaching-analysis] Class not found in', allClasses.length, 'RUNNING classes');
      console.log('[teaching-analysis] Looking for classId:', classId);
      console.log('[teaching-analysis] Sample class IDs:', allClasses.slice(0, 5).map((c) => ({ id: c.id, name: c.name })));
      return NextResponse.json(
        { success: false, error: `Không tìm thấy lớp học đang RUNNING với ID: ${classId}. Lớp này có thể đã kết thúc hoặc chưa bắt đầu.` },
        { status: 404 }
      );
    }

    const slots = classInfo.slots || [];
    console.log('[teaching-analysis] Found class with', slots.length, 'slots');

    // Sắp xếp slots theo thứ tự thời gian
    const sortedSlots = slots.slice().sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Lấy các buổi trước (từ buổi 1 đến buổi sessionNumber - 1)
    const previousSessions = sortedSlots.slice(0, sessionNumber - 1);
    const currentSession = sortedSlots[sessionNumber - 1];

    if (!currentSession) {
      return NextResponse.json(
        { success: false, error: `Không tìm thấy buổi ${sessionNumber}` },
        { status: 404 }
      );
    }

    // Tổng hợp nhận xét từ các buổi trước
    const previousComments = previousSessions.flatMap((session) => {
      const attendance = session.studentAttendance || [];
      return attendance.flatMap((att) => {
        const comments: string[] = [];
        if (att.comment) comments.push(att.comment);
        if (att.commentByAreas) {
          att.commentByAreas.forEach((area) => {
            if (area.content) comments.push(area.content);
          });
        }
        return comments;
      });
    }).filter(Boolean);

    // Tổng hợp summary và homework từ các buổi trước
    const previousSummaries = previousSessions
      .map((s) => s.summary)
      .filter((summary): summary is string => Boolean(summary));
    
    const previousHomework = previousSessions
      .map((s) => s.homework)
      .filter((homework): homework is string => Boolean(homework));

    // Tính toán chuyên cần
    const attendanceStats: AttendanceStats[] = previousSessions.map((session, idx) => {
      const attendance = session.studentAttendance || [];
      const present = attendance.filter((a) => a.status === 'PRESENT').length;
      const absent = attendance.filter((a) => a.status === 'ABSENT').length;
      const late = attendance.filter((a) => a.status === 'LATE').length;
      return {
        session: idx + 1,
        present,
        absent,
        late,
        total: attendance.length,
      };
    });

    // Tạo prompt cho AI với phân tích dữ liệu chi tiết
    const totalStudents = currentSession.studentAttendance?.length || 0;
    const avgAttendanceRate = attendanceStats.length > 0
      ? Math.round(attendanceStats.reduce((sum, s) => sum + (s.total > 0 ? s.present / s.total * 100 : 0), 0) / attendanceStats.length)
      : 0;
    
    // Phân tích xu hướng attendance
    const attendanceTrend = attendanceStats.length >= 2
      ? attendanceStats[attendanceStats.length - 1].present / attendanceStats[attendanceStats.length - 1].total -
        attendanceStats[0].present / attendanceStats[0].total
      : 0;
    
    const aiPrompt = `
═══════════════════════════════════════════════════════════════
PHÂN TÍCH CHUYÊN SÂU CHO BUỔI HỌC
═══════════════════════════════════════════════════════════════

📋 THÔNG TIN LỚP HỌC
─────────────────────────────────────────────────────────────
• Tên lớp: ${className}
• Khóa học: ${courseName}
• Buổi học hiện tại: Buổi ${sessionNumber}
• Tổng số học viên: ${totalStudents}

═══════════════════════════════════════════════════════════════

📚 NỘI DUNG GIÁO TRÌNH BUỔI HIỆN TẠI
─────────────────────────────────────────────────────────────
${currentSession.summary || 'Chưa có thông tin'}

📝 BÀI TẬP VỀ NHÀ:
${currentSession.homework || 'Chưa có thông tin'}

═══════════════════════════════════════════════════════════════

📊 PHÂN TÍCH DỮ LIỆU CÁC BUỔI TRƯỚC (Buổi 1-${sessionNumber - 1})
─────────────────────────────────────────────────────────────

1. TÓM TẮT NỘI DUNG ĐÃ HỌC:
${previousSummaries.length > 0 ? previousSummaries.map((s, i) => `
   Buổi ${i + 1}:
   ${s.substring(0, 200)}${s.length > 200 ? '...' : ''}
`).join('\n') : 'Chưa có dữ liệu các buổi trước'}

2. THỐNG KÊ CHUYÊN CẦN:
${attendanceStats.length > 0 ? attendanceStats.map(s => `
   Buổi ${s.session}: 
   - Có mặt: ${s.present}/${s.total} (${Math.round(s.present/s.total*100)}%)
   - Vắng: ${s.absent} (${Math.round(s.absent/s.total*100)}%)
   - Muộn: ${s.late} (${Math.round(s.late/s.total*100)}%)
   - Xu hướng: ${s.present > s.total * 0.8 ? '✅ Tốt' : s.present > s.total * 0.6 ? '⚠️ Trung bình' : '❌ Cần cải thiện'}
`).join('\n') : 'Chưa có dữ liệu chuyên cần'}

   📈 Xu hướng chuyên cần: ${attendanceTrend > 0 ? `Tăng ${Math.round(attendanceTrend * 100)}%` : attendanceTrend < 0 ? `Giảm ${Math.round(Math.abs(attendanceTrend) * 100)}%` : 'Ổn định'}
   📊 Tỷ lệ chuyên cần trung bình: ${avgAttendanceRate}%

3. PHÂN TÍCH NHẬN XÉT TỪ GIÁO VIÊN:
${previousComments.length > 0 ? `
   - Tổng số nhận xét: ${previousComments.length}
   
   📝 NHẬN XÉT CHI TIẾT (để AI phân tích học viên nào chưa hiểu bài):
${previousComments.slice(0, 10).map((c, i) => `     ${i + 1}. "${c}"`).join('\n')}

   ⚠️ LƯU Ý: Hãy phân tích các nhận xét trên để xác định:
   - Học viên nào được khen (hiểu bài tốt)
   - Học viên nào chưa hiểu bài (cần hỗ trợ thêm)
   - Vấn đề chung của lớp (nếu có)
` : 'Chưa có nhận xét từ các buổi trước'}

4. PHÂN TÍCH HỌC VIÊN VẮNG:
${attendanceStats.length > 0 ? `
${attendanceStats.map((s, idx) => {
  const session = previousSessions[idx];
  const absentStudents = session?.studentAttendance?.filter((a) => a.status === 'ABSENT').map((a) => a.student?.fullName || 'Unknown') || [];
  const lateStudents = session?.studentAttendance?.filter((a) => a.status === 'LATE').map((a) => a.student?.fullName || 'Unknown') || [];
  return `
   Buổi ${s.session}:
   - Vắng: ${absentStudents.length > 0 ? absentStudents.join(', ') : 'Không có'}
   - Muộn: ${lateStudents.length > 0 ? lateStudents.join(', ') : 'Không có'}`;
}).join('\n')}

   ⚠️ LƯU Ý: Học viên vắng nhiều buổi sẽ thiếu kiến thức nền, cần ôn tập thêm ở buổi 4.
` : 'Chưa có dữ liệu học viên vắng'}

4. BÀI TẬP VỀ NHÀ CÁC BUỔI TRƯỚC:
${previousHomework.length > 0 ? previousHomework.map((hw, i) => `
   Buổi ${i + 1}: ${hw.substring(0, 200)}${hw.length > 200 ? '...' : ''}
`).join('\n') : 'Chưa có thông tin bài tập về nhà'}

5. PHÂN TÍCH HỌC VIÊN VẮNG:
${attendanceStats.length > 0 ? `
${attendanceStats.map((s, idx) => {
  const session = previousSessions[idx];
  const absentStudents = session?.studentAttendance?.filter((a) => a.status === 'ABSENT').map((a) => a.student?.fullName || 'Unknown') || [];
  const lateStudents = session?.studentAttendance?.filter((a) => a.status === 'LATE').map((a) => a.student?.fullName || 'Unknown') || [];
  return `
   Buổi ${s.session}:
   - Vắng: ${absentStudents.length > 0 ? absentStudents.join(', ') : 'Không có'}
   - Muộn: ${lateStudents.length > 0 ? lateStudents.join(', ') : 'Không có'}`;
}).join('\n')}

   ⚠️ LƯU Ý: Học viên vắng nhiều buổi sẽ thiếu kiến thức nền, cần ôn tập thêm ở buổi 4.
` : 'Chưa có dữ liệu học viên vắng'}

═══════════════════════════════════════════════════════════════

🎯 YÊU CẦU PHÂN TÍCH

Dựa trên dữ liệu trên, hãy:

1. PHÂN TÍCH CHUYÊN SÂU (PHẢI DÀI VÀ CHI TIẾT):
   - Kết hợp: Nội dung buổi 4 + Attendance các buổi trước + Comments về học viên chưa hiểu + Học viên vắng
   - Xác định nguyên nhân gốc rễ của các vấn đề (nếu có)
   - Đánh giá mức độ nghiêm trọng và ưu tiên xử lý
   - Dự đoán vấn đề có thể phát sinh ở buổi ${sessionNumber}
   - MỖI PHẦN PHÂN TÍCH PHẢI DÀI TỐI THIỂU 5-7 CÂU

2. ĐỀ XUẤT GIẢI PHÁP (PHẢI CỤ THỂ VÀ DÀI):
   - Đưa ra ít nhất 2-3 phương án cho mỗi vấn đề
   - So sánh ưu/nhược điểm của từng phương án (DÀI 3-4 CÂU)
   - Chọn phương án tối ưu và giải thích lý do (DÀI 4-5 CÂU)
   - Đưa ra timeline và checklist thực hiện
   - Đặc biệt chú ý: Học viên nào vắng cần ôn tập gì? Học viên nào chưa hiểu cần hỗ trợ gì?

3. CẢI TIẾN CHỦ ĐỘNG (DỰA TRÊN DỮ LIỆU):
   - Đề xuất các cải tiến mà giáo viên có thể chưa nghĩ tới
   - Tối ưu hóa trải nghiệm học tập cho từng nhóm học viên (giỏi, trung bình, yếu)
   - Nâng cao hiệu quả giảng dạy

4. PHÒNG NGỪA RỦI RO (DỰA TRÊN ATTENDANCE VÀ COMMENTS):
   - Dự đoán các tình huống khó khăn có thể xảy ra (ví dụ: Học viên vắng nhiều không theo kịp)
   - Chuẩn bị phương án dự phòng chi tiết
   - Đưa ra tiêu chí quyết định khi nào chuyển sang plan B

═══════════════════════════════════════════════════════════════

⚠️ LƯU Ý:
- MỖI PHẦN PHÂN TÍCH PHẢI DÀI VÀ CHI TIẾT (tối thiểu 5-7 câu)
- Mỗi đề xuất phải CỤ THỂ, CÓ SỐ LIỆU, CÓ THỂ ÁP DỤNG NGAY
- Không đưa ra gợi ý chung chung
- PHẢI KẾT HỢP: Nội dung buổi 4 + Attendance + Comments + Học viên vắng
- Nội dung đã học: CHỈ DÙNG TEXT THUẦN, KHÔNG HTML TAGS (<p>, <br>, etc.)
- Kiến thức cần thiết: LẤY TRỰC TIẾP TỪ NỘI DUNG GIÁO TRÌNH BUỔI 4
- Dựa trên dữ liệu thực tế, không suy đoán
- Ưu tiên giải pháp thực tế, dễ triển khai
- Tính đến bối cảnh Việt Nam và văn hóa học tập địa phương
- Đặc biệt chú ý: Phân tích học viên nào vắng, học viên nào chưa hiểu (từ comments), và đưa ra phương án hỗ trợ cụ thể
`;

    // ============================================
    // STEP 4: Call OpenAI API (REQUIRED - NO MOCK DATA)
    // ============================================
    
    console.log('[teaching-analysis] Using OpenAI for analysis...');
    
    // Use GPT-3.5 by default for cost savings
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    let inputTokens = 0;
    let outputTokens = 0;
    
    try {
      const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: `Bạn là một chuyên gia giáo dục với 15 năm kinh nghiệm giảng dạy lập trình và robotics cho trẻ em tại Việt Nam.

BỐI CẢNH:
- Học viên: Trẻ em 6-16 tuổi
- Môi trường: Lớp học 8-15 học viên
- Thời lượng: 90-120 phút/buổi
- Mục tiêu: Phát triển tư duy logic, kỹ năng giải quyết vấn đề

NHIỆM VỤ:
Phân tích giáo trình và đưa ra đề xuất CỤ THỂ, THỰC TẾ, CÓ THỂ ÁP DỤNG NGAY để cải thiện buổi học.

NGUYÊN TẮC PHÂN TÍCH:
1. Phân tích PHẢI DÀI VÀ CHI TIẾT (tối thiểu 3-5 câu cho mỗi phần)
2. Xác định nguyên nhân gốc rễ của vấn đề (không chỉ triệu chứng bề nổi)
3. Kết hợp phân tích: Nội dung buổi 4 + Nhận xét các buổi trước + Attendance + Học viên vắng/chưa hiểu
4. Đưa ra giải pháp có tính ứng dụng cao, dễ triển khai
5. So sánh ưu/nhược điểm giữa các phương án
6. Dự đoán vấn đề có thể phát sinh và cách phòng tránh
7. Đề xuất cải tiến mà giáo viên có thể chưa nghĩ tới

LƯU Ý QUAN TRỌNG VỀ FORMAT:
- Nội dung đã học: Chỉ dùng TEXT THUẦN, KHÔNG dùng HTML tags như <p>, <br>, etc.
- Kiến thức cần thiết: Lấy TRỰC TIẾP từ nội dung giáo trình buổi học, không tự suy đoán
- Mỗi phần phân tích phải DÀI, CHI TIẾT, CÓ SỐ LIỆU CỤ THỂ

ĐỊNH DẠNG TRẢ LỜI:
Trả về JSON với cấu trúc sau (CHÚ Ý: Mỗi field phải CỤ THỂ, KHÔNG CHUNG CHUNG):

{
  "teachingSpeed": {
    "current": "Phân tích tốc độ hiện tại DỰA TRÊN DỮ LIỆU (attendance, comments) với số liệu cụ thể. PHẢI DÀI TỐI THIỂU 5-7 CÂU, bao gồm: (1) Tốc độ hiện tại như thế nào, (2) Học viên có theo kịp không (dựa trên attendance và comments), (3) Có học viên nào bị bỏ lại phía sau không, (4) Xu hướng attendance tăng/giảm cho thấy điều gì, (5) So sánh với các buổi trước",
    "recommendation": "Đề xuất CỤ THỂ với SỐ LIỆU (ví dụ: Giảm 15% nội dung lý thuyết từ 45 phút xuống 38 phút, tăng 20% thời gian thực hành từ 45 phút lên 54 phút). PHẢI DÀI TỐI THIỂU 4-5 CÂU, giải thích cụ thể cần làm gì, thay đổi gì, bao nhiêu phút cho từng phần",
    "reason": "Lý do CHI TIẾT với số liệu cụ thể từ dữ liệu. PHẢI DÀI TỐI THIỂU 5-7 CÂU, bao gồm: (1) Phân tích attendance các buổi trước, (2) Phân tích comments từ giáo viên, (3) Nhận diện học viên nào vắng nhiều, (4) Nhận diện học viên nào chưa hiểu bài (từ comments), (5) Kết hợp với nội dung buổi 4 để đưa ra lý do",
    "risks": ["Rủi ro 1 nếu không điều chỉnh (CHI TIẾT, DÀI 2-3 CÂU)", "Rủi ro 2 (CHI TIẾT, DÀI 2-3 CÂU)"],
    "expectedOutcome": "Kết quả mong đợi sau khi áp dụng (có số liệu dự kiến). PHẢI DÀI TỐI THIỂU 3-4 CÂU, bao gồm dự đoán cụ thể về attendance, engagement, completion rate"
  },
  
  "content": {
    "covered": [
      "Buổi 1: [MÔ TẢ CHI TIẾT NỘI DUNG ĐÃ HỌC - TEXT THUẦN, KHÔNG HTML TAGS, DÀI 3-5 CÂU]",
      "Buổi 2: [MÔ TẢ CHI TIẾT NỘI DUNG ĐÃ HỌC - TEXT THUẦN, KHÔNG HTML TAGS, DÀI 3-5 CÂU]",
      "Buổi 3: [MÔ TẢ CHI TIẾT NỘI DUNG ĐÃ HỌC - TEXT THUẦN, KHÔNG HTML TAGS, DÀI 3-5 CÂU]"
    ],
    "toBeCovered": [
      "[LẤY TRỰC TIẾP TỪ NỘI DUNG GIÁO TRÌNH BUỔI 4 - TEXT THUẦN, DÀI 3-5 CÂU, MÔ TẢ CỤ THỂ HỌC VIÊN SẼ HỌC GÌ]",
      "[KIẾN THỨC THỨ 2 TỪ GIÁO TRÌNH BUỔI 4]",
      "[KIẾN THỨC THỨ 3 TỪ GIÁO TRÌNH BUỔI 4]"
    ],
    "adjustments": [
      {
        "type": "add|remove|modify|reorder",
        "section": "Phần nào trong giáo trình (CỤ THỂ)",
        "current": "Hiện tại như thế nào (DÀI 2-3 CÂU)",
        "proposed": "Đề xuất thay đổi thành gì (DÀI 3-4 CÂU, CỤ THỂ)",
        "reason": "Tại sao cần thay đổi (DÀI 4-5 CÂU, dựa trên: (1) Phân tích attendance các buổi trước, (2) Comments từ giáo viên về học viên nào chưa hiểu, (3) Học viên nào vắng nhiều, (4) Nội dung buổi 4 yêu cầu kiến thức gì, (5) Kết hợp tất cả để đưa ra lý do)",
        "timeImpact": "+/- X phút",
        "priority": "high|medium|low"
      }
    ],
    "contentGaps": [
      "[PHÂN TÍCH CHI TIẾT: Kiến thức nào còn thiếu từ các buổi trước mà buổi 4 cần? DÀI 3-4 CÂU, kết hợp attendance và comments để xác định học viên nào thiếu kiến thức này]"
    ],
    "redundancies": [
      "[PHÂN TÍCH CHI TIẾT: Nội dung nào trùng lặp? DÀI 2-3 CÂU]"
    ]
  },
  
  "requiredKnowledge": [
    {
      "topic": "[LẤY TRỰC TIẾP TỪ NỘI DUNG GIÁO TRÌNH BUỔI 4 - Tên kiến thức cụ thể]",
      "level": "basic|intermediate|advanced",
      "checkMethod": "Cách kiểm tra học viên đã nắm chưa (DÀI 2-3 CÂU, CỤ THỂ)",
      "reviewTime": "X phút để ôn tập nếu cần",
      "studentsNeedReview": "[DỰA TRÊN ATTENDANCE VÀ COMMENTS: Học viên nào cần ôn tập? Học viên nào vắng buổi nào? DÀI 2-3 CÂU]"
    }
  ],
  
  "alternativeActivities": [
    {
      "activity": "Tên hoạt động CỤ THỂ",
      "duration": "X phút",
      "objective": "Mục tiêu CỤ THỂ",
      "materials": ["Vật liệu cần chuẩn bị"],
      "steps": ["Bước 1", "Bước 2", "Bước 3"],
      "whenToUse": "Dùng khi nào (ví dụ: Khi học viên mất tập trung)",
      "expectedEngagement": "Mức độ tương tác mong đợi (1-10)"
    }
  ],
  
  "situationHandling": [
    {
      "situation": "Tình huống CỤ THỂ",
      "indicators": ["Dấu hiệu nhận biết tình huống này"],
      "rootCause": "Nguyên nhân gốc rễ",
      "immediateAction": "Hành động ngay lập tức",
      "longTermSolution": "Giải pháp lâu dài",
      "preventionTips": ["Cách phòng tránh"]
    }
  ],
  
  "contingencyPlans": [
    {
      "scenario": "Kịch bản CỤ THỂ",
      "probability": "high|medium|low",
      "impact": "high|medium|low",
      "planA": "Phương án chính",
      "planB": "Phương án dự phòng",
      "resources": ["Tài nguyên cần chuẩn bị sẵn"],
      "decisionCriteria": "Khi nào chuyển từ Plan A sang Plan B"
    }
  ],
  
  "highlights": [
    {
      "section": "Phần nào trong giáo trình (CỤ THỂ)",
      "issue": "Vấn đề gì (CỤ THỂ, có số liệu nếu có)",
      "impact": "Ảnh hưởng đến học viên như thế nào",
      "suggestion": "Đề xuất chỉnh sửa CỤ THỂ (không chung chung)",
      "example": "Ví dụ minh họa",
      "priority": "high|medium|low",
      "type": "add|remove|modify|clarify",
      "estimatedTime": "Thời gian để thực hiện thay đổi"
    }
  ],
  
  "studentEngagement": {
    "predictedLevel": "Dự đoán mức độ hứng thú (1-10) dựa trên dữ liệu",
    "engagementStrategies": [
      {
        "strategy": "Chiến lược CỤ THỂ",
        "timing": "Phút thứ X trong buổi học",
        "expectedImpact": "Tác động mong đợi"
      }
    ],
    "attentionSpanManagement": "Cách quản lý sự tập trung của học viên"
  },
  
  "assessmentRecommendations": {
    "formativeAssessment": ["Cách đánh giá trong quá trình học"],
    "summativeAssessment": ["Cách đánh giá cuối buổi"],
    "checkpoints": [
      {
        "time": "Phút thứ X",
        "method": "Phương pháp kiểm tra",
        "passCriteria": "Tiêu chí đạt"
      }
    ]
  },
  
  "parentCommunication": {
    "keyMessages": ["Thông điệp chính gửi phụ huynh"],
    "progressIndicators": ["Chỉ số tiến bộ cần báo cáo"],
    "homeworkGuidance": "Hướng dẫn phụ huynh hỗ trợ con ở nhà"
  },
  
  "teacherPreparation": {
    "beforeClass": ["Chuẩn bị trước buổi học - CỤ THỂ"],
    "duringClass": ["Lưu ý trong buổi học"],
    "afterClass": ["Việc cần làm sau buổi học"],
    "estimatedPrepTime": "X phút chuẩn bị"
  },
  
  "improvementOpportunities": [
    {
      "area": "Lĩnh vực cải thiện",
      "currentState": "Hiện trạng",
      "desiredState": "Mục tiêu",
      "actionSteps": ["Bước 1", "Bước 2"],
      "timeline": "Thời gian thực hiện",
      "successMetrics": ["Chỉ số đo lường thành công"]
    }
  ]
}

LƯU Ý QUAN TRỌNG:
- PHÂN TÍCH PHẢI DÀI VÀ CHI TIẾT (mỗi phần tối thiểu 3-5 câu)
- KHÔNG đưa ra gợi ý chung chung như "Tăng cường tương tác", "Cải thiện chất lượng"
- MỖI gợi ý phải CỤ THỂ, CÓ SỐ LIỆU, CÓ THỂ ÁP DỤNG NGAY
- Dựa trên DỮ LIỆU THỰC TẾ từ các buổi trước (attendance, comments)
- PHẢI KẾT HỢP: Nội dung buổi 4 + Attendance các buổi trước + Comments về học viên nào chưa hiểu + Học viên nào vắng
- Nội dung đã học: CHỈ DÙNG TEXT THUẦN, KHÔNG HTML TAGS
- Kiến thức cần thiết: LẤY TRỰC TIẾP TỪ NỘI DUNG GIÁO TRÌNH, không tự suy đoán
- Đưa ra NHIỀU PHƯƠNG ÁN, so sánh ưu/nhược điểm
- Dự đoán VẤN ĐỀ CÓ THỂ PHÁT SINH và cách xử lý
- Tính đến bối cảnh Việt Nam và văn hóa học tập địa phương

VÍ DỤ VỀ PHÂN TÍCH DÀI VÀ CHI TIẾT:
❌ SAI (quá ngắn): "Tốc độ hiện tại vừa phải. Học viên theo kịp."
✅ ĐÚNG (dài và chi tiết): "Dựa trên dữ liệu 3 buổi trước, tốc độ giảng dạy hiện tại là 45 phút lý thuyết và 45 phút thực hành. Tỷ lệ chuyên cần trung bình 85% cho thấy đa số học viên đang theo kịp, tuy nhiên có 3/10 học viên (Học viên A vắng buổi 2, Học viên B vắng buổi 3, Học viên C có comment 'chưa hiểu bài') có nguy cơ tụt hậu. Phân tích comments từ giáo viên cho thấy 60% học viên phản ánh 'quá nhiều lý thuyết, ít thực hành', và attendance giảm 10% ở phần lý thuyết nhưng tăng 15% ở phần thực hành. Điều này cho thấy học viên hứng thú hơn với thực hành và cần điều chỉnh tỷ lệ thời gian."`
            },
            {
              role: 'user',
              content: aiPrompt
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 4096,
        });

        const analysisText = completion.choices[0].message.content;
        if (!analysisText) {
          throw new Error('OpenAI returned empty response');
        }
        
        const analysis = JSON.parse(analysisText);
        
        // Track token usage
        inputTokens = completion.usage?.prompt_tokens || 0;
        outputTokens = completion.usage?.completion_tokens || 0;

        console.log('[teaching-analysis] OpenAI analysis completed successfully');
        console.log(`[teaching-analysis] Tokens: ${inputTokens} input + ${outputTokens} output = ${inputTokens + outputTokens} total`);
        
        // ============================================
        // STEP 5: Cache the result
        // ============================================
        await setCachedAnalysis(cacheKey, analysis, {
          model,
          usedAI: true,
          inputTokens,
          outputTokens,
          generatedAt: new Date().toISOString(),
        }, { ttlHours: 24 });

        // ============================================
        // STEP 6: Log usage
        // ============================================
        const totalTokens = inputTokens + outputTokens;
        const estimatedCost = calculateCost(model, inputTokens, outputTokens);
        const responseTimeMs = Date.now() - startTime;

        await logAIUsage({
          userEmail,
          feature: 'teaching-analysis',
          classId,
          sessionNumber,
          model,
          inputTokens,
          outputTokens,
          totalTokens,
          estimatedCost,
          responseTimeMs,
          success: true,
        });

        console.log(`[teaching-analysis] Cost: $${estimatedCost.toFixed(4)} | Time: ${responseTimeMs}ms`);

        return NextResponse.json({
          success: true,
          analysis,
          metadata: {
            classId,
            className,
            courseName,
            sessionNumber,
            previousSessionsCount: previousSessions.length,
            commentsCount: previousComments.length,
            usedAI: true,
            aiProvider: 'OpenAI',
            model,
            tokens: { input: inputTokens, output: outputTokens, total: totalTokens },
            estimatedCost,
            cached: false,
            rateLimit: {
              remaining: rateLimit.remaining - 1,
              limit: rateLimit.limit,
            },
          },
        });
        
      } catch (error: any) {
        console.error('[teaching-analysis] OpenAI error:', error.message);
        const quotaExceeded = isOpenAIQuotaError(error);
        
        // Log failed attempt
        await logAIUsage({
          userEmail,
          feature: 'teaching-analysis',
          classId,
          sessionNumber,
          model,
          success: false,
          errorMessage: error.message,
          responseTimeMs: Date.now() - startTime,
        });
        
        if (quotaExceeded) {
          return NextResponse.json({
            success: false,
            code: 'OPENAI_QUOTA_EXCEEDED',
            error: 'OpenAI API key đã hết quota hoặc đã chạm giới hạn chi tiêu tháng. Vui lòng kiểm tra Billing/Usage Limits trong OpenAI Platform, nạp thêm credit hoặc dùng API key thuộc project còn quota.',
          }, { status: 429 });
        }

        // Return error to user - NO FALLBACK TO MOCK DATA
        return NextResponse.json({
          success: false,
          error: `Không thể phân tích giáo trình: ${error.message}. Vui lòng thử lại sau.`,
        }, { status: 500 });
      }

  } catch (error: any) {
    console.error('[teaching-analysis] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể phân tích giáo trình' },
      { status: 500 }
    );
  }
}
