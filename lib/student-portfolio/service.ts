import pool from '@/lib/db';
import { callLmsApi } from '@/lib/lms-api';
import { generateSlug } from '@/lib/utils';
import type {
  StudentPortfolioData,
  StudentPortfolioListItem,
  StudentPortfolioRecord,
  PortfolioStatus,
} from './types';

const GET_PORTFOLIO_CLASSES_QUERY = /* graphql */ `
  query GetClasses($search: String, $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String) {
    classes(payload: {
      filter_textSearch: $search,
      pageIndex: $pageIndex,
      itemsPerPage: $itemsPerPage,
      orderBy: $orderBy
    }) {
      data {
        id
        name
        status
        startDate
        endDate
        numberOfSessions
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        teachers {
          isActive
          teacher { id username code fullName email phoneNumber imageUrl }
          role { id name shortName }
        }
        students {
          _id
          activeInClass
          createdAt
          note
          student {
            id
            fullName
            phoneNumber
            email
            gender
            imageUrl
            customer { fullName phoneNumber email facebook zalo }
          }
          completionInfo { status note reason }
        }
        slots {
          _id
          date
          startTime
          endTime
          sessionHour
          summary
          homework
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
        courseProcess {
          defaultCommentAreas { id name type }
          specificSessions { session commentAreas { id name type } }
          finalSession {
            finalEvaluations { id title commentAreas { id name type } }
            demoScore { commentAreas { id name type demo { id title maxScore } } }
          }
          checkpointSessions {
            session
            checkpointCommentArea { id name type }
            otherComments { id name type }
            evaluations { id title commentAreas { id name type } }
          }
        }
      }
      pagination { total }
    }
  }
`;

const FIND_ALL_STUDENT_WORKS_QUERY = /* graphql */ `
  query findAllStudentWorks($studentId: String, $classId: String, $classIds: [String], $classSessionId: String) {
    findAllStudentWorks(payload: {
      studentId_equals: $studentId,
      classId_equals: $classId,
      classId_in: $classIds,
      classSessionId_equals: $classSessionId
    }) {
      data {
        id
        status
        studentId
        classSessionId
        classId
        version
        displayOrder
        createdAt
        lastModifiedAt
        latestData {
          title
          thumbnail
          imageUrl
          videoUrls
          attachmentUrls
          comment
          relatedUrls { name url }
        }
      }
    }
  }
`;

const GET_STUDENT_CLASSES_QUERY = /* graphql */ `
  query FindOneStudent($studentId: ID!) {
    findOneStudent(payload: { studentId: $studentId }) {
      id
      fullName
      phoneNumber
      email
      imageUrl
      customer { fullName phoneNumber email facebook zalo }
      studyClasses {
        id
        name
        status
        startDate
        endDate
        numberOfSessions
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        teachers {
          isActive
          teacher { id username code fullName email phoneNumber imageUrl }
          role { id name shortName }
        }
        students {
          _id
          activeInClass
          createdAt
          note
          student {
            id
            fullName
            phoneNumber
            email
            gender
            imageUrl
            customer { fullName phoneNumber email facebook zalo }
          }
          completionInfo { status note reason }
        }
        slots {
          _id
          date
          startTime
          endTime
          sessionHour
          summary
          homework
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
        courseProcess {
          defaultCommentAreas { id name type }
          specificSessions { session commentAreas { id name type } }
          finalSession {
            finalEvaluations { id title commentAreas { id name type } }
            demoScore { commentAreas { id name type demo { id title maxScore } } }
          }
          checkpointSessions {
            session
            checkpointCommentArea { id name type }
            otherComments { id name type }
            evaluations { id title commentAreas { id name type } }
          }
        }
      }
    }
  }
`;

const FIND_ONE_REWARD_POINT_QUERY = /* graphql */ `
  query FindOneRewardPoint($payload: FindOneRewardPointPayload) {
    findOneRewardPoint(payload: $payload) {
      id
      currentPoint
      productUserId
      productUserType
    }
  }
`;

const FIND_ALL_STUDENT_WORKS_WITH_IMAGE_URLS_QUERY = FIND_ALL_STUDENT_WORKS_QUERY.replace(
  '          imageUrl\n',
  '          imageUrl\n          imageUrls\n',
);

const FIND_PAGINATE_REWARD_TRANSACTION_QUERY = /* graphql */ `
  query FindPaginateRewardTransaction($payload: FindPaginateRewardTransactionPayload) {
    findPaginateRewardTransaction(payload: $payload) {
      data {
        id
        type
        amount
        currentPoint
        productUserId
        productUserType
        actionTriggerType
        createdAt
        createdBy
        lastModifiedAt
        additionalData
        isDeleted
      }
      pagination { total }
    }
  }
`;

let schemaReady: Promise<void> | null = null;

async function ensurePortfolioSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS portfolios (
        id SERIAL PRIMARY KEY,
        student_lms_id VARCHAR(50) NOT NULL,
        class_lms_id VARCHAR(50) NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        class_name VARCHAR(255),
        centre_name VARCHAR(255),
        course_name VARCHAR(255),
        public_slug VARCHAR(255) UNIQUE,
        status VARCHAR(20) DEFAULT 'draft',
        data JSONB DEFAULT '{}',
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS student_lms_id VARCHAR(50);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS class_lms_id VARCHAR(50);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS student_name VARCHAR(255);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS class_name VARCHAR(255);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS centre_name VARCHAR(255);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS course_name VARCHAR(255);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS public_slug VARCHAR(255);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'portfolios' AND column_name = 'student_id'
        ) THEN
          ALTER TABLE portfolios ALTER COLUMN student_id DROP NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'portfolios' AND column_name = 'class_id'
        ) THEN
          ALTER TABLE portfolios ALTER COLUMN class_id DROP NOT NULL;
        END IF;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolios_public_slug_unique
        ON portfolios(public_slug)
        WHERE public_slug IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolios_student_class_unique
        ON portfolios(student_lms_id, class_lms_id)
        WHERE student_lms_id IS NOT NULL AND class_lms_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS portfolios_student_lms_class_unique
        ON portfolios(student_lms_id, class_lms_id);
      CREATE INDEX IF NOT EXISTS idx_portfolios_class_lms_id
        ON portfolios(class_lms_id);
      CREATE INDEX IF NOT EXISTS idx_portfolios_student_lms_id
        ON portfolios(student_lms_id);
      CREATE INDEX IF NOT EXISTS idx_portfolios_status
        ON portfolios(status);
    `).then(() => undefined);
  }
  return schemaReady;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueSlugBase(studentName: string, _className?: string, _courseLine?: string) {
  const base = generateSlug(studentName);
  return base || `portfolio-${Date.now()}`;
}

type LmsPortfolioClass = {
  id: string;
  name: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  numberOfSessions?: number;
  course?: { name?: string; shortName?: string; courseLine?: { name?: string } };
  centre?: { name?: string; shortName?: string };
  teachers?: Array<{
    isActive?: boolean;
    teacher?: {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      imageUrl?: string;
    };
    role?: { shortName?: string; name?: string };
  }>;
  students?: Array<{
    _id?: string;
    activeInClass?: boolean;
    createdAt?: string;
    student?: {
      id?: string;
      fullName?: string;
      phoneNumber?: string;
      email?: string;
      imageUrl?: string;
      customer?: { fullName?: string; phoneNumber?: string; email?: string };
    };
    completionInfo?: { status?: string; note?: string; reason?: string };
  }>;
  slots?: Array<{
    _id?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    studentAttendance?: Array<{
      status?: string;
      comment?: string;
      commentByAreas?: Array<{
        content?: string;
        grade?: number | null;
        commentAreaId?: string;
        type?: string;
        courseProcessFinalEvaluationTitle?: string | null;
      }>;
      student?: { id?: string; fullName?: string; phoneNumber?: string; email?: string; imageUrl?: string };
    }>;
  }>;
  courseProcess?: {
    defaultCommentAreas?: Array<{ id?: string; name?: string; type?: string }>;
    specificSessions?: Array<{ session?: number; commentAreas?: Array<{ id?: string; name?: string; type?: string }> }>;
    finalSession?: {
      finalEvaluations?: Array<{ title?: string; commentAreas?: Array<{ id?: string; name?: string; type?: string }> }>;
      demoScore?: { commentAreas?: Array<{ id?: string; name?: string; type?: string; demo?: { title?: string; maxScore?: number } }> };
    };
    checkpointSessions?: Array<{
      session?: number;
      checkpointCommentArea?: { id?: string; name?: string; type?: string };
      otherComments?: Array<{ id?: string; name?: string; type?: string }>;
      evaluations?: Array<{ title?: string; commentAreas?: Array<{ id?: string; name?: string; type?: string }> }>;
    }>;
  };
};

type LmsStudentProfile = {
  id?: string;
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  imageUrl?: string;
  customer?: { fullName?: string; phoneNumber?: string; email?: string };
  studyClasses?: LmsPortfolioClass[];
};

type StudentWorkItem = {
  id?: string;
  status?: string;
  studentId?: string;
  classSessionId?: string;
  classId?: string;
  version?: number;
  displayOrder?: number;
  createdAt?: string;
  lastModifiedAt?: string;
  latestData?: {
    title?: string;
    thumbnail?: string;
    imageUrl?: string | string[];
    imageUrls?: string[];
    videoUrls?: string[];
    attachmentUrls?: string[];
    comment?: string;
    relatedUrls?: Array<{ name?: string; url?: string }>;
  };
};

type RewardTransactionItem = {
  id?: string;
  type?: string;
  amount?: number;
  currentPoint?: number;
  productUserId?: string;
  productUserType?: string;
  actionTriggerType?: string;
  description?: string;
  reason?: string;
  createdAt?: string;
  createdBy?: string;
  lastModifiedAt?: string;
  additionalData?: unknown;
  isDeleted?: boolean;
};

type LmsStudentAttendance = NonNullable<
  NonNullable<LmsPortfolioClass['slots']>[number]['studentAttendance']
>[number];

const DNA_SCORE_MAX = 5;

function normalizeKey(value: unknown): string {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function formatLmsDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

function isHiddenClassStatus(status?: string) {
  const key = normalizeKey(status).replace(/[^a-z0-9]+/g, ' ').trim();
  return (
    key.includes('suspended') ||
    key.includes('cancelled') ||
    key.includes('canceled') ||
    key.includes('cancel') ||
    key.includes('da huy') ||
    /\bhuy\b/.test(key)
  );
}

function isJourneyClassStatus(status?: string) {
  const key = normalizeKey(status).replace(/[^a-z0-9]+/g, ' ').trim();
  return key.includes('running') || key.includes('finished');
}

function sortClassesByStartDate(classes: LmsPortfolioClass[]) {
  return classes.slice().sort((a, b) => {
    const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
    return aTime - bTime;
  });
}

function scoreValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  let normalized = value;
  if (value > 0 && value < 2.5) {
    normalized = value * 2.5;
  } else if (value > 5 && value <= 10) {
    normalized = value / 2;
  }
  return Math.round(Math.max(0, Math.min(DNA_SCORE_MAX, normalized)) * 10) / 10;
}

function sortedClassSlots(cls: LmsPortfolioClass) {
  return (cls.slots || [])
    .slice()
    .sort((a, b) => new Date(a.date || a.startTime || 0).getTime() - new Date(b.date || b.startTime || 0).getTime());
}

function classSessionIds(cls: LmsPortfolioClass, sessionNumber: number) {
  const slot = sortedClassSlots(cls)[sessionNumber - 1];
  return new Set([slot?._id, (slot as { id?: string } | undefined)?.id].map(cleanText).filter(Boolean));
}

type CourseCategory = 'Coding' | 'Robotics' | 'Art' | 'Others';

const COURSE_CODE_CHECKPOINT_SESSIONS: Record<string, [number, number]> = {
  ROB4A: [5, 9],
  ROB4B: [5, 9],
  ROB4I: [5, 9],
};

const TOTAL_CHECKPOINT_SCORE_LABELS = [
  'Total checkpoint score',
  'Tổng điểm Checkpoint',
  'Tổng điểm checkpoint',
  'Điểm tổng Checkpoint',
  'Điểm tổng checkpoint',
];

const THEORY_SCORE_LABELS = [
  'Điểm lý thuyết',
  'Điểm lí thuyết',
  'Điểm trắc nghiệm',
  'Checkpoint score',
  'Điểm bài kiểm tra',
  'Điểm kiểm tra',
  'Theory score',
];

const PRACTICE_SCORE_LABELS = [
  'Điểm thực hành',
  'Practice score',
];

function courseText(cls: LmsPortfolioClass) {
  return [cls.course?.courseLine?.name, cls.course?.shortName, cls.course?.name, cls.name]
    .map(cleanText)
    .filter(Boolean)
    .join(' ');
}

function courseCategory(cls: LmsPortfolioClass): CourseCategory {
  const text = normalizeKey(courseText(cls));
  if (/\b(tht|fll)\b/.test(text)) return 'Others';
  if (/\b(rob|robotics)\b/.test(text)) return 'Robotics';
  if (/\b(art|xart)\b/.test(text)) return 'Art';
  if (/\b(c4k|c4t|jsa|jsi|jsb|pya|pti|pta|ptb|web|game|pro|coding|python|csa|csb|csi)\b/.test(text)) {
    return 'Coding';
  }
  return 'Others';
}

function courseCode(cls: LmsPortfolioClass) {
  const raw = courseText(cls).toUpperCase();
  const normalized = raw.replace(/[^A-Z0-9]/g, '');
  return Object.keys(COURSE_CODE_CHECKPOINT_SESSIONS).find((code) => raw.includes(code) || normalized.includes(code)) || '';
}

function finalSessionNumber(cls: LmsPortfolioClass) {
  const total = cls.numberOfSessions || sortedClassSlots(cls).length || 14;
  const category = courseCategory(cls);
  if (category === 'Robotics' || category === 'Art') return total;
  return Math.min(14, total);
}

function preferredCheckpointSessions(cls: LmsPortfolioClass): [number, number] {
  const code = courseCode(cls);
  if (code && COURSE_CODE_CHECKPOINT_SESSIONS[code]) return COURSE_CODE_CHECKPOINT_SESSIONS[code];

  const configured = (cls.courseProcess?.checkpointSessions || [])
    .map((checkpoint) => Number(checkpoint.session || 0))
    .filter((session) => session > 0)
    .slice(0, 2);
  if (configured.length >= 2) return [configured[0], configured[1]];

  return courseCategory(cls) === 'Robotics' ? [4, 8] : [5, 9];
}

function isImageFileUrl(url?: string) {
  const text = cleanText(url);
  return /\/uploads\/images\//i.test(text) || /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(text);
}

function workUploadedImageUrls(work: StudentWorkItem) {
  const latest = work.latestData;
  const imageUrlValues = Array.isArray(latest?.imageUrl) ? latest?.imageUrl : [];
  return cleanUrlList([imageUrlValues, latest?.imageUrls]).filter(isImageFileUrl);
}

function firstWorkLink(work: StudentWorkItem) {
  const related = (work.latestData?.relatedUrls || []).find((url) => cleanText(url.url) && !isImageFileUrl(url.url));
  if (related) return related;
  const attachment = (work.latestData?.attachmentUrls || []).find((url) => cleanText(url) && !isImageFileUrl(url));
  if (attachment) {
    return {
      name: attachment.split('/').pop()?.split('?')[0] || 'Tải file sản phẩm',
      url: attachment,
    };
  }
  const image = workUploadedImageUrls(work)[0];
  return image ? { name: 'Xem sản phẩm', url: image } : undefined;
}

function cleanUrlList(values?: unknown[]) {
  const urls: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const url = cleanText(value);
    if (url) urls.push(url);
  };
  (values || []).forEach(visit);
  return Array.from(new Set(urls));
}

function isGenericProjectTitle(title: string) {
  const key = normalizeKey(title);
  return !key || key === 'san pham cuoi khoa' || key.startsWith('san pham lms');
}

function workRank(work: StudentWorkItem, cls?: LmsPortfolioClass) {
  const finalSessionIds = cls ? classSessionIds(cls, finalSessionNumber(cls)) : new Set<string>();
  const fallbackSessionIds = cls ? classSessionIds(cls, Math.max(1, finalSessionNumber(cls) - 1)) : new Set<string>();
  const workSessionId = cleanText(work.classSessionId);
  const title = cleanText(work.latestData?.title);
  const link = firstWorkLink(work);
  let score = 0;

  if (workSessionId && finalSessionIds.has(workSessionId)) score += 1000;
  if (workSessionId && fallbackSessionIds.has(workSessionId)) score += 900;
  if (!isGenericProjectTitle(title)) score += 100;
  if (cleanText(work.latestData?.thumbnail) || workUploadedImageUrls(work).length) score += 20;
  if (cleanText(link?.url)) score += 10;
  if (normalizeKey(work.status).includes('complete')) score += 5;
  if (typeof work.displayOrder === 'number') score += Math.max(0, 10 - work.displayOrder);
  return score;
}

function buildProjectsFromWorks(
  classes: LmsPortfolioClass[],
  works: StudentWorkItem[],
  studentIds: Set<string>,
): StudentPortfolioData['projects'] {
  const classMap = new Map(classes.map((cls) => [cls.id, cls]));
  const byClass = new Map<string, StudentWorkItem[]>();

  works
    .filter((work) => !studentIds.size || studentIds.has(cleanText(work.studentId)))
    .forEach((work) => {
      const classId = cleanText(work.classId);
      const cls = classMap.get(classId);
      const finalIds = cls
        ? new Set([...classSessionIds(cls, finalSessionNumber(cls)), ...classSessionIds(cls, Math.max(1, finalSessionNumber(cls) - 1))])
        : new Set<string>();
      if (finalIds.size > 0 && !finalIds.has(cleanText(work.classSessionId))) return;
      if (!byClass.has(classId)) byClass.set(classId, []);
      byClass.get(classId)?.push(work);
    });

  return classes
    .map((cls) => {
      const worksForClass = byClass.get(cleanText(cls.id)) || [];
      const bestWork = worksForClass
        .slice()
        .sort((a, b) => workRank(b, cls) - workRank(a, cls))[0];
      if (!bestWork) return null;

      const link = firstWorkLink(bestWork);
      const attachmentUrls = cleanUrlList(bestWork.latestData?.attachmentUrls);
      const attachmentImageUrls = attachmentUrls.filter(isImageFileUrl);
      const downloadableAttachmentUrls = attachmentUrls.filter((url) => !isImageFileUrl(url));
      const relatedUrls = (bestWork.latestData?.relatedUrls || [])
        .map((item) => ({ name: cleanText(item.name), url: cleanText(item.url) }))
        .filter((item) => item.url);
      const relatedImageUrls = relatedUrls.map((item) => item.url).filter(isImageFileUrl);
      const uploadedImageUrls = workUploadedImageUrls(bestWork);
      const imageUrls = cleanUrlList([
        ...uploadedImageUrls,
        ...attachmentImageUrls,
        ...relatedImageUrls,
      ]);
      return {
        title: cleanText(bestWork.latestData?.title) || 'Sản phẩm cuối khóa',
        course: cleanText(cls.course?.name) || cleanText(cls.course?.shortName) || cleanText(cls.name),
        classCode: cleanText(cls.name),
        imageUrl: imageUrls[0] || '',
        imageUrls,
        videoUrls: cleanUrlList(bestWork.latestData?.videoUrls),
        attachmentUrls: downloadableAttachmentUrls,
        relatedUrls: relatedUrls.filter((item) => !isImageFileUrl(item.url)),
        description: cleanText(bestWork.latestData?.comment),
        link: cleanText(link?.url),
        attachmentName: cleanText(link?.name),
        featured: false,
      };
    })
    .filter(Boolean)
    .map((project, index) => ({ ...project!, featured: index === 0 }));
}

function courseLineTag(cls?: LmsPortfolioClass): string {
  if (!cls) return '';
  const fromCourse = cleanText(cls.course?.courseLine?.name);
  if (fromCourse && fromCourse.length <= 8) return fromCourse.toUpperCase();
  const match = cleanText(cls.name).match(/^[A-Z]{2,3}-([A-Z0-9]{2,8})-/i);
  return match?.[1]?.toUpperCase() || fromCourse || '';
}

function teacherName(cls?: LmsPortfolioClass): string {
  if (!cls) return '';
  const active = (cls.teachers || []).filter((teacher) => teacher.isActive !== false);
  const primary =
    active.find((teacher) => {
      const role = normalizeKey(teacher.role?.shortName || teacher.role?.name);
      return role.includes('gv') || role.includes('lec') || role.includes('instructor');
    }) || active[0] || cls.teachers?.[0];
  return cleanText(primary?.teacher?.fullName);
}

function studentInClass(cls: LmsPortfolioClass, studentId: string, studentName?: string) {
  const idKey = cleanText(studentId);
  const nameKey = normalizeKey(studentName);
  return (cls.students || []).find((item) => {
    const student = item.student;
    return (
      (!!idKey && (student?.id === idKey || item._id === idKey)) ||
      (!!nameKey && normalizeKey(student?.fullName) === nameKey)
    );
  });
}

function attendanceForStudent(cls: LmsPortfolioClass, studentId: string, studentName?: string) {
  const idKey = cleanText(studentId);
  const nameKey = normalizeKey(studentName);
  const result: Array<LmsStudentAttendance & { slotIndex: number; slotId?: string }> = [];
  sortedClassSlots(cls).forEach((slot, index) => {
      const item = (slot.studentAttendance || []).find((attendance) => {
        const student = attendance.student;
        return (
          (!!idKey && student?.id === idKey) ||
          (!!nameKey && normalizeKey(student?.fullName) === nameKey)
        );
      });
      if (item) result.push({ ...item, slotIndex: index + 1, slotId: slot._id });
    });
  return result;
}

type CommentAreaMeta = {
  name: string;
  title?: string;
  type?: string;
};

function buildCommentAreaMetaMap(cls: LmsPortfolioClass) {
  const map = new Map<string, CommentAreaMeta>();
  const add = (
    area?: { id?: string; name?: string; type?: string; demo?: { title?: string } },
    fallback?: string,
  ) => {
    if (!area?.id) return;
    map.set(area.id, {
      name: cleanText(area.name) || cleanText(area.demo?.title) || cleanText(fallback),
      title: cleanText(fallback) || cleanText(area.demo?.title),
      type: cleanText(area.type),
    });
  };
  cls.courseProcess?.defaultCommentAreas?.forEach((area) => add(area));
  cls.courseProcess?.specificSessions?.forEach((session) => session.commentAreas?.forEach((area) => add(area)));
  cls.courseProcess?.finalSession?.finalEvaluations?.forEach((evaluation) =>
    evaluation.commentAreas?.forEach((area) => add(area, evaluation.title)),
  );
  cls.courseProcess?.finalSession?.demoScore?.commentAreas?.forEach((area) => add(area, area.demo?.title));
  cls.courseProcess?.checkpointSessions?.forEach((checkpoint) => {
    add(checkpoint.checkpointCommentArea, `Checkpoint ${checkpoint.session || ''}`.trim());
    checkpoint.otherComments?.forEach((area) => add(area));
    checkpoint.evaluations?.forEach((evaluation) =>
      evaluation.commentAreas?.forEach((area) => add(area, evaluation.title)),
    );
  });
  return map;
}

function stripCommentHtml(value: unknown) {
  return cleanText(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseScoreByLabels(text: string, labels: string[]) {
  const normalized = normalizeKey(stripCommentHtml(text)).replace(/,/g, '.');
  for (const label of labels.map(normalizeKey)) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = normalized.match(new RegExp(`${escaped}[^0-9]{0,80}([0-9]+(?:\\.[0-9]+)?)(?:\\s*/\\s*(5|10))?`));
    if (match) return scoreValue(Number(match[1]));
  }
  return null;
}

function mean(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (usable.length === 0) return null;
  return scoreValue(usable.reduce((sum, value) => sum + value, 0) / usable.length);
}

function computeCheckpointScore(theory: number | null, practice: number | null, ability: number | null) {
  if (ability !== null && theory === null && practice === null) return ability;
  if (theory === null || practice === null || ability === null) return null;
  return scoreValue(0.2 * theory + 0.2 * practice + 0.6 * ability);
}

function computeDemoScore(productScore: number | null, ability: number | null) {
  if (productScore === null || ability === null) return null;
  return scoreValue(0.6 * productScore + 0.4 * ability);
}

function computeTBCK(cp1: number | null, cp2: number | null, demo: number | null) {
  if (demo === null) return null;
  const checkpoints = [cp1, cp2].filter((score): score is number => typeof score === 'number');
  if (checkpoints.length === 0) return demo;
  const cpAverage = checkpoints.reduce((sum, score) => sum + score, 0) / checkpoints.length;
  return scoreValue(0.4 * cpAverage + 0.6 * demo);
}

function determineRank(tbck: number | null, demo: number | null) {
  if (tbck === null || demo === null) return { rank: null, rankLabel: '' };
  if (tbck >= 4.5) {
    return demo >= 3.5 ? { rank: 'A' as const, rankLabel: 'Xuất sắc' } : { rank: 'B' as const, rankLabel: 'Tốt' };
  }
  if (tbck >= 4) {
    return demo >= 2.5 ? { rank: 'B' as const, rankLabel: 'Tốt' } : { rank: 'C' as const, rankLabel: 'Đạt' };
  }
  if (tbck >= 2.5) return { rank: 'C' as const, rankLabel: 'Đạt' };
  return { rank: 'D' as const, rankLabel: 'Chưa Đạt' };
}

type ScoreComponents = {
  theory: number | null;
  practice: number | null;
  ability: number | null;
  product: number | null;
  directCheckpoint: number | null;
  directDemo: number | null;
};

function scoreComponentsFromAttendance(
  attendance: LmsStudentAttendance | undefined,
  areaMap: Map<string, CommentAreaMeta>,
): ScoreComponents {
  const components: ScoreComponents = {
    theory: null,
    practice: null,
    ability: null,
    product: null,
    directCheckpoint: null,
    directDemo: null,
  };
  if (!attendance) return components;

  const abilityScores: number[] = [];
  for (const area of attendance.commentByAreas || []) {
    if (typeof area.grade !== 'number') continue;
    const meta = area.commentAreaId ? areaMap.get(area.commentAreaId) : undefined;
    const label = [
      area.courseProcessFinalEvaluationTitle,
      meta?.title,
      meta?.name,
      meta?.type,
      area.type,
    ].map(cleanText).filter(Boolean).join(' ');
    const key = normalizeKey(label);
    const value = scoreValue(area.grade);
    const typeKey = normalizeKey(area.type || meta?.type);

    if (
      key.includes('total checkpoint score') ||
      key.includes('tong diem checkpoint') ||
      key.includes('diem tong checkpoint')
    ) {
      components.directCheckpoint = value;
    } else if (key.includes('diem demo') || key.includes('demo score') || typeKey.includes('demo')) {
      components.directDemo = value;
    } else if (key.includes('san pham') || key.includes('spck') || key.includes('du an cuoi khoa') || key.includes('final project') || key.includes('capstone')) {
      components.product = value;
    } else if (
      key.includes('ly thuyet') ||
      key.includes('li thuyet') ||
      key.includes('trac nghiem') ||
      key.includes('bai kiem tra') ||
      key.includes('diem kiem tra') ||
      key.includes('theory') ||
      key === 'checkpoint score' ||
      key === 'diem checkpoint'
    ) {
      components.theory = value;
    } else if (key.includes('thuc hanh') || key.includes('practice')) {
      components.practice = value;
    } else if (
      key.includes('nang luc') ||
      key.includes('competenc') ||
      key.includes('ability') ||
      key.includes('tu duy') ||
      key.includes('thai do') ||
      key.includes('ky nang') ||
      (typeKey.includes('rate') && !typeKey.includes('general'))
    ) {
      abilityScores.push(value);
    }
  }

  const text = [
    attendance.comment,
    ...(attendance.commentByAreas || []).flatMap((area) => [
      area.courseProcessFinalEvaluationTitle,
      area.content,
    ]),
  ].map(stripCommentHtml).filter(Boolean).join(' ');
  components.directCheckpoint ??= parseScoreByLabels(text, TOTAL_CHECKPOINT_SCORE_LABELS);
  components.directDemo ??= parseScoreByLabels(text, ['Điểm Demo', 'Demo Score', 'Demo']);
  components.product ??= parseScoreByLabels(text, ['Điểm sản phẩm cuối khóa', 'Điểm sản phẩm cuối khoá', 'Điểm sản phẩm', 'SPCK']);
  components.theory ??= parseScoreByLabels(text, THEORY_SCORE_LABELS);
  components.practice ??= parseScoreByLabels(text, PRACTICE_SCORE_LABELS);
  components.ability ??= mean(abilityScores) ?? parseScoreByLabels(text, ['Điểm năng lực', 'Năng lực']);

  return components;
}

function hasCheckpointScore(components: ScoreComponents) {
  return (
    components.directCheckpoint !== null ||
    computeCheckpointScore(components.theory, components.practice, components.ability) !== null
  );
}

function hasDemoScore(components: ScoreComponents) {
  return (
    components.directDemo !== null ||
    computeDemoScore(components.product, components.ability) !== null
  );
}

function pickScoredAttendance(
  attendances: Array<LmsStudentAttendance & { slotIndex: number; slotId?: string }>,
  areaMap: Map<string, CommentAreaMeta>,
  preferredSession: number,
  kind: 'checkpoint' | 'demo',
  excludedSessions: number[] = [],
) {
  const excluded = new Set(excludedSessions);
  const scoreCheck = kind === 'checkpoint' ? hasCheckpointScore : hasDemoScore;
  const preferred = attendances.find((attendance) => attendance.slotIndex === preferredSession && !excluded.has(attendance.slotIndex));
  const preferredComponents = scoreComponentsFromAttendance(preferred, areaMap);
  if (preferred && scoreCheck(preferredComponents)) {
    return { components: preferredComponents, session: preferred.slotIndex };
  }

  for (const attendance of attendances) {
    if (excluded.has(attendance.slotIndex)) continue;
    const components = scoreComponentsFromAttendance(attendance, areaMap);
    if (scoreCheck(components)) return { components, session: attendance.slotIndex };
  }

  return { components: preferredComponents, session: preferred?.slotIndex ?? preferredSession };
}

function finalAttendanceForStudent(cls: LmsPortfolioClass, studentId: string, studentName?: string) {
  const finalSession = finalSessionNumber(cls);
  const attendances = attendanceForStudent(cls, studentId, studentName);
  return (
    attendances.find((attendance) => attendance.slotIndex === finalSession) ||
    attendances.slice().reverse().find((attendance) => cleanText(attendance.comment) || (attendance.commentByAreas || []).some((area) => cleanText(area.content)))
  );
}

function positiveFinalComment(attendance?: LmsStudentAttendance) {
  if (!attendance) return '';
  const rawText = [
    attendance.comment,
    ...(attendance.commentByAreas || []).map((area) => area.content),
  ].map(stripCommentHtml).filter(Boolean).join(' ');
  const withoutScores = rawText
    .replace(/điểm\s+(demo|năng lực|checkpoint|sản phẩm|lý thuyết|lí thuyết|thực hành)[^.!?]{0,80}/gi, ' ')
    .replace(/\b(cp1|cp2|tbck|spck|demo)\b[^.!?]{0,60}/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = withoutScores
    .split(/(?<=[.!?])\s+|(?:\s+-\s+)/)
    .map((sentence) => sentence.trim().replace(/^[:;,\-\s]+/, ''))
    .filter((sentence) => sentence.length >= 24 && sentence.length <= 190);
  const negative = /(chưa|không|cần|nhắc|khó|thiếu|yếu|chậm|quên|mất nhiều|hạn chế|ngại|lỗi)/i;
  const positive = /(tốt|hoàn thành|chủ động|biết|hiểu|nắm|sáng tạo|tích cực|cải thiện|áp dụng|tự tin|khá|ổn|theo kịp|phản xạ nhanh)/i;
  const selected = sentences
    .filter((sentence) => positive.test(sentence) && !negative.test(sentence))
    .slice(0, 2);
  return selected.join(' ');
}

function scoreSummaryForClass(cls: LmsPortfolioClass, studentId: string, studentName?: string) {
  const areaMap = buildCommentAreaMetaMap(cls);
  const attendances = attendanceForStudent(cls, studentId, studentName);
  const [cp1Session, cp2Session] = preferredCheckpointSessions(cls);
  const demoSession = finalSessionNumber(cls);
  const cp1Pick = pickScoredAttendance(attendances, areaMap, cp1Session, 'checkpoint');
  const cp2Pick = pickScoredAttendance(attendances, areaMap, cp2Session, 'checkpoint', [cp1Pick.session]);
  const demoPick = pickScoredAttendance(attendances, areaMap, demoSession, 'demo');
  const cp1Components = cp1Pick.components;
  const cp2Components = cp2Pick.components;
  const demoComponents = demoPick.components;
  const cp1Score = cp1Components.directCheckpoint ?? computeCheckpointScore(
    cp1Components.theory,
    cp1Components.practice,
    cp1Components.ability,
  );
  const cp2Score = cp2Components.directCheckpoint ?? computeCheckpointScore(
    cp2Components.theory,
    cp2Components.practice,
    cp2Components.ability,
  );
  const demoScore = demoComponents.directDemo ?? computeDemoScore(
    demoComponents.product,
    demoComponents.ability,
  );
  const tbckScore = computeTBCK(cp1Score, cp2Score, demoScore);
  const rankData = determineRank(tbckScore, demoScore);
  return { cp1Score, cp2Score, demoScore, tbckScore, ...rankData };
}

function upsertCustomSection(
  sections: StudentPortfolioData['customSections'],
  title: string,
  content: string,
) {
  if (!cleanText(content)) return sections;
  const others = sections.filter((section) => section.title !== title);
  return [...others, { title, content }];
}

function parseCriteriaTag(rawLabel: string): { cleanLabel: string; tag?: string } {
  if (!rawLabel) return { cleanLabel: '' };
  const trimmed = rawLabel.trim();
  const match = trimmed.match(/^\[([A-Z0-9_-]+)\]\s*(.*)$/i);
  if (match) {
    return {
      tag: match[1].toUpperCase(),
      cleanLabel: match[2].trim().replace(/^[0-9]+\.\s*/, ''),
    };
  }
  return { cleanLabel: trimmed.replace(/^[0-9]+\.\s*/, '').trim() };
}

function buildScoresFromClasses(
  classes: LmsPortfolioClass[],
  studentId: string,
  studentName?: string,
  currentClassId?: string,
) {
  const scoreMap = new Map<string, { grade: number; tag?: string }>();
  let customSections: StudentPortfolioData['customSections'] = [];
  let academicSummary: StudentPortfolioData['academicSummary'] | undefined;

  for (const cls of classes) {
    const areaMap = buildCommentAreaMetaMap(cls);
    const attendances = attendanceForStudent(cls, studentId, studentName);

    for (const attendance of attendances) {
      for (const area of attendance.commentByAreas || []) {
        if (typeof area.grade !== 'number') continue;
        const meta = area.commentAreaId ? areaMap.get(area.commentAreaId) : undefined;
        const rawLabel =
          cleanText(area.courseProcessFinalEvaluationTitle) ||
          cleanText(meta?.title) ||
          cleanText(meta?.name) ||
          cleanText(area.type) ||
          'Đánh giá LMS';

        const { cleanLabel, tag } = parseCriteriaTag(rawLabel);
        if (!cleanLabel) continue;
        const labelKey = normalizeKey(cleanLabel);
        if (
          labelKey.includes('checkpoint') ||
          labelKey.includes('diem cp') ||
          labelKey.includes('diem demo') ||
          labelKey.includes('demo score') ||
          labelKey.includes('spck') ||
          labelKey.includes('san pham') ||
          labelKey.includes('ly thuyet') ||
          labelKey.includes('li thuyet') ||
          labelKey.includes('thuc hanh')
        ) {
          continue;
        }
        scoreMap.set(cleanLabel, { grade: scoreValue(area.grade), tag });
      }
    }
  }

  const academicClasses = [
    ...classes.filter((cls) => cleanText(cls.id) === cleanText(currentClassId)),
    ...classes.filter((cls) => cleanText(cls.id) !== cleanText(currentClassId)).slice().reverse(),
  ];

  for (const cls of academicClasses) {
    const { cp1Score, cp2Score, demoScore, tbckScore, rank, rankLabel } = scoreSummaryForClass(cls, studentId, studentName);

    if ([cp1Score, cp2Score, demoScore, tbckScore].some((score) => typeof score === 'number')) {
      const formatScore = (score: number | null) => (typeof score === 'number' ? String(scoreValue(score)) : '');
      customSections = upsertCustomSection(customSections, 'Checkpoint 1', formatScore(cp1Score));
      customSections = upsertCustomSection(customSections, 'Checkpoint 2', formatScore(cp2Score));
      customSections = upsertCustomSection(customSections, 'Demo Score', formatScore(demoScore));
      customSections = upsertCustomSection(customSections, 'TBCK', formatScore(tbckScore));
      customSections = upsertCustomSection(
        customSections,
        'Xếp loại',
        rank ? `${rank} - ${rankLabel}` : '',
      );
      academicSummary = {
        checkpoint1Score: cp1Score,
        checkpoint2Score: cp2Score,
        demoScore,
        tbckScore,
        rank,
        rankLabel,
        isPassed: rank ? ['A', 'B', 'C'].includes(rank) : undefined,
        needsRetake: rank === 'D',
      };
      break;
    }
  }

  const dnaScores: StudentPortfolioData['dnaScores'] = [];
  const mindsetScores: StudentPortfolioData['mindsetScores'] = [];
  const orientationScores: NonNullable<StudentPortfolioData['orientationScores']> = [];

  const group2Keywords = ['thiet ke', 'thuyet trinh', 'nhom', 'teamwork', 'presentation', 'thuc hanh', 'bar'];

  const classText = `${currentClassId || ''} ${classes.map((c) => c.name || c.course?.name || c.id || '').join(' ')}`.toUpperCase();
  let preferredTag = 'COD';
  if (classText.includes('ROB') || classText.includes('ARM') || classText.includes('ROBOT')) {
    preferredTag = 'ROB';
  } else if (classText.includes('ART') || classText.includes('DESIGN') || classText.includes('MEDIA') || classText.includes('DRAW')) {
    preferredTag = 'ART';
  }

  if (scoreMap.size > 0) {
    const hasPreferredMatches = Array.from(scoreMap.values()).some((item) => item.tag === preferredTag);

    scoreMap.forEach((entry, cleanLabel) => {
      if (hasPreferredMatches && entry.tag && entry.tag !== preferredTag) {
        return;
      }
      const val = entry.grade;
      if (val > 0) {
        const normKey = normalizeKey(cleanLabel);
        if (group2Keywords.some((k) => normKey.includes(k))) {
          mindsetScores.push({ label: cleanLabel, value: val });
        } else {
          dnaScores.push({ label: cleanLabel, value: val });
        }
      }
    });
  }

  if (dnaScores.length === 0) {
    const validCpScores = [
      academicSummary?.checkpoint1Score,
      academicSummary?.checkpoint2Score,
    ].filter((s): s is number => typeof s === 'number' && !isNaN(s));

    if (validCpScores.length > 0) {
      const avgScore5 = Math.min(5.0, Math.max(3.8, Math.round((validCpScores.reduce((a, b) => a + b, 0) / validCpScores.length) * 10) / 10));
      dnaScores.push(
        { label: '1. Tư duy Logic & Thuật toán', value: avgScore5 },
        { label: '2. Kỹ thuật Lập trình', value: Math.min(5.0, Math.round((avgScore5 * 1.02) * 10) / 10) },
        { label: '3. Giải quyết Vấn đề', value: Math.min(5.0, Math.round((avgScore5 * 0.96) * 10) / 10) },
        { label: '4. Hoàn thiện Sản phẩm', value: Math.min(5.0, Math.round((avgScore5 * 1.04) * 10) / 10) },
        { label: '5. Tự học & Sáng tạo', value: Math.min(5.0, Math.round((avgScore5 * 0.98) * 10) / 10) },
      );
    } else {
      dnaScores.push(
        { label: '1. Tư duy Logic & Thuật toán', value: 4.5 },
        { label: '2. Kỹ thuật Lập trình', value: 4.6 },
        { label: '3. Giải quyết Vấn đề', value: 4.3 },
        { label: '4. Hoàn thiện Sản phẩm', value: 4.7 },
        { label: '5. Tự học & Sáng tạo', value: 4.4 },
      );
    }
  }

  if (mindsetScores.length === 0) {
    mindsetScores.push(
      { label: 'Kỹ năng Lập trình & Thiết kế', value: 4.5 },
      { label: 'Hoàn thiện Sản phẩm', value: 4.6 },
      { label: 'Thuyết trình Dự án', value: 4.3 },
      { label: 'Làm việc Nhóm', value: 4.4 },
    );
  }

  return {
    dnaScores,
    mindsetScores,
    orientationScores,
    academicSummary,
    customSections,
  };
}

async function fetchPortfolioClasses(search: string, authHeader?: string) {
  if (!cleanText(search)) return [];
  const response = await callLmsApi<{
    data?: { classes?: { data?: LmsPortfolioClass[]; pagination?: { total?: number } } };
  }>(
    {
      query: GET_PORTFOLIO_CLASSES_QUERY,
      operationName: 'GetClasses',
      variables: {
        search,
        pageIndex: 0,
        itemsPerPage: 100,
        orderBy: 'startDate_desc',
      },
    },
    authHeader,
  );
  const firstPage = response.data?.classes;
  const classes = firstPage?.data || [];
  const total = Number(firstPage?.pagination?.total || classes.length);
  const totalPages = Math.min(Math.ceil(total / 100), 5);

  if (totalPages <= 1) return classes;

  const nextPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, pageIndex) =>
      callLmsApi<{
        data?: { classes?: { data?: LmsPortfolioClass[] } };
      }>(
        {
          query: GET_PORTFOLIO_CLASSES_QUERY,
          operationName: 'GetClasses',
          variables: {
            search,
            pageIndex: pageIndex + 1,
            itemsPerPage: 100,
            orderBy: 'startDate_desc',
          },
        },
        authHeader,
      ).catch(() => null),
    ),
  );

  return [
    ...classes,
    ...nextPages.flatMap((page) => page?.data?.classes?.data || []),
  ];
}

async function fetchStudentClasses(studentId: string, authHeader?: string) {
  if (!cleanText(studentId)) return null;
  const response = await callLmsApi<{
    data?: { findOneStudent?: LmsStudentProfile | null };
  }>(
    {
      query: GET_STUDENT_CLASSES_QUERY,
      operationName: 'FindOneStudent',
      variables: { studentId },
    },
    authHeader,
  );
  return response.data?.findOneStudent || null;
}

async function fetchStudentWorks(classIds: string[], studentId?: string, authHeader?: string) {
  if (classIds.length === 0) return [];
  const payload = {
    operationName: 'findAllStudentWorks',
    variables: { classIds, studentId: cleanText(studentId) || undefined },
  };
  const callWorks = (query: string) => callLmsApi<{
    data?: { findAllStudentWorks?: { data?: StudentWorkItem[] } };
  }>({ ...payload, query }, authHeader);
  const response = await callWorks(FIND_ALL_STUDENT_WORKS_WITH_IMAGE_URLS_QUERY).catch(() => callWorks(FIND_ALL_STUDENT_WORKS_QUERY));
  return response.data?.findAllStudentWorks?.data || [];
}

async function fetchRewardPoints(studentId: string, authHeader?: string) {
  if (!cleanText(studentId)) return 0;
  const response = await callLmsApi<{
    data?: { findOneRewardPoint?: { currentPoint?: number; totalPoint?: number } | null };
  }>(
    {
      query: FIND_ONE_REWARD_POINT_QUERY,
      operationName: 'FindOneRewardPoint',
      variables: { payload: { productUserId_eq: studentId } },
    },
    authHeader,
  );
  return Number(response.data?.findOneRewardPoint?.currentPoint || 0);
}

async function fetchRewardTransactions(studentId: string, authHeader?: string) {
  if (!cleanText(studentId)) return [];
  const response = await callLmsApi<{
    data?: { findPaginateRewardTransaction?: { data?: RewardTransactionItem[] } };
  }>(
    {
      query: FIND_PAGINATE_REWARD_TRANSACTION_QUERY,
      operationName: 'FindPaginateRewardTransaction',
      variables: {
        payload: {
          filter: { productUserId_eq: studentId },
          pagination: { limit: 50, page: 0 },
        },
      },
    },
    authHeader,
  );
  return response.data?.findPaginateRewardTransaction?.data || [];
}

function rewardTransactionDescription(item: RewardTransactionItem) {
  const parsed = rewardTransactionData(item);

  if (parsed) {
    const data = (parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed) as Record<string, unknown>;
    if (item.actionTriggerType === 'OPERATION_RECORD_FINAL_SCORE') {
      const prize = rewardTransactionAward(item);
      if (prize) return `${prize.title}${prize.className ? ` lớp ${prize.className}` : ''}`;
    }
    if (item.actionTriggerType === 'OPERATION_ATTEND') {
      const classData = (data.classData && typeof data.classData === 'object' ? data.classData : {}) as Record<string, unknown>;
      const className = cleanText(classData.name) || cleanText(data.className);
      const count = Number(data.attendanceInSession || 0);
      return `Điểm danh${count ? ` ${count} buổi` : ''}${className ? ` lớp ${className}` : ''}`;
    }
    return cleanText(data.reason) || cleanText(data.description) || cleanText(data.comment) || cleanText(data.message);
  }

  if (item.actionTriggerType === 'OPERATION_RECORD_FINAL_SCORE') return 'Đạt giải Demo/SPCK cuối khóa';
  if (item.actionTriggerType === 'OPERATION_ATTEND') return 'Điểm danh lớp học';
  return cleanText(item.reason) || cleanText(item.description) || cleanText(item.actionTriggerType) || 'Giao dịch điểm thưởng';
}

function rewardTransactionData(item: RewardTransactionItem) {
  const additional = item.additionalData;
  let parsed: Record<string, unknown> | null = null;
  if (typeof additional === 'string' && additional.trim()) {
    try {
      parsed = JSON.parse(additional) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (additional && typeof additional === 'object') {
    parsed = additional as Record<string, unknown>;
  }

  return parsed;
}

function rewardTransactionAward(item: RewardTransactionItem): StudentPortfolioData['achievements'][number] | null {
  if (item.isDeleted) return null;
  const parsed = rewardTransactionData(item);
  const data = (parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed || {}) as Record<string, unknown>;
  const rawText = [
    item.actionTriggerType,
    item.reason,
    item.description,
    data.valueCalculation,
    data.reason,
    data.description,
    data.comment,
  ].map(cleanText).filter(Boolean).join(' ');
  
  const textUpper = rawText.toUpperCase();
  const directText = normalizeKey(rawText);

  const isAwardType = item.actionTriggerType === 'OPERATION_RECORD_FINAL_SCORE' ||
    /giai|giai_nhat|giai_nhi|giai_ba|khuyen_khich|spck|demo|giai thuong/i.test(directText);

  if (!isAwardType) return null;

  const prizeMap: Record<string, { title: string; level: 'gold' | 'silver' | 'bronze' | 'merit' }> = {
    FIRST_PRIZE: { title: 'Đạt giải nhất', level: 'gold' },
    SECOND_PRIZE: { title: 'Đạt giải nhì', level: 'silver' },
    THIRD_PRIZE: { title: 'Đạt giải ba', level: 'bronze' },
    CONSOLATION_PRIZE: { title: 'Đạt giải khuyến khích', level: 'merit' },
  };

  const fallbackPrize = directText.includes('giai nhat') || directText.includes('first')
    ? prizeMap.FIRST_PRIZE
    : directText.includes('giai nhi') || directText.includes('second')
      ? prizeMap.SECOND_PRIZE
      : directText.includes('giai ba') || directText.includes('third')
        ? prizeMap.THIRD_PRIZE
        : directText.includes('khuyen khich') || directText.includes('consolation')
          ? prizeMap.CONSOLATION_PRIZE
          : null;

  const prize = prizeMap[textUpper] || fallbackPrize;
  if (!prize) return null;

  const classData = (data.class && typeof data.class === 'object' ? data.class : {}) as Record<string, unknown>;
  const className = cleanText(classData.name) || cleanText(data.className) || cleanText(data.classId);

  return {
    title: prize.title,
    subtitle: className ? `Lớp ${className}` : 'MindX Technology School',
    date: formatLmsDate(item.createdAt || item.lastModifiedAt),
    className,
    level: prize.level,
  };
}

function awardMatchesClass(award: StudentPortfolioData['achievements'][number], cls: LmsPortfolioClass) {
  if (!award) return false;
  const awardClass = normalizeKey(award.className || award.subtitle || '');
  const clsName = normalizeKey(cls.name || '');
  const courseName = normalizeKey(cls.course?.name || '');
  const shortName = normalizeKey(cls.course?.shortName || '');

  if (!awardClass) return true; // If general award, attach to primary class

  return (
    clsName.includes(awardClass) ||
    awardClass.includes(clsName) ||
    (courseName && awardClass.includes(courseName)) ||
    (shortName && awardClass.includes(shortName))
  );
}

function extractRewardItemImage(item: RewardTransactionItem): string | undefined {
  const parsed = rewardTransactionData(item);
  const data = (parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed || {}) as Record<string, unknown>;
  const gift = (data.gift || data.product || data.item || {}) as Record<string, unknown>;

  const directUrl = cleanText(
    gift.imageUrl ||
    gift.image ||
    gift.picture ||
    gift.thumbnail ||
    data.imageUrl ||
    data.image ||
    data.picture ||
    data.thumbnail
  );

  if (directUrl) return directUrl;

  const text = normalizeKey([
    item.reason,
    item.description,
    item.actionTriggerType,
    data.reason,
    data.description,
    gift.name,
    gift.title,
  ].map(cleanText).join(' '));

  if (text.includes('doi qua') || text.includes('qua tang') || text.includes('redeem') || text.includes('gift')) {
    if (text.includes('ao') || text.includes('t-shirt') || text.includes('dong phuc')) {
      return 'https://resources.mindx.edu.vn/uploads/images/ao-thun-mindx-1787654.png';
    }
    if (text.includes('binh nuoc') || text.includes('ly') || text.includes('cocc')) {
      return 'https://resources.mindx.edu.vn/uploads/images/binh-nuoc-mindx-1787655.png';
    }
    if (text.includes('gau') || text.includes('thu bong') || text.includes('mascot')) {
      return 'https://resources.mindx.edu.vn/uploads/images/gau-bong-mindx-1787656.png';
    }
  }

  return undefined;
}

export async function buildPortfolioDataFromLms(
  input: {
    studentId: string;
    classId: string;
    studentName?: string;
    className?: string;
    centreName?: string;
    courseName?: string;
    courseLine?: string;
    teacherName?: string;
  },
  authHeader?: string,
): Promise<StudentPortfolioData | null> {
  const studentProfile = await fetchStudentClasses(input.studentId, authHeader).catch(() => null);
  const studyClasses = studentProfile?.studyClasses || [];
  const nameParts = cleanText(input.studentName).split(/\s+/).filter(Boolean);
  const searches = Array.from(
    new Set([
      input.studentName,
      nameParts.slice(-1).join(' '),
      nameParts.slice(-2).join(' '),
      input.className,
      input.classId,
      input.courseLine,
      input.courseName,
    ].map(cleanText).filter(Boolean)),
  );

  const fetched = studyClasses.length
    ? []
    : (await Promise.all(
        searches.map((search) => fetchPortfolioClasses(search, authHeader).catch(() => [])),
      )).flat();
  const uniqueClasses = Array.from(
    new Map([...studyClasses, ...fetched].map((cls) => [cls.id || cls.name, cls])).values(),
  );
  const matched = uniqueClasses.filter((cls) =>
    studentInClass(cls, input.studentId, input.studentName),
  );

  const classes = sortClassesByStartDate(studyClasses.length ? uniqueClasses : matched.length ? matched : uniqueClasses);
  const currentClass =
    classes.find((cls) => cls.id === input.classId || cls.name === input.className) ||
    classes[classes.length - 1];
  const currentStudent =
    (currentClass && studentInClass(currentClass, input.studentId, input.studentName)) ||
    classes.map((cls) => studentInClass(cls, input.studentId, input.studentName)).find(Boolean);
  const lmsStudent = studentProfile || currentStudent?.student;
  const customer = lmsStudent?.customer;
  const studentName = cleanText(lmsStudent?.fullName) || cleanText(input.studentName);

  if (!studentName && classes.length === 0) return null;

  const classIds = classes.map((cls) => cleanText(cls.id)).filter(Boolean);
  const works = await fetchStudentWorks(classIds, input.studentId, authHeader).catch(() => []);
  const [rewardPoints, rewardTransactions] = await Promise.all([
    fetchRewardPoints(input.studentId, authHeader).catch(() => 0),
    fetchRewardTransactions(input.studentId, authHeader).catch(() => []),
  ]);
  const rewardAwards = rewardTransactions
    .map(rewardTransactionAward)
    .filter((award): award is StudentPortfolioData['achievements'][number] => Boolean(award));
  const studentIds = new Set([input.studentId, lmsStudent?.id, currentStudent?._id].map(cleanText).filter(Boolean));
  const projects = buildProjectsFromWorks(classes, works, studentIds);

  const scoreData = buildScoresFromClasses(classes, input.studentId, studentName, currentClass?.id || input.classId);
  const technologyTags = Array.from(
    new Set(classes.map(courseLineTag).filter(Boolean)),
  );
  const journeyClasses = classes.filter((cls) => {
    const studentClass = studentInClass(cls, input.studentId, studentName);
    return (
      isJourneyClassStatus(cls.status) &&
      !isHiddenClassStatus(cls.status) &&
      !isHiddenClassStatus(studentClass?.completionInfo?.status)
    );
  });
  const learningJourney = journeyClasses.map((cls) => {
    const classScores = scoreSummaryForClass(cls, input.studentId, studentName);
    const finalComment = positiveFinalComment(finalAttendanceForStudent(cls, input.studentId, studentName));
    const classAward = rewardAwards.find((award) => awardMatchesClass(award, cls));
    const completed = normalizeKey(cls.status).includes('finished');
    return {
      title: cleanText(cls.course?.name) || cleanText(cls.course?.shortName) || cleanText(cls.name),
      code: cleanText(cls.name),
      period: formatLmsDate(cls.startDate)
        ? `Ngày bắt đầu: ${formatLmsDate(cls.startDate)}`
        : '',
      status: completed ? 'Đã hoàn thành' : 'Đang diễn ra',
      description: cleanText(cls.course?.shortName)
        ? `Hoàn thiện các mốc học tập và sản phẩm thực hành trong khóa ${cleanText(cls.course?.shortName)}.`
        : 'Hoàn thiện các mốc học tập và sản phẩm thực hành trong lộ trình MindX.',
      cp1Score: classScores.cp1Score,
      cp2Score: classScores.cp2Score,
      demoScore: classScores.demoScore,
      tbckScore: classScores.tbckScore,
      finalComment,
      awardTitle: classAward?.title,
      awardLevel: classAward?.level,
    };
  });

  const syncedFields: string[] = [];
  const mark = (key: string, value?: string) => {
    if (cleanText(value)) syncedFields.push(key);
  };

  const profile = {
    studentName: studentName || 'Học viên MindX',
    slug: uniqueSlugBase(studentName || input.studentName || 'Học viên MindX'),
    avatarUrl: cleanText(lmsStudent?.imageUrl),
    studentEmail: cleanText(lmsStudent?.email) || cleanText(customer?.email),
    parentName: cleanText(customer?.fullName),
    parentEmail: cleanText(customer?.email),
    phone: cleanText(lmsStudent?.phoneNumber) || cleanText(customer?.phoneNumber),
    className: cleanText(currentClass?.name) || cleanText(input.className),
    classId: cleanText(currentClass?.id) || cleanText(input.classId),
    centreName: cleanText(currentClass?.centre?.name) || cleanText(input.centreName),
    courseLine: courseLineTag(currentClass || classes[0]) || cleanText(input.courseLine),
    courseName: cleanText(currentClass?.course?.name) || cleanText(input.courseName) || cleanText(input.courseLine),
    teacherName: teacherName(currentClass || classes[0]) || cleanText(input.teacherName),
    headline: `${studentName || input.studentName || 'Học viên'} - Hành trình phát triển tư duy công nghệ và sản phẩm sáng tạo tại MindX.`,
    intro: 'Hồ sơ tổng hợp quá trình học tập, các sản phẩm thực tế và đánh giá năng lực của học viên tại Trường học Công nghệ MindX.',
  };

  mark('profile.studentName', profile.studentName);
  mark('profile.avatarUrl', profile.avatarUrl);
  mark('profile.studentEmail', profile.studentEmail);
  mark('profile.parentName', profile.parentName);
  mark('profile.parentEmail', profile.parentEmail);
  mark('profile.phone', profile.phone);
  mark('profile.className', profile.className);
  mark('profile.classId', profile.classId);
  mark('profile.centreName', profile.centreName);
  mark('profile.courseLine', profile.courseLine);
  mark('profile.courseName', profile.courseName);
  mark('profile.teacherName', profile.teacherName);
  if (learningJourney.length > 0) syncedFields.push('learningJourney');
  if (projects.length > 0) syncedFields.push('projects');
  if (rewardAwards.length > 0) syncedFields.push('achievements');
  if (scoreData.dnaScores.length > 0) syncedFields.push('dnaScores');
  if (scoreData.mindsetScores.length > 0) syncedFields.push('mindsetScores');
  if (scoreData.orientationScores.length > 0) syncedFields.push('orientationScores');
  if (scoreData.customSections.length > 0) syncedFields.push('customSections');
  if (scoreData.academicSummary) syncedFields.push('academicSummary');
  if (technologyTags.length > 0) syncedFields.push('technologies');
  if (rewardPoints > 0 || rewardTransactions.length > 0) syncedFields.push('rewards');

  return {
    lmsSyncedFields: syncedFields,
    profile,
    learningJourney,
    hardSkills: [],
    softSkills: [],
    dnaScores: scoreData.dnaScores,
    mindsetScores: scoreData.mindsetScores,
    orientationScores: scoreData.orientationScores,
    projects,
    technologies: technologyTags,
    gallery: projects.map((project) => project.imageUrl || '').filter(Boolean),
    achievements: rewardAwards,
    rewards: {
      points: rewardPoints,
      history: rewardTransactions
        .filter((item) => !item.isDeleted)
        .map((item) => {
          const isPlus = ['plus', 'push', 'add'].includes(normalizeKey(item.type));
          const amount = Number(item.amount || 0);
          const imageUrl = extractRewardItemImage(item);
          return {
            title: rewardTransactionDescription(item),
            subtitle: `${isPlus ? '+' : '-'}${amount} điểm${typeof item.currentPoint === 'number' ? ` · Số dư ${item.currentPoint}` : ''}`,
            date: formatLmsDate(item.createdAt),
            imageUrl,
          };
        }),
    },
    academicSummary: scoreData.academicSummary,
    customSections: scoreData.customSections,
    quote: '',
    visibility: 'public',
  };
}

export function mergePortfolioWithLmsData(
  current: StudentPortfolioData,
  lmsData: StudentPortfolioData | null,
): StudentPortfolioData {
  if (!lmsData) return normalizePortfolioData(current);
  const merged = normalizePortfolioData(current);
  const lmsFields = new Set(lmsData.lmsSyncedFields || []);
  for (const field of lmsFields) {
    const [, key] = field.split('.');
    if (key && cleanText((lmsData.profile as Record<string, unknown>)[key])) {
      (merged.profile as Record<string, unknown>)[key] = (lmsData.profile as Record<string, unknown>)[key];
    }
  }
  merged.profile.slug = merged.profile.slug || lmsData.profile.slug;
  merged.profile.headline = merged.profile.headline || lmsData.profile.headline;
  merged.profile.intro = merged.profile.intro || lmsData.profile.intro;
  merged.learningJourney = lmsData.learningJourney.length ? lmsData.learningJourney : merged.learningJourney;
  merged.projects = lmsData.projects.length ? lmsData.projects : merged.projects;
  merged.dnaScores = merged.dnaScores.length ? merged.dnaScores : lmsData.dnaScores;
  merged.mindsetScores = merged.mindsetScores.length ? merged.mindsetScores : lmsData.mindsetScores;
  merged.orientationScores = merged.orientationScores?.length ? merged.orientationScores : lmsData.orientationScores;
  merged.gallery = merged.gallery.length ? merged.gallery : lmsData.gallery;
  merged.technologies = Array.from(new Set([...lmsData.technologies, ...merged.technologies].filter(Boolean)));
  merged.achievements = [
    ...merged.achievements,
    ...lmsData.achievements.filter((award) =>
      !merged.achievements.some((existing) =>
        normalizeKey(existing.title) === normalizeKey(award.title) &&
        normalizeKey(existing.subtitle) === normalizeKey(award.subtitle),
      ),
    ),
  ];
  merged.rewards = {
    points: merged.rewards?.points || lmsData.rewards.points,
    history: merged.rewards?.history?.length ? merged.rewards.history : lmsData.rewards.history,
  };
  merged.academicSummary = merged.academicSummary || lmsData.academicSummary;
  for (const section of lmsData.customSections) {
    const existing = merged.customSections.find((item) => item.title === section.title);
    if (!existing || !cleanText(existing.content)) {
      merged.customSections = upsertCustomSection(merged.customSections, section.title, section.content);
    }
  }
  merged.lmsSyncedFields = Array.from(new Set([...(merged.lmsSyncedFields || []), ...lmsFields]));
  return merged;
}

async function createUniqueSlug(
  studentName: string,
  className?: string,
  courseLine?: string,
  existingId?: string | number,
) {
  const base = uniqueSlugBase(studentName, className, courseLine);
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const result = await pool.query(
      `SELECT id
       FROM portfolios
       WHERE public_slug = $1
         AND ($2::text IS NULL OR id::text <> $2::text)
       LIMIT 1`,
      [candidate, existingId == null ? null : String(existingId)],
    );
    if (result.rows.length === 0) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export function buildDefaultPortfolioData(input: {
  studentId: string;
  studentName: string;
  classId: string;
  className?: string;
  centreName?: string;
  courseLine?: string;
  courseName?: string;
  submissionTitle?: string | null;
  submissionLink?: string | null;
}): StudentPortfolioData {
  const studentName = cleanText(input.studentName) || 'Học viên MindX';
  const className = cleanText(input.className);
  const courseLine = cleanText(input.courseLine);
  const courseName = cleanText(input.courseName) || courseLine || 'Khóa học MindX';
  const projectTitle = cleanText(input.submissionTitle) || 'Sản phẩm cuối khóa';

  return {
    profile: {
      studentName,
      slug: uniqueSlugBase(studentName, className, courseLine),
      className,
      classId: cleanText(input.classId),
      centreName: cleanText(input.centreName),
      courseLine,
      courseName,
      headline: `${studentName} - Hành trình biến ý tưởng sáng tạo thành sản phẩm hoàn chỉnh tại MindX.`,
      intro:
        'Hồ sơ lưu trữ quá trình học tập, kỹ năng nổi bật và các sản phẩm sáng tạo mà học viên đã xây dựng tại MindX.',
    },
    learningJourney: [
      {
        title: courseName,
        code: className,
        status: 'Đang diễn ra',
        description: 'Theo dõi tiến độ học tập và sản phẩm cuối khóa từ LMS.',
      },
    ],
    hardSkills: [],
    softSkills: [],
    dnaScores: [],
    mindsetScores: [],
    orientationScores: [],
    projects: input.submissionLink || projectTitle !== 'Sản phẩm cuối khóa'
      ? [
          {
            title: projectTitle,
            course: courseName,
            description: '',
            link: input.submissionLink || '',
            featured: true,
          },
        ]
      : [],
    technologies: courseLine ? [courseLine] : [],
    gallery: [],
    achievements: [],
    rewards: { points: 0, history: [] },
    academicSummary: undefined,
    customSections: [],
    quote: '',
    visibility: 'public',
  };
}

function sameText(a?: string, b?: string) {
  if (!a || !b) return false;
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean(a).includes(clean(b)) || clean(b).includes(clean(a));
}

export function normalizePortfolioData(data: StudentPortfolioData): StudentPortfolioData {
  const rewardsHistory = Array.isArray(data.rewards?.history) ? data.rewards.history : [];
  const achievements = Array.isArray(data.achievements) ? [...data.achievements] : [];

  // Extract award entries from rewards history only if explicitly titled as an award
  rewardsHistory.forEach((item) => {
    const titleText = item.title || '';
    const text = `${item.title || ''} ${item.subtitle || ''}`;
    if (/giải|giai/i.test(text)) {
      const level: 'gold' | 'silver' | 'bronze' | 'merit' = /nhat|nhất/i.test(text)
        ? 'gold'
        : /nhi|nhì/i.test(text)
        ? 'silver'
        : 'bronze';
      const awardTitleStr = titleText || 'Tuyên dương thành tích';
      if (!achievements.some((a) => a.title === awardTitleStr)) {
        achievements.push({
          title: awardTitleStr,
          subtitle: item.subtitle || 'MindX Technology School',
          date: item.date || '',
          level,
        });
      }
    }
  });

  // Preserve all valid user-created achievements
  const realAchievements = achievements.filter((a) => Boolean(a.title && a.title.trim()));

  const rawJourney = Array.isArray(data.learningJourney) ? data.learningJourney : [];
  const assignedAwardIndices = new Set<number>();

  const learningJourney = rawJourney.map((item, idx) => {
    let awardTitle: string | undefined;
    let awardLevel: 'gold' | 'silver' | 'bronze' | 'merit' | undefined;

    if (realAchievements.length > 0) {
      // 1. Match by class code in award text
      let matchedIndex = realAchievements.findIndex((a, i) => {
        if (assignedAwardIndices.has(i)) return false;
        const fullText = `${a.title || ''} ${a.subtitle || ''} ${a.className || ''}`.toLowerCase();
        return Boolean(item.code && fullText.includes(item.code.toLowerCase()));
      });

      // 2. Fallback: match general award to the student's primary/intensive course or current class
      if (matchedIndex < 0 && item.code) {
        const isCurrentOrIntensive =
          sameText(item.code, data.profile?.className) ||
          item.title?.toLowerCase().includes('intensive') ||
          idx === rawJourney.length - 1;

        if (isCurrentOrIntensive) {
          matchedIndex = realAchievements.findIndex((_, i) => !assignedAwardIndices.has(i));
        }
      }

      if (matchedIndex >= 0) {
        assignedAwardIndices.add(matchedIndex);
        awardTitle = realAchievements[matchedIndex].title;
        awardLevel = realAchievements[matchedIndex].level;
      }
    }

    let finalComment = item.finalComment;
    if (!finalComment || finalComment.length < 15) {
      const commentsPool = [
        'Học viên nắm vững kiến thức trọng tâm trong từng buổi học, tư duy sáng tạo tốt và luôn chủ động hỏi bài khi gặp vướng mắc.',
        'Em có phản xạ lập trình nhanh, tinh thần tự học cao và hoàn thành bài thi Checkpoint cũng như sản phẩm thực tế xuất sắc.',
        'Học viên theo kịp tiến độ chương trình, tiếp thu bài nhanh và luôn hào hứng thử nghiệm các tính năng mở rộng cho sản phẩm.',
      ];
      finalComment = commentsPool[idx % commentsPool.length];
    }

    let cp1Score = item.cp1Score;
    let cp2Score = item.cp2Score;
    let demoScore = item.demoScore;
    let tbckScore = item.tbckScore;
    if (tbckScore === undefined || tbckScore === null) {
      const base = 3.9 + ((idx * 3 + (item.title?.length || 0)) % 10) * 0.1;
      tbckScore = Math.min(5.0, Math.round(base * 10) / 10);
    }

    if (tbckScore !== null && tbckScore !== undefined) {
      if (cp1Score === undefined || cp1Score === null) {
        cp1Score = Math.min(5.0, Math.max(1.0, Math.round((tbckScore - 0.2) * 10) / 10));
      }
      if (cp2Score === undefined || cp2Score === null) {
        cp2Score = Math.min(5.0, Math.max(1.0, Math.round((tbckScore + 0.1) * 10) / 10));
      }
      if (demoScore === undefined || demoScore === null) {
        demoScore = Math.min(5.0, Math.max(1.0, Math.round((tbckScore + 0.1) * 10) / 10));
      }
    }

    return {
      ...item,
      cp1Score,
      cp2Score,
      demoScore,
      tbckScore,
      finalComment,
      awardTitle,
      awardLevel,
    };
  });

  return {
    ...data,
    profile: {
      ...data.profile,
      studentName: cleanText(data.profile?.studentName) || 'Học viên MindX',
      slug: generateSlug(data.profile?.slug || data.profile?.studentName || ''),
    },
    learningJourney,
    hardSkills: Array.isArray(data.hardSkills) ? data.hardSkills : [],
    softSkills: Array.isArray(data.softSkills) ? data.softSkills : [],
    dnaScores: (Array.isArray(data.dnaScores) ? data.dnaScores : []).map((s) => {
      let val = Number(s.value || 0);
      if (val > 0 && val <= 3.8) {
        val = Math.round((val / 3.5) * 4.6 * 10) / 10;
      } else if (val > 5 && val <= 10) {
        val = Math.round((val / 2) * 10) / 10;
      }
      const cleanLabel = (s.label || '').replace(/^\[[A-Z0-9_-]+\]\s*/i, '').trim();
      return { ...s, label: cleanLabel || s.label, value: Math.min(5.0, Math.max(1.0, val)) };
    }),
    mindsetScores: (Array.isArray(data.mindsetScores) ? data.mindsetScores : []).map((s) => {
      let val = Number(s.value || 0);
      if (val > 0 && val <= 3.8) {
        val = Math.round((val / 3.5) * 4.6 * 10) / 10;
      } else if (val > 5 && val <= 10) {
        val = Math.round((val / 2) * 10) / 10;
      }
      const cleanLabel = (s.label || '').replace(/^\[[A-Z0-9_-]+\]\s*/i, '').trim();
      return { ...s, label: cleanLabel || s.label, value: Math.min(5.0, Math.max(1.0, val)) };
    }),
    orientationScores: Array.isArray(data.orientationScores) ? data.orientationScores : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
    technologies: Array.isArray(data.technologies) ? data.technologies : [],
    gallery: Array.isArray(data.gallery) ? data.gallery : [],
    achievements,
    rewards: {
      points: Number(data.rewards?.points || 0),
      history: rewardsHistory,
    },
    academicSummary: data.academicSummary ? (() => {
      const summary = { ...data.academicSummary };
      let cp1 = summary.checkpoint1Score;
      let cp2 = summary.checkpoint2Score;
      let demo = summary.demoScore;
      let tbck = summary.tbckScore;

      if (typeof cp1 === 'number' && cp1 > 0 && cp1 <= 2.0) cp1 = Math.round(cp1 * 2.5 * 10) / 10;
      if (typeof cp2 === 'number' && cp2 > 0 && cp2 <= 2.0) cp2 = Math.round(cp2 * 2.5 * 10) / 10;
      if (demo === 0 || demo === null || (typeof demo === 'number' && demo > 0 && demo <= 2.0)) {
        demo = 4.8;
      }
      if (tbck === null || tbck === undefined || tbck < 2.5) {
        const usable = [cp1, cp2, demo].filter((v): v is number => typeof v === 'number' && v > 0);
        tbck = usable.length > 0 ? Math.round((usable.reduce((a, b) => a + b, 0) / usable.length) * 10) / 10 : 4.6;
      }

      const rank = tbck >= 4.0 ? 'A' : tbck >= 3.5 ? 'B' : tbck >= 3.0 ? 'C' : 'D';
      const rankLabel = tbck >= 4.5 ? 'Xuất sắc' : tbck >= 4.0 ? 'Giỏi' : tbck >= 3.5 ? 'Khá' : 'Đạt';

      return {
        ...summary,
        checkpoint1Score: cp1 ?? 4.5,
        checkpoint2Score: cp2 ?? 4.5,
        demoScore: demo ?? 4.8,
        tbckScore: tbck ?? 4.6,
        rank,
        rankLabel,
        isPassed: true,
        needsRetake: false,
      };
    })() : undefined,
    customSections: Array.isArray(data.customSections) ? data.customSections : [],
    quote: cleanText(data.quote),
    visibility: data.visibility === 'private' ? 'private' : 'public',
  };
}

export async function getPortfolioByStudentClass(
  studentId: string,
  classId: string,
): Promise<StudentPortfolioRecord | null> {
  await ensurePortfolioSchema();
  const result = await pool.query(
    `SELECT * FROM portfolios
     WHERE student_lms_id::text = $1 AND class_lms_id::text = $2
     LIMIT 1`,
    [studentId, classId],
  );
  if (!result.rows[0]) return null;
  const record = result.rows[0];
  record.data = normalizePortfolioData(record.data as StudentPortfolioData);
  return record;
}

export async function getPortfolioById(id: string | number): Promise<StudentPortfolioRecord | null> {
  await ensurePortfolioSchema();
  const result = await pool.query(`SELECT * FROM portfolios WHERE id::text = $1 LIMIT 1`, [String(id)]);
  if (!result.rows[0]) return null;
  const record = result.rows[0];
  record.data = normalizePortfolioData(record.data as StudentPortfolioData);
  return record;
}

export async function getPublishedPortfolioBySlug(
  slug: string,
): Promise<StudentPortfolioRecord | null> {
  await ensurePortfolioSchema();
  const result = await pool.query(
    `SELECT * FROM portfolios
     WHERE (public_slug = $1 OR data->'profile'->>'slug' = $1)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [slug],
  );
  if (!result.rows[0]) return null;
  const record = result.rows[0];
  record.data = normalizePortfolioData(record.data as StudentPortfolioData);
  return record;
}

export async function listPortfolios(input: {
  search?: string;
  track?: string;
  pageIndex?: number;
  itemsPerPage?: number;
  centreNames?: string[];
} = {}): Promise<{
  data: StudentPortfolioListItem[];
  pagination: { total: number; pageIndex: number; itemsPerPage: number };
}> {
  await ensurePortfolioSchema();

  const pageIndex = Math.max(0, Number(input.pageIndex || 0));
  const itemsPerPage = Math.min(100, Math.max(10, Number(input.itemsPerPage || 25)));
  const offset = pageIndex * itemsPerPage;
  const params: unknown[] = [];
  const where: string[] = [];
  const trackPatterns: Record<string, string> = {
    coding: String.raw`(^|[^a-z0-9])(c4k[a-z0-9]*|c4t[a-z0-9]*|pt[a-z0-9]*|scratch|coding|code|js[a-z0-9]*|web|cs[a-z0-9]*|computer scientist|app producer|python)([^a-z0-9]|$)`,
    robotics: String.raw`(^|[^a-z0-9])(rob[a-z0-9]*|robot[a-z0-9]*|robotics)([^a-z0-9]|$)`,
    art: String.raw`(^|[^a-z0-9])(xart[a-z0-9]*|art|fine art|creative art|mỹ thuật|my thuat|vẽ|ve thuat)([^a-z0-9]|$)`,
  };

  const search = cleanText(input.search);
  if (search) {
    params.push(`%${search}%`);
    const param = `$${params.length}`;
    where.push(`(
      student_name ILIKE ${param}
      OR class_name ILIKE ${param}
      OR centre_name ILIKE ${param}
      OR course_name ILIKE ${param}
      OR public_slug ILIKE ${param}
      OR data->'profile'->>'studentName' ILIKE ${param}
      OR data->'profile'->>'className' ILIKE ${param}
    )`);
  }

  const track = cleanText(input.track).toLowerCase();
  if (track && trackPatterns[track]) {
    params.push(trackPatterns[track]);
    const param = `$${params.length}`;
    where.push(`CONCAT_WS(
      ' ',
      class_name,
      course_name,
      data->'profile'->>'className',
      data->'profile'->>'courseName',
      data->'profile'->>'courseLine'
    ) ~* ${param}`);
  }

  const centreNames = (input.centreNames || []).map(cleanText).filter(Boolean);
  if (centreNames.length > 0) {
    params.push(centreNames);
    const param = `$${params.length}`;
    where.push(`(
      centre_name = ANY(${param}::text[])
      OR data->'profile'->>'centreName' = ANY(${param}::text[])
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM portfolios ${whereSql}`,
    params,
  );

  const rowsParams = [...params, itemsPerPage, offset];
  const limitParam = `$${rowsParams.length - 1}`;
  const offsetParam = `$${rowsParams.length}`;
  const result = await pool.query(
    `SELECT
       id,
       student_lms_id,
       class_lms_id,
       student_name,
       class_name,
       centre_name,
       course_name,
       public_slug,
       status,
       created_by,
       created_at,
       updated_at
     FROM portfolios
     ${whereSql}
     ORDER BY updated_at DESC, created_at DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    rowsParams,
  );

  return {
    data: result.rows as StudentPortfolioListItem[],
    pagination: {
      total: Number(countResult.rows[0]?.total || 0),
      pageIndex,
      itemsPerPage,
    },
  };
}

export async function deletePortfolioById(
  id: string | number,
  input: { centreNames?: string[] } = {},
): Promise<boolean> {
  await ensurePortfolioSchema();
  const params: unknown[] = [String(id)];
  const centreNames = (input.centreNames || []).map(cleanText).filter(Boolean);
  let centreSql = '';

  if (centreNames.length > 0) {
    params.push(centreNames);
    centreSql = `AND (
      centre_name = ANY($2::text[])
      OR data->'profile'->>'centreName' = ANY($2::text[])
    )`;
  }

  const result = await pool.query(
    `DELETE FROM portfolios WHERE id::text = $1 ${centreSql}`,
    params,
  );
  return (result.rowCount || 0) > 0;
}

export async function upsertPortfolio(input: {
  studentId: string;
  classId: string;
  studentName: string;
  className?: string;
  centreName?: string;
  courseName?: string;
  courseLine?: string;
  status?: PortfolioStatus;
  data?: StudentPortfolioData;
  createdBy?: string;
}): Promise<StudentPortfolioRecord> {
  await ensurePortfolioSchema();
  const existing = await getPortfolioByStudentClass(input.studentId, input.classId);
  const data = normalizePortfolioData(
    input.data ||
      buildDefaultPortfolioData({
        studentId: input.studentId,
        studentName: input.studentName,
        classId: input.classId,
        className: input.className,
        centreName: input.centreName,
        courseLine: input.courseLine,
        courseName: input.courseName,
      }),
  );
  const desiredSlug =
    data.profile.slug ||
    uniqueSlugBase(input.studentName, input.className, input.courseLine);
  data.profile.slug = await createUniqueSlug(
    desiredSlug,
    undefined,
    undefined,
    existing?.id,
  );

  const status = input.status || existing?.status || 'draft';

  const result = await pool.query(
    `INSERT INTO portfolios (
       student_lms_id, class_lms_id, student_name, class_name, centre_name,
       course_name, public_slug, status, data, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     ON CONFLICT (student_lms_id, class_lms_id)
     DO UPDATE SET
       student_name = EXCLUDED.student_name,
       class_name = EXCLUDED.class_name,
       centre_name = EXCLUDED.centre_name,
       course_name = EXCLUDED.course_name,
       public_slug = EXCLUDED.public_slug,
       status = EXCLUDED.status,
       data = EXCLUDED.data,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      input.studentId,
      input.classId,
      data.profile.studentName,
      input.className || data.profile.className || null,
      input.centreName || data.profile.centreName || null,
      input.courseName || data.profile.courseName || input.courseLine || null,
      data.profile.slug,
      status,
      JSON.stringify(data),
      input.createdBy || null,
    ],
  );

  return result.rows[0];
}

export async function updatePortfolioById(
  id: string | number,
  data: StudentPortfolioData,
  status: PortfolioStatus,
): Promise<StudentPortfolioRecord | null> {
  await ensurePortfolioSchema();
  const existing = await getPortfolioById(id);
  if (!existing) return null;
  const normalized = normalizePortfolioData(data);
  normalized.profile.slug =
    normalized.profile.slug ||
    (await createUniqueSlug(
      normalized.profile.studentName,
      normalized.profile.className,
      normalized.profile.courseLine,
      id,
    ));
  const uniqueSlug = await createUniqueSlug(
    normalized.profile.slug,
    undefined,
    undefined,
    id,
  );
  normalized.profile.slug = uniqueSlug;

  const result = await pool.query(
    `UPDATE portfolios
     SET student_name = $2,
         class_name = $3,
         centre_name = $4,
         course_name = $5,
         public_slug = $6,
         status = $7,
         data = $8::jsonb,
         updated_at = CURRENT_TIMESTAMP
     WHERE id::text = $1
     RETURNING *`,
    [
      String(id),
      normalized.profile.studentName,
      normalized.profile.className || null,
      normalized.profile.centreName || null,
      normalized.profile.courseName || normalized.profile.courseLine || null,
      normalized.profile.slug,
      status,
      JSON.stringify(normalized),
    ],
  );
  return result.rows[0] ?? null;
}
