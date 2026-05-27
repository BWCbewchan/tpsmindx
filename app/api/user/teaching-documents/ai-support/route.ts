import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'

import {
  classifyTeachingDocument,
  findTeachingDocument,
  getTeachingDocumentObject,
  type TeachingDocument,
} from '@/lib/teaching-documents'
import { TPS_SESSION_COOKIE, verifySessionCookieValue } from '@/lib/session-cookie'

type StudentAttendance = {
  status?: string
  comment?: string
  sendCommentStatus?: string
  commentByAreas?: Array<{
    content?: string
    grade?: number | null
    type?: string
    courseProcessFinalEvaluationTitle?: string | null
  }>
  student?: {
    id?: string
    fullName?: string
    email?: string
    phoneNumber?: string
  }
}

type ClassContext = {
  classId?: string
  className?: string
  students?: Array<{ id?: string; fullName?: string }>
  courseName?: string
  courseLineName?: string
  centreName?: string
  sessionHour?: number | null
  summary?: string
  homework?: string
  teacherNames?: string[]
  studentAttendance?: StudentAttendance[]
}

type StudentInsight = {
  studentName: string
  status?: string
  insight: string
  supportActions: string[]
  teacherApproach: string
}

type ReferenceLink = {
  title: string
  url: string
  reason: string
}

type SupportSkills = {
  searchQueries: string[]
  imagePrompts: string[]
  referenceLinks: ReferenceLink[]
}

type FollowUpResult = {
  answer: string
  imageQueries: string[]
  videoQueries: string[]
  referenceLinks: ReferenceLink[]
}

type AiSupportAnalysis = {
  overview: string
  curriculumFit: string[]
  classSignals: string[]
  pacingSuggestions: string[]
  contentAdjustments: string[]
  activityIdeas: string[]
  presentationTips: string[]
  generalStudentNotes: string[]
  studentNotes: StudentInsight[]
  supportSkills: SupportSkills
}

function normalizeText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function stripHtml(value: unknown) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function compactList(items: Array<string | undefined | null>, fallback: string) {
  const next = items.map((item) => stripHtml(item)).filter(Boolean) as string[]
  return next.length > 0 ? next : [fallback]
}

function makeSearchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

function safeUrl(value: unknown, fallbackQuery: string) {
  const raw = stripHtml(value)
  try {
    const url = new URL(raw)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
  } catch {}
  return makeSearchUrl(fallbackQuery)
}

function normalizeComparable(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

function normalizeSubjectName(value: string) {
  const normalized = normalizeComparable(value)
  if (/robot|vex|lego/.test(normalized)) return 'Robotic'
  if (/art|visual|graphic|multimedia|design/.test(normalized)) return 'Art'
  if (/ebook|e-book/.test(normalized)) return 'E-Book'
  if (/trai nghiem|kind/.test(normalized)) return 'Trải nghiệm'
  if (/coding|scratch|python|web|game|computer|lap trinh|javascript/.test(normalized)) return 'Coding'
  return value || 'Chưa rõ khối'
}

function buildCurriculumFit(document: TeachingDocument, classContext: ClassContext) {
  const documentSubject = normalizeSubjectName(document.subject_name)
  const classSubject = normalizeSubjectName(
    `${classContext.courseLineName || ''} ${classContext.courseName || ''} ${classContext.className || ''}`,
  )
  const documentCourse = stripHtml(document.course_name || '')
  const classCourseText = normalizeComparable(`${classContext.courseName || ''} ${classContext.className || ''}`)
  const documentCourseText = normalizeComparable(documentCourse)
  const subjectMatches = documentSubject === classSubject
  const courseMatches =
    !documentCourseText ||
    documentCourseText === 'e-book' ||
    classCourseText.includes(documentCourseText) ||
    documentCourseText.split(/\s+/).some((part) => part.length >= 5 && classCourseText.includes(part))

  return compactList(
    [
      `Giáo trình đang mở: ${documentSubject}${documentCourse ? ` / ${documentCourse}` : ''} / ${document.document_level} / ${document.lesson_number}.`,
      `Lớp đang chọn: ${classSubject}${classContext.courseName ? ` / ${classContext.courseName}` : ''}.`,
      subjectMatches
        ? 'Khối/bộ môn của lớp đang chọn khớp với giáo trình.'
        : `Cảnh báo: lớp đang chọn thuộc ${classSubject}, nhưng giáo trình thuộc ${documentSubject}. Nên đổi đúng giáo trình hoặc đổi đúng lớp trước khi dùng gợi ý.`,
      subjectMatches && courseMatches
        ? 'Môn học của giáo trình có dấu hiệu khớp với lớp đang học.'
        : subjectMatches
          ? 'Khối đã khớp, nhưng môn/nhánh học chưa chắc trùng hoàn toàn; hãy kiểm tra lại tên môn trước khi dạy.'
          : null,
    ],
    'Chưa đủ dữ liệu để đối chiếu lớp với giáo trình.',
  )
}

function getAttendanceSignals(classContext: ClassContext) {
  const attendances = classContext.studentAttendance || []
  const students = classContext.students || []
  const totalStudents = students.length
  const checkedCount = attendances.length
  const absentLike = attendances.filter((item) => /absent|vắng|nghỉ/i.test(item.status || '')).length
  const commentCount = attendances.filter(
    (item) => item.comment || item.commentByAreas?.some((area) => area.content),
  ).length
  const gradeValues = attendances
    .flatMap((item) => item.commentByAreas || [])
    .map((area) => Number(area.grade))
    .filter((value) => Number.isFinite(value))

  const averageGrade =
    gradeValues.length > 0
      ? Math.round((gradeValues.reduce((sum, value) => sum + value, 0) / gradeValues.length) * 10) / 10
      : null

  return {
    totalStudents,
    checkedCount,
    absentLike,
    commentCount,
    averageGrade,
    attendanceRate: totalStudents > 0 ? Math.round((checkedCount / totalStudents) * 100) : null,
  }
}

async function extractLessonText(document: TeachingDocument) {
  const kind = classifyTeachingDocument(document.file_type, document.file_name)
  if (kind !== 'docx') {
    return [document.title, document.description, document.lesson_number, document.course_name]
      .filter(Boolean)
      .join('\n')
  }

  try {
    const object = await getTeachingDocumentObject(document.s3_bucket, document.s3_key)
    const result = await mammoth.extractRawText({ buffer: object.buffer })
    return result.value.replace(/\s+/g, ' ').trim().slice(0, 4500)
  } catch (error) {
    console.error('[ai-support] Failed to extract lesson text:', error)
    return [document.title, document.description, document.lesson_number, document.course_name]
      .filter(Boolean)
      .join('\n')
  }
}

function detectLessonKeywords(text: string) {
  const lower = text.toLowerCase()
  return compactList(
    [
      lower.includes('scratch') ? 'Scratch' : null,
      lower.includes('list') || lower.includes('danh sách') ? 'danh sách/list' : null,
      lower.includes('biến') || lower.includes('variable') ? 'biến' : null,
      lower.includes('vòng lặp') || lower.includes('loop') ? 'vòng lặp' : null,
      lower.includes('robot') || lower.includes('vex') ? 'robotics' : null,
      lower.includes('thiết kế') || lower.includes('design') ? 'thiết kế' : null,
      lower.includes('dự án') || lower.includes('project') ? 'dự án' : null,
      lower.includes('chuẩn bị') || lower.includes('tiến trình') ? 'tiến trình dạy học' : null,
    ],
    'mục tiêu chính của giáo trình đang mở',
  ).slice(0, 5)
}

function buildStudentSourceNotes(classContext: ClassContext) {
  return (classContext.studentAttendance || [])
    .filter((item) => item.student?.fullName && (item.comment || item.commentByAreas?.some((area) => area.content)))
    .slice(0, 8)
    .map((item) => {
      const comments = [
        item.comment ? stripHtml(item.comment) : null,
        ...(item.commentByAreas || []).map((area) => {
          const content = stripHtml(area.content)
          if (!content) return null
          const title = stripHtml(area.courseProcessFinalEvaluationTitle)
          return title ? `${title}: ${content}` : content
        }),
      ].filter(Boolean) as string[]

      return {
        studentName: stripHtml(item.student?.fullName),
        status: stripHtml(item.status),
        comments,
      }
    })
}

function buildFallbackStudentInsights(classContext: ClassContext, lessonText: string): StudentInsight[] {
  const keywords = detectLessonKeywords(lessonText)
  return buildStudentSourceNotes(classContext).map((item) => {
    const joined = item.comments.join(' ').toLowerCase()
    const needsSupport = /khó|chưa|nhắc|hỗ trợ|mất tập trung|chậm|không/i.test(joined)
    const strength = /tốt|tập trung|chủ động|thao tác|tiếp thu/i.test(joined)

    return {
      studentName: item.studentName,
      status: item.status,
      insight: needsSupport
        ? `Học sinh có tín hiệu cần được kèm nhịp ở phần ${keywords[0]}; nên kiểm tra hiểu sớm thay vì chờ đến cuối hoạt động.`
        : strength
          ? `Học sinh có nền tiếp thu tốt, có thể giao vai trò hỗ trợ bạn hoặc thử thách mở rộng sau khi hoàn thành nhiệm vụ chính.`
          : `Chưa có tín hiệu đủ mạnh; nên quan sát mức độ tập trung và khả năng tự hoàn thành nhiệm vụ đầu tiên.`,
      supportActions: needsSupport
        ? [
            'Cho nhiệm vụ nhỏ hơn trong 5-7 phút đầu và xác nhận lại từng bước.',
            'Đặt học sinh gần nhóm/bạn có nhịp làm ổn để dễ hỗ trợ.',
          ]
        : [
            'Giao checkpoint rõ ràng để học sinh tự báo tiến độ.',
            'Chuẩn bị câu hỏi mở rộng nếu học sinh hoàn thành sớm.',
          ],
      teacherApproach: needsSupport
        ? 'Ưu tiên hỏi gợi mở, demo lại một thao tác mẫu, tránh tăng độ khó quá sớm.'
        : 'Giữ nhịp khuyến khích, cho học sinh giải thích lại cách làm để củng cố hiểu bài.',
    }
  })
}

function buildHeuristicAnalysis(document: TeachingDocument, classContext: ClassContext, lessonText: string): AiSupportAnalysis {
  const signals = getAttendanceSignals(classContext)
  const keywords = detectLessonKeywords(lessonText)
  const className = normalizeText(classContext.className, 'lớp đang chọn')
  const courseName = normalizeText(classContext.courseName || classContext.courseLineName, document.course_name || document.subject_name)
  const curriculumFit = buildCurriculumFit(document, classContext)
  const hasLowAttendance =
    signals.attendanceRate !== null && signals.totalStudents > 0 && signals.attendanceRate < 75
  const hasManyComments = signals.commentCount >= Math.max(2, Math.ceil((signals.totalStudents || 1) * 0.25))
  const lessonNumber = normalizeText(document.lesson_number, 'buổi học hiện tại')

  return {
    overview: `Dựa trên ${className}, ${signals.totalStudents} học viên và giáo trình "${document.title}", nên dạy theo nhịp kiểm tra hiểu nhanh, chia nhỏ phần thực hành và bám các trọng tâm: ${keywords.join(', ')}.`,
    curriculumFit,
    classSignals: compactList(
      [
        `${className} thuộc ${courseName}${classContext.centreName ? ` tại ${classContext.centreName}` : ''}.`,
        signals.attendanceRate !== null
          ? `Đã có ${signals.checkedCount}/${signals.totalStudents} ghi nhận chuyên cần trong dữ liệu lớp (${signals.attendanceRate}%).`
          : 'Chưa đủ dữ liệu chuyên cần để kết luận tỉ lệ tham gia.',
        signals.absentLike > 0 ? `Có ${signals.absentLike} ghi nhận vắng/nghỉ, cần dành 3-5 phút nối lại mạch bài cho nhóm này.` : null,
        hasManyComments ? `Có ${signals.commentCount} nhận xét/đánh giá học sinh, nên đọc nhanh trước giờ học để chia nhóm phù hợp.` : null,
        signals.averageGrade !== null ? `Điểm/grade trung bình trong nhận xét hiện có khoảng ${signals.averageGrade}; dùng để chọn độ khó bài tập mở rộng.` : null,
        classContext.summary ? `Tóm tắt buổi gần nhất: ${stripHtml(classContext.summary)}` : null,
        classContext.homework ? `Bài tập về nhà gần nhất: ${stripHtml(classContext.homework)}` : null,
      ],
      'Chưa có nhiều tín hiệu lớp học; nên bắt đầu bằng câu hỏi kiểm tra đầu giờ.',
    ),
    pacingSuggestions: compactList(
      [
        hasLowAttendance
          ? 'Giảm tốc ở 10 phút đầu: nhắc lại mục tiêu buổi trước và cho một nhiệm vụ khởi động rất ngắn.'
          : 'Có thể đi theo tốc độ chuẩn, nhưng vẫn chèn checkpoint sau mỗi phần kiến thức mới.',
        keywords.some((item) => ['danh sách/list', 'biến', 'vòng lặp'].includes(item))
          ? 'Với phần khái niệm lập trình, dùng chu kỳ: ví dụ mẫu -> học sinh dự đoán kết quả -> thực hành sửa lỗi.'
          : 'Chia nội dung thành 2-3 mốc nhỏ, mỗi mốc có sản phẩm nhìn thấy được để giữ nhịp lớp.',
        'Nếu hơn 30% học sinh chậm ở checkpoint đầu, bỏ bớt phần mở rộng và ưu tiên hoàn thành mục tiêu lõi của bài.',
      ],
      'Dạy theo nhịp chuẩn và kiểm tra hiểu sau từng hoạt động chính.',
    ),
    contentAdjustments: compactList(
      [
        `Mở bài bằng cách liên hệ ${keywords[0]} với sản phẩm cuối của ${lessonNumber}.`,
        document.description ? `Dùng mô tả giáo trình làm mục tiêu buổi học: ${stripHtml(document.description)}` : null,
        'Chuẩn bị một phiên bản bài tập tối thiểu cho học sinh cần hỗ trợ và một thử thách thêm cho nhóm làm nhanh.',
        'Không đưa quá nhiều thuật ngữ cùng lúc; mỗi thuật ngữ nên đi kèm một hành động học sinh phải làm ngay.',
      ],
      'Giữ trọng tâm vào mục tiêu chính của giáo trình, tránh mở rộng quá nhiều trước khi lớp hoàn thành bài lõi.',
    ),
    activityIdeas: compactList(
      [
        'Cho học sinh làm theo cặp: một bạn điều khiển thao tác, một bạn đọc yêu cầu và kiểm tra lỗi.',
        `Tạo ví dụ gần với lớp: đổi tên nhân vật/dữ liệu/sản phẩm theo chủ đề của ${className}.`,
        'Dùng mini-demo 3 phút trước mỗi phần thực hành, sau đó yêu cầu học sinh tự lặp lại không nhìn màn chiếu.',
        'Cuối buổi dùng 2 câu hỏi exit ticket: “em đã làm được gì?” và “phần nào còn vướng?”.',
      ],
      'Dùng hoạt động mẫu ngắn, thực hành theo cặp và tổng kết bằng sản phẩm cụ thể.',
    ),
    presentationTips: compactList(
      [
        'Trình bày theo bảng 3 cột: Mục tiêu - Thao tác - Lỗi thường gặp.',
        'Khi demo, nói trước kết quả mong muốn rồi mới thao tác để học sinh có điểm bám.',
        'Dùng màu/khung nhấn cho phần học sinh cần copy chính xác, phần còn lại để tự biến đổi.',
        'Sau mỗi 10-15 phút, dừng 60 giây để cả lớp giơ màn hình/sản phẩm, tránh phát hiện lỗi quá muộn.',
      ],
      'Giữ phần trình bày ngắn, có ví dụ trực quan và kiểm tra hiểu thường xuyên.',
    ),
    generalStudentNotes: compactList(
      [
        `Thông báo trước cho học viên mục tiêu của ${lessonNumber} bằng một câu ngắn, dễ nhớ.`,
        'Nhắc học viên lưu sản phẩm sau từng mốc để tránh mất tiến độ khi thực hành.',
        'Chuẩn bị câu hỏi tự kiểm tra cuối hoạt động để học viên biết mình đã hiểu đến đâu.',
      ],
      'Giữ hướng dẫn cho học viên ngắn, rõ nhiệm vụ và có checkpoint sau từng hoạt động.',
    ),
    studentNotes: buildFallbackStudentInsights(classContext, lessonText),
    supportSkills: {
      searchQueries: [
        `${document.course_name || document.subject_name} ${document.lesson_number} ví dụ minh họa`,
        `${keywords.join(' ')} classroom activity for kids`,
        `${document.title} MindX teaching idea`,
      ],
      imagePrompts: [
        `Minh họa lớp học MindX đang học ${keywords[0]}, phong cách flat illustration, rõ các bước thực hành, màu sắc tươi sáng, không chữ nhỏ.`,
        `Hình minh họa khái niệm ${keywords.join(', ')} cho học sinh 8-12 tuổi, dễ hiểu, có nhân vật học sinh và màn hình máy tính.`,
      ],
      referenceLinks: [
        {
          title: 'Tìm tài liệu minh họa trên Google',
          url: makeSearchUrl(`${document.course_name || document.subject_name} ${keywords.join(' ')}`),
          reason: 'Dùng để lấy thêm ví dụ, hình ảnh hoặc cách diễn giải khác trước buổi học.',
        },
      ],
    },
  }
}

function extractJsonObject(text: string) {
  const cleaned = text.replace(/```json|```/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('Gemini response is not JSON')
  return JSON.parse(cleaned.slice(start, end + 1))
}

function sanitizeStringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  const next = value.map((item) => stripHtml(item)).filter(Boolean)
  return next.length > 0 ? next.slice(0, 8) : fallback
}

function sanitizeStudentInsights(value: unknown, fallback: StudentInsight[]) {
  if (!Array.isArray(value)) return fallback
  const next = value
    .map((item: any) => {
      const studentName = stripHtml(item?.studentName)
      if (!studentName) return null
      return {
        studentName,
        status: stripHtml(item?.status),
        insight: stripHtml(item?.insight) || 'Cần quan sát thêm trong hoạt động đầu giờ để có nhận định chắc hơn.',
        supportActions: sanitizeStringList(item?.supportActions, [
          'Đặt checkpoint ngắn để kiểm tra mức độ hiểu bài.',
          'Điều chỉnh độ khó theo tốc độ hoàn thành nhiệm vụ đầu tiên.',
        ]).slice(0, 3),
        teacherApproach:
          stripHtml(item?.teacherApproach) ||
          'Giữ phản hồi ngắn, cụ thể và gắn với thao tác học sinh đang làm.',
      }
    })
    .filter(Boolean) as StudentInsight[]
  return next.length > 0 ? next : fallback
}

function sanitizeReferenceLinks(value: unknown, fallback: ReferenceLink[]) {
  if (!Array.isArray(value)) return fallback
  const next = value
    .map((item: any) => {
      const title = stripHtml(item?.title)
      const reason = stripHtml(item?.reason)
      const fallbackQuery = title || reason || 'MindX teaching reference'
      if (!title) return null
      return {
        title,
        url: safeUrl(item?.url, fallbackQuery),
        reason: reason || 'Nguồn tham khảo hỗ trợ chuẩn bị bài giảng.',
      }
    })
    .filter(Boolean) as ReferenceLink[]
  return next.length > 0 ? next.slice(0, 6) : fallback
}

function sanitizeSupportSkills(value: any, fallback: SupportSkills): SupportSkills {
  return {
    searchQueries: sanitizeStringList(value?.searchQueries, fallback.searchQueries).slice(0, 6),
    imagePrompts: sanitizeStringList(value?.imagePrompts, fallback.imagePrompts).slice(0, 4),
    referenceLinks: sanitizeReferenceLinks(value?.referenceLinks, fallback.referenceLinks),
  }
}

function sanitizeFollowUp(value: any, fallbackQuestion: string): FollowUpResult {
  return {
    answer:
      stripHtml(value?.answer) ||
      'AI chưa tạo được câu trả lời phù hợp. Hãy thử hỏi cụ thể hơn về hoạt động, ví dụ, hình ảnh hoặc video minh họa.',
    imageQueries: sanitizeStringList(value?.imageQueries, [
      `${fallbackQuestion} hình ảnh minh họa giáo dục`,
    ]).slice(0, 5),
    videoQueries: sanitizeStringList(value?.videoQueries, [
      `${fallbackQuestion} video minh họa bài học`,
    ]).slice(0, 5),
    referenceLinks: sanitizeReferenceLinks(value?.referenceLinks, [
      {
        title: 'Tìm thêm tài liệu liên quan',
        url: makeSearchUrl(fallbackQuestion),
        reason: 'Nguồn tìm kiếm bổ sung cho câu hỏi của giáo viên.',
      },
    ]),
  }
}

function sanitizeAiAnalysis(value: any, fallback: AiSupportAnalysis): AiSupportAnalysis {
  return {
    overview: stripHtml(value?.overview) || fallback.overview,
    curriculumFit: sanitizeStringList(value?.curriculumFit, fallback.curriculumFit),
    classSignals: sanitizeStringList(value?.classSignals, fallback.classSignals),
    pacingSuggestions: sanitizeStringList(value?.pacingSuggestions, fallback.pacingSuggestions),
    contentAdjustments: sanitizeStringList(value?.contentAdjustments, fallback.contentAdjustments),
    activityIdeas: sanitizeStringList(value?.activityIdeas, fallback.activityIdeas),
    presentationTips: sanitizeStringList(value?.presentationTips, fallback.presentationTips),
    generalStudentNotes: sanitizeStringList(value?.generalStudentNotes, fallback.generalStudentNotes),
    studentNotes: sanitizeStudentInsights(value?.studentNotes, fallback.studentNotes),
    supportSkills: sanitizeSupportSkills(value?.supportSkills, fallback.supportSkills),
  }
}

async function callGeminiJson(prompt: string, apiKey: string) {
  if (!apiKey) return null

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.35,
        },
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[ai-support] Gemini error:', response.status, errorText.slice(0, 500))
    return null
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join('\n') || ''
  if (!text) return null
  return extractJsonObject(text)
}

async function buildGeminiAnalysis(
  document: TeachingDocument,
  classContext: ClassContext,
  lessonText: string,
  fallback: AiSupportAnalysis,
  apiKey: string,
) {
  if (!apiKey) return null

  try {
    const sourceStudents = buildStudentSourceNotes(classContext)
    const prompt = `
Bạn là trợ lý sư phạm cho giáo viên MindX. Hãy phân tích lớp học và giáo trình đang mở.

Yêu cầu quan trọng:
- Trả về DUY NHẤT JSON hợp lệ, không markdown, không HTML.
- Không lặp lại nguyên văn nhận xét LMS ở phần studentNotes.
- studentNotes phải là NHẬN ĐỊNH/GỢI Ý CHO PHÍA HỌC SINH: xu hướng học tập, rủi ro, cách hỗ trợ, cách giáo viên nên tương tác.
- generalStudentNotes là lưu ý chung cho toàn bộ học viên trước/trong/sau buổi học, không nêu tên từng học sinh.
- supportSkills gồm kỹ năng/tư liệu hỗ trợ giáo viên: từ khóa tìm kiếm, prompt tạo ảnh minh họa, link tham khảo thực tế. Link phải là URL http/https hợp lệ, ưu tiên nguồn có ích cho giáo dục/lập trình/trực quan hóa.
- Chú ý chọn đúng giáo trình bộ môn cho lớp đang học; nếu lệch khối/môn, cảnh báo rõ trong curriculumFit.
- Viết tiếng Việt, ngắn gọn, thực tế cho giáo viên dùng ngay.

Schema:
{
  "overview": "string",
  "curriculumFit": ["string"],
  "classSignals": ["string"],
  "pacingSuggestions": ["string"],
  "contentAdjustments": ["string"],
  "activityIdeas": ["string"],
  "presentationTips": ["string"],
  "generalStudentNotes": ["string"],
  "studentNotes": [
    {
      "studentName": "string",
      "status": "string",
      "insight": "string",
      "supportActions": ["string"],
      "teacherApproach": "string"
    }
  ],
  "supportSkills": {
    "searchQueries": ["string"],
    "imagePrompts": ["string"],
    "referenceLinks": [
      {
        "title": "string",
        "url": "https://...",
        "reason": "string"
      }
    ]
  }
}

Giáo trình:
${JSON.stringify({
  title: document.title,
  subject: document.subject_name,
  course: document.course_name,
  level: document.document_level,
  lesson: document.lesson_number,
  description: stripHtml(document.description),
  extractedContent: lessonText.slice(0, 3800),
})}

Lớp đang chọn:
${JSON.stringify({
  className: classContext.className,
  courseName: classContext.courseName,
  courseLineName: classContext.courseLineName,
  centreName: classContext.centreName,
  sessionHour: classContext.sessionHour,
  summary: stripHtml(classContext.summary),
  homework: stripHtml(classContext.homework),
  studentCount: classContext.students?.length || 0,
  studentSignals: sourceStudents,
})}
`.trim()

    const json = await callGeminiJson(prompt, apiKey)
    if (!json) return null
    return sanitizeAiAnalysis(json, fallback)
  } catch (error) {
    console.error('[ai-support] Gemini parse/generate error:', error)
    return null
  }
}

async function buildGeminiFollowUp(
  document: TeachingDocument,
  classContext: ClassContext,
  lessonText: string,
  question: string,
  apiKey: string,
) {
  try {
    const prompt = `
Bạn là trợ lý sư phạm MindX. Giáo viên đang hỏi thêm trong modal AI Hỗ Trợ.

Yêu cầu:
- Trả về DUY NHẤT JSON hợp lệ, không markdown, không HTML.
- Câu trả lời phải bám giáo trình đang mở và lớp đang chọn.
- Nếu câu hỏi yêu cầu hình ảnh, trả imageQueries hữu ích để tìm ảnh minh họa.
- Nếu câu hỏi yêu cầu video, trả videoQueries hữu ích để tìm video minh họa.
- referenceLinks phải là URL http/https hợp lệ, ưu tiên tài liệu/hướng dẫn dễ dùng cho giáo viên.
- Không lộ raw file, không đề xuất tải tài liệu bảo mật.

Schema:
{
  "answer": "string",
  "imageQueries": ["string"],
  "videoQueries": ["string"],
  "referenceLinks": [
    {
      "title": "string",
      "url": "https://...",
      "reason": "string"
    }
  ]
}

Câu hỏi của giáo viên:
${question}

Giáo trình:
${JSON.stringify({
  title: document.title,
  subject: document.subject_name,
  course: document.course_name,
  level: document.document_level,
  lesson: document.lesson_number,
  description: stripHtml(document.description),
  extractedContent: lessonText.slice(0, 3200),
})}

Lớp đang chọn:
${JSON.stringify({
  className: classContext.className,
  courseName: classContext.courseName,
  courseLineName: classContext.courseLineName,
  centreName: classContext.centreName,
  studentCount: classContext.students?.length || 0,
  summary: stripHtml(classContext.summary),
  homework: stripHtml(classContext.homework),
  studentSignals: buildStudentSourceNotes(classContext),
})}
`.trim()

    const json = await callGeminiJson(prompt, apiKey)
    if (!json) return null
    return sanitizeFollowUp(json, question)
  } catch (error) {
    console.error('[ai-support] Gemini follow-up error:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get(TPS_SESSION_COOKIE)?.value
  if (!sessionCookie) {
    return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const session = await verifySessionCookieValue(sessionCookie)
  if (!session?.email) {
    return NextResponse.json({ success: false, error: 'Phiên đăng nhập không hợp lệ' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const documentId = Number(body.documentId)
    const classContext = (body.classContext || {}) as ClassContext
    const userQuestion = stripHtml(body.question).slice(0, 1000)
    const geminiApiKey = stripHtml(body.geminiApiKey).trim()

    if (!Number.isInteger(documentId) || documentId <= 0) {
      return NextResponse.json({ success: false, error: 'Giáo trình không hợp lệ' }, { status: 400 })
    }
    if (!classContext.classId) {
      return NextResponse.json({ success: false, error: 'Chưa chọn lớp học' }, { status: 400 })
    }
    if (!geminiApiKey) {
      return NextResponse.json({ success: false, error: 'Chưa có GEMINI API KEY' }, { status: 400 })
    }

    const document = await findTeachingDocument(documentId)
    if (!document) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy giáo trình' }, { status: 404 })
    }
    if (document.document_status !== 'published') {
      return NextResponse.json({ success: false, error: 'Bạn không có quyền xem giáo trình này' }, { status: 403 })
    }

    const lessonText = await extractLessonText(document)
    if (userQuestion) {
      const followUp = await buildGeminiFollowUp(document, classContext, lessonText, userQuestion, geminiApiKey)
      if (!followUp) {
        return NextResponse.json(
          {
            success: false,
            error: 'Gemini chưa trả lời được câu hỏi này. Vui lòng thử lại hoặc kiểm tra API key đã lưu trong trình duyệt.',
          },
          { status: 503 },
        )
      }

      return NextResponse.json({ success: true, aiGenerated: true, followUp })
    }

    const fallback = buildHeuristicAnalysis(document, classContext, lessonText)
    const analysis = await buildGeminiAnalysis(document, classContext, lessonText, fallback, geminiApiKey)
    if (!analysis) {
      return NextResponse.json(
        {
          success: false,
          error: 'Gemini chưa sẵn sàng. Vui lòng kiểm tra API key đã lưu trong trình duyệt rồi thử lại.',
        },
        { status: 503 },
      )
    }

    return NextResponse.json({ success: true, aiGenerated: true, analysis })
  } catch (error) {
    console.error('[ai-support] Error:', error)
    return NextResponse.json({ success: false, error: 'Không thể tạo gợi ý AI' }, { status: 500 })
  }
}
