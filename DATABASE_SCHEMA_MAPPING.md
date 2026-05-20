# 🗄️ Database Schema & Data Mapping - Route `/user/dao-tao-nang-cao`

## 📊 Tổng Quan Các Bảng Liên Quan

Hệ thống sử dụng **5 bảng chính** để quản lý video training và completion status:

```
┌─────────────────────────────┐
│   teachers                  │  ← Thông tin giáo viên
└─────────────────────────────┘
              ↓
┌─────────────────────────────┐
│ training_teacher_stats      │  ← Thống kê tổng hợp
└─────────────────────────────┘
              ↓
┌─────────────────────────────┐
│ training_videos             │  ← Danh sách video/lesson
└─────────────────────────────┘
              ↓
┌─────────────────────────────┐
│training_teacher_video_scores│  ← Điểm & progress của từng video
└─────────────────────────────┘
              ↓
┌─────────────────────────────┐
│training_video_assignments   │  ← Bài tập của video
└─────────────────────────────┘
              ↓
┌─────────────────────────────┐
│training_assignment_submissions│ ← Bài nộp của giáo viên
└─────────────────────────────┘
```

---

## 1️⃣ Bảng `teachers` - Thông Tin Giáo Viên

### Schema
```sql
CREATE TABLE teachers (
  code VARCHAR PRIMARY KEY,           -- Mã giáo viên (VD: "GV001")
  full_name VARCHAR,                  -- Họ tên
  user_name VARCHAR,                  -- Username
  work_email VARCHAR,                 -- Email công việc
  main_centre VARCHAR,                -- Trung tâm chính
  course_line VARCHAR,                -- Khối dạy
  -- ... các cột khác
);
```

### Cột Được Sử Dụng

| Cột | Type | Mục Đích | API Endpoint |
|-----|------|----------|--------------|
| `code` | VARCHAR | Định danh giáo viên | `/api/training-db` |
| `full_name` | VARCHAR | Hiển thị tên | `/api/training-db` |
| `user_name` | VARCHAR | Username hệ thống | `/api/training-db` |
| `work_email` | VARCHAR | Email liên hệ | `/api/training-db` |
| `main_centre` | VARCHAR | Trung tâm làm việc | `/api/training-db` |
| `course_line` | VARCHAR | Khối giảng dạy | `/api/training-db` |

### Query Thực Tế
```typescript
// File: app/api/training-db/route.ts
const teacherInfoQuery = `
  SELECT
    COALESCE(NULLIF(full_name, ''), $1) AS full_name,
    COALESCE(NULLIF(user_name, ''), NULL) AS username,
    COALESCE(NULLIF(work_email, ''), '') AS work_email,
    COALESCE(NULLIF(main_centre, ''), NULL) AS center,
    COALESCE(NULLIF(course_line, ''), NULL) AS teaching_block
  FROM teachers
  WHERE code = $1
  LIMIT 1
`;
```

---

## 2️⃣ Bảng `training_teacher_stats` - Thống Kê Giáo Viên

### Schema
```sql
CREATE TABLE training_teacher_stats (
  id SERIAL PRIMARY KEY,
  teacher_code VARCHAR UNIQUE NOT NULL,  -- FK → teachers.code
  full_name VARCHAR,
  username VARCHAR,
  work_email VARCHAR,
  center VARCHAR,
  teaching_block VARCHAR,
  status VARCHAR DEFAULT 'Active',       -- Active/Inactive
  total_score DECIMAL(5,2) DEFAULT 0.00, -- Tổng điểm
  phone_number VARCHAR,
  position VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Cột Được Sử Dụng

| Cột | Type | Mục Đích | Hiển Thị Ở |
|-----|------|----------|------------|
| `teacher_code` | VARCHAR | Liên kết với teachers | Backend |
| `full_name` | VARCHAR | Tên hiển thị | UI Header |
| `username` | VARCHAR | Username | UI Profile |
| `work_email` | VARCHAR | Email | UI Profile |
| `center` | VARCHAR | Trung tâm | UI Profile |
| `teaching_block` | VARCHAR | Khối dạy | UI Profile |
| `status` | VARCHAR | Trạng thái hoạt động | Backend |
| `total_score` | DECIMAL | Tổng điểm tích lũy | UI Stats |

### Query Thực Tế
```typescript
// File: app/api/training-db/route.ts
const teacherQuery = `
  INSERT INTO training_teacher_stats 
  (teacher_code, full_name, username, work_email, center, teaching_block, status, total_score)
  VALUES ($1, $2, $3, $4, $5, $6, 'Active', 0.00)
  ON CONFLICT (teacher_code) DO UPDATE 
  SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), training_teacher_stats.full_name),
    username = COALESCE(NULLIF(EXCLUDED.username, ''), training_teacher_stats.username),
    work_email = COALESCE(NULLIF(EXCLUDED.work_email, ''), training_teacher_stats.work_email),
    center = COALESCE(NULLIF(EXCLUDED.center, ''), training_teacher_stats.center),
    teaching_block = COALESCE(NULLIF(EXCLUDED.teaching_block, ''), training_teacher_stats.teaching_block),
    updated_at = CURRENT_TIMESTAMP
  RETURNING *
`;
```

---

## 3️⃣ Bảng `training_videos` - Danh Sách Video/Lesson

### Schema
```sql
CREATE TABLE training_videos (
  id SERIAL PRIMARY KEY,
  title VARCHAR NOT NULL,                -- Tiêu đề video
  video_link TEXT,                       -- URL video (Cloudinary/storage)
  video_group_id VARCHAR,                -- Group ID cho video nhiều phần
  chunk_index INTEGER,                   -- Thứ tự phần (0, 1, 2...)
  chunk_total INTEGER,                   -- Tổng số phần
  thumbnail_url TEXT,                    -- URL thumbnail
  description TEXT,                      -- Mô tả video
  duration_minutes INTEGER,              -- Thời lượng (phút)
  duration_seconds INTEGER,              -- Thời lượng (giây) - chính xác hơn
  lesson_number INTEGER,                 -- Số thứ tự bài học
  status VARCHAR DEFAULT 'active',       -- active/inactive
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Cột Được Sử Dụng

| Cột | Type | Mục Đích | Hiển Thị Ở |
|-----|------|----------|------------|
| `id` | INTEGER | ID video (primary key) | URL params, API calls |
| `title` | VARCHAR | Tên bài học | UI Card Title |
| `video_link` | TEXT | URL video để phát | Video Player |
| `video_group_id` | VARCHAR | Nhóm video nhiều phần | Backend grouping |
| `chunk_index` | INTEGER | Thứ tự phần | Backend sorting |
| `chunk_total` | INTEGER | Tổng số phần | Backend validation |
| `thumbnail_url` | TEXT | Ảnh thumbnail | UI Card Image |
| `description` | TEXT | Mô tả chi tiết | UI Card Description |
| `duration_minutes` | INTEGER | Thời lượng (phút) | UI Duration Badge |
| `duration_seconds` | INTEGER | Thời lượng (giây) | **Completion calculation** |
| `lesson_number` | INTEGER | Số thứ tự | UI Badge "LESSON 01" |
| `status` | VARCHAR | Trạng thái hiển thị | Filter active videos |

### Query Thực Tế
```typescript
// File: app/api/training-db/route.ts
const videosQuery = `
  SELECT 
    id,
    title,
    video_link,
    video_group_id,
    chunk_index,
    chunk_total,
    thumbnail_url,
    description,
    duration_minutes,
    duration_seconds,
    lesson_number,
    status
  FROM training_videos
  WHERE status = 'active'
  ORDER BY lesson_number ASC
`;
```

### Logic Grouping Video
```typescript
// Nhóm các video có cùng video_group_id thành 1 lesson
const groupedVideoMap = new Map<string, any[]>();
videosResult.rows.forEach((video) => {
  const groupKey = video.video_group_id 
    ? `group:${video.video_group_id}` 
    : `single:${video.id}`;
  if (!groupedVideoMap.has(groupKey)) groupedVideoMap.set(groupKey, []);
  groupedVideoMap.get(groupKey)!.push(video);
});

// Tạo segments array cho video player
const segments = sorted.map((vid) => ({
  id: vid.id,
  url: normalizeStorageUrl(vid.video_link),
  duration_minutes: Number(vid.duration_minutes) || 0,
  duration_seconds: vid.duration_seconds != null ? Number(vid.duration_seconds) : null
}));
```

---

## 4️⃣ Bảng `training_teacher_video_scores` - Progress & Completion

### Schema
```sql
CREATE TABLE training_teacher_video_scores (
  id SERIAL PRIMARY KEY,
  teacher_code VARCHAR NOT NULL,         -- FK → teachers.code
  video_id INTEGER NOT NULL,             -- FK → training_videos.id
  score DECIMAL(5,2) DEFAULT 0.00,       -- Điểm bài tập (0-10)
  time_spent_seconds INTEGER DEFAULT 0,  -- Thời gian xem (client report)
  server_time_seconds INTEGER DEFAULT 0, -- ⭐ Thời gian xem (server tính)
  completion_status VARCHAR DEFAULT 'not_started', -- Trạng thái
  completed_at TIMESTAMP,                -- Thời điểm hoàn thành
  last_heartbeat_at TIMESTAMP,           -- ⭐ Heartbeat cuối cùng
  first_viewed_at TIMESTAMP,             -- Lần đầu xem
  view_count INTEGER DEFAULT 0,          -- Số lần xem
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(teacher_code, video_id)
);
```

### Cột Được Sử Dụng (⭐ = Quan Trọng Nhất)

| Cột | Type | Mục Đích | Sử Dụng Trong Logic |
|-----|------|----------|---------------------|
| `teacher_code` | VARCHAR | Định danh giáo viên | JOIN với teachers |
| `video_id` | INTEGER | Định danh video | JOIN với training_videos |
| `score` | DECIMAL | Điểm bài tập | Hiển thị điểm, tính average |
| `time_spent_seconds` | INTEGER | Thời gian xem (client) | Fallback khi không có server_time |
| ⭐ `server_time_seconds` | INTEGER | **Thời gian xem thực tế** | **Tính completion (>= 90%)** |
| ⭐ `completion_status` | VARCHAR | **Trạng thái video** | **Quyết định có thể làm bài tập** |
| `completed_at` | TIMESTAMP | Thời điểm hoàn thành | Hiển thị ngày hoàn thành |
| ⭐ `last_heartbeat_at` | TIMESTAMP | **Heartbeat cuối** | **Validate xem thực tế trên TMS** |
| `first_viewed_at` | TIMESTAMP | Lần đầu xem | Thống kê |
| `view_count` | INTEGER | Số lần xem | Thống kê |

### Các Giá Trị `completion_status`

| Giá Trị | Ý Nghĩa | Điều Kiện |
|---------|---------|-----------|
| `not_started` | Chưa bắt đầu | `time_spent_seconds = 0` |
| `in_progress` | Đang xem | `time_spent_seconds > 0` nhưng < 90% |
| `watched` | Đã xem xong | `server_time_seconds >= 90% duration` + có heartbeat |
| `completed` | Hoàn thành (có bài tập) | Đã nộp bài kiểm tra |

### Query GET Progress
```typescript
// File: app/api/training-progress/route.ts
export const GET = async (request: NextRequest) => {
  const result = await pool.query(
    `SELECT time_spent_seconds, server_time_seconds, completion_status, last_heartbeat_at
     FROM training_teacher_video_scores
     WHERE teacher_code = $1 AND video_id = $2`,
    [teacherCode, videoId]
  );
  
  // Trả về server_time_seconds để client resume đúng vị trí
  return NextResponse.json({
    success: true,
    data: {
      ...row,
      time_spent_seconds: row.server_time_seconds || row.time_spent_seconds,
    },
  });
};
```

### Query POST Progress (Update)
```typescript
// File: app/api/training-progress/route.ts
export const POST = async (request: NextRequest) => {
  // 1. Tính delta thực tế giữa 2 heartbeat
  const now = new Date();
  let serverTimeDelta = 0;
  
  if (existing?.last_heartbeat_at) {
    const lastHeartbeat = new Date(existing.last_heartbeat_at);
    const deltaSeconds = (now.getTime() - lastHeartbeat.getTime()) / 1000;
    
    if (deltaSeconds >= MIN_HEARTBEAT_DELTA_S && deltaSeconds <= MAX_HEARTBEAT_DELTA_S) {
      serverTimeDelta = Math.floor(deltaSeconds);
    }
  }
  
  // 2. Cộng dồn server_time_seconds
  const prevServerTime = Number(existing?.server_time_seconds) || 0;
  const newServerTime = prevServerTime + serverTimeDelta;
  
  // 3. Validate completion: phải >= 90% duration
  let validatedIsCompleted = isCompleted === true;
  if (validatedIsCompleted && videoDurationSeconds) {
    const minRequired = videoDurationSeconds * COMPLETION_THRESHOLD; // 0.90
    if (clampedServerTime < minRequired) {
      validatedIsCompleted = false;
    }
  }
  
  // 4. Upsert vào DB
  const result = await pool.query(
    `INSERT INTO training_teacher_video_scores
       (teacher_code, video_id, time_spent_seconds, server_time_seconds,
        completion_status, completed_at, updated_at, first_viewed_at,
        view_count, last_heartbeat_at)
     VALUES ($1, $2, $3, $3, $4::text,
       CASE WHEN $4::text = 'completed' THEN NOW() ELSE NULL END,
       NOW(), NOW(), 1, $5)
     ON CONFLICT (teacher_code, video_id) DO UPDATE SET
       server_time_seconds = $3,
       last_heartbeat_at = $5,
       completion_status = CASE
         WHEN training_teacher_video_scores.completion_status = 'completed' THEN 'completed'
         WHEN training_teacher_video_scores.completion_status = 'watched' THEN 'watched'
         ELSE $4::text
       END,
       updated_at = NOW()
     RETURNING *`,
    [teacherCode, videoId, clampedServerTime, statusParam, now]
  );
};
```

### Query Trong `/api/training-db`
```typescript
// Lấy tất cả scores của giáo viên
const scoresResult = await pool.query(
  `SELECT 
    video_id,
    score,
    completion_status,
    completed_at,
    time_spent_seconds,
    COALESCE(server_time_seconds, 0) AS server_time_seconds,
    last_heartbeat_at
  FROM training_teacher_video_scores
  WHERE teacher_code = $1`,
  [teacherCode]
);

// Tạo Map để lookup nhanh
const scoresMap = new Map();
scoresResult.rows.forEach((row) => {
  scoresMap.set(row.video_id, {
    score: parseFloat(String(row.score)) || 0,
    completion_status: row.completion_status,
    completed_at: row.completed_at,
    time_spent_seconds: row.time_spent_seconds || 0,
    server_time_seconds: Number(row.server_time_seconds) || 0,
    last_heartbeat_at: row.last_heartbeat_at ?? null,
  });
});
```

---

## 5️⃣ Bảng `training_video_assignments` - Bài Tập Video

### Schema
```sql
CREATE TABLE training_video_assignments (
  id SERIAL PRIMARY KEY,
  video_id INTEGER,                      -- FK → training_videos.id
  assignment_title VARCHAR NOT NULL,
  description TEXT,
  assignment_type VARCHAR,               -- quiz/essay/coding
  passing_score DECIMAL(5,2),            -- Điểm đạt (VD: 7.0)
  max_attempts INTEGER,                  -- Số lần làm tối đa
  time_limit_minutes INTEGER,            -- Thời gian làm bài
  question_count INTEGER,                -- Số câu hỏi
  status VARCHAR DEFAULT 'draft',        -- draft/published/archived
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Cột Được Sử Dụng

| Cột | Type | Mục Đích | Hiển Thị Ở |
|-----|------|----------|------------|
| `id` | INTEGER | ID bài tập | URL params |
| `video_id` | INTEGER | Liên kết với video | Filter assignments by video |
| `assignment_title` | VARCHAR | Tên bài tập | UI Button Text |
| `description` | TEXT | Mô tả bài tập | Assignment Page |
| `assignment_type` | VARCHAR | Loại bài tập | UI Icon |
| `passing_score` | DECIMAL | Điểm đạt | Validation |
| `max_attempts` | INTEGER | Giới hạn số lần làm | Validation |
| `time_limit_minutes` | INTEGER | Thời gian làm bài | Timer |
| `question_count` | INTEGER | Số câu hỏi | UI Info |
| `status` | VARCHAR | Trạng thái | Filter published only |

### Query Thực Tế
```typescript
// File: app/user/training/page.tsx
const { data: assignmentsData } = useSWR(
  teacher && user
    ? `/api/training-assignments?status=published&teacher_code=${teacher.code}`
    : null,
  secureFetcher
);

// Tìm assignment của video hiện tại
const assignment = assignmentList.find(
  (a) => a.video_id === lesson.id
);
```

---

## 6️⃣ Bảng `training_assignment_submissions` - Bài Nộp

### Schema
```sql
CREATE TABLE training_assignment_submissions (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL,        -- FK → training_video_assignments.id
  teacher_code VARCHAR NOT NULL,         -- FK → teachers.code
  submitted_at TIMESTAMP,                -- Thời điểm nộp bài
  score DECIMAL(5,2),                    -- Điểm đạt được
  total_points DECIMAL(5,2),             -- Tổng điểm
  percentage DECIMAL(5,2),               -- Phần trăm
  is_passed BOOLEAN,                     -- Đạt/Không đạt
  status VARCHAR DEFAULT 'draft',        -- draft/submitted/graded
  attempt_number INTEGER DEFAULT 1,      -- Lần làm thứ mấy
  time_spent_seconds INTEGER,            -- Thời gian làm bài
  answers JSONB,                         -- Câu trả lời
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Cột Được Sử Dụng

| Cột | Type | Mục Đích | Sử Dụng Trong Logic |
|-----|------|----------|---------------------|
| `assignment_id` | INTEGER | Liên kết với bài tập | JOIN |
| `teacher_code` | VARCHAR | Giáo viên nộp bài | Filter |
| `submitted_at` | TIMESTAMP | Thời điểm nộp | Hiển thị |
| `score` | DECIMAL | Điểm đạt được | Hiển thị, sync vào scores |
| `is_passed` | BOOLEAN | Đạt/Không đạt | Badge UI |
| `status` | VARCHAR | Trạng thái bài nộp | **Xác định video completed** |

### Query Quiz Evidence
```typescript
// File: app/api/training-db/route.ts
const quizEvidenceByVideoQuery = `
  SELECT DISTINCT tva.video_id
  FROM training_assignment_submissions tas
  INNER JOIN training_video_assignments tva ON tva.id = tas.assignment_id
  WHERE tas.teacher_code = $1
    AND tva.video_id IS NOT NULL
    AND (
      tas.status = 'graded'
      OR (tas.submitted_at IS NOT NULL AND tas.status IN ('submitted', 'graded'))
    )
`;

const quizEvidenceVideoIds = new Set<number>(
  quizEvidenceResult.rows.map((r) => r.video_id)
);

// Nếu video có quiz evidence → completion_status = 'completed'
const hasQuizEvidenceForLesson = sourceIds.some((id) =>
  quizEvidenceVideoIds.has(id)
);
```

---

## 🔄 Data Flow - Từ Database Đến UI

### 1. Load Danh Sách Video
```
Frontend Request
    ↓
GET /api/training-db?code=GV001
    ↓
┌─────────────────────────────────────────┐
│ 1. Query teachers                       │
│    → Lấy full_name, work_email, center │
├─────────────────────────────────────────┤
│ 2. Upsert training_teacher_stats        │
│    → Sync thông tin từ teachers         │
├─────────────────────────────────────────┤
│ 3. Query training_videos                │
│    → WHERE status = 'active'            │
│    → ORDER BY lesson_number ASC         │
├─────────────────────────────────────────┤
│ 4. Query training_teacher_video_scores  │
│    → WHERE teacher_code = 'GV001'       │
│    → Lấy score, completion_status,      │
│      server_time_seconds, heartbeat     │
├─────────────────────────────────────────┤
│ 5. Query quiz evidence                  │
│    → JOIN submissions + assignments     │
│    → Lấy video_id đã có bài nộp         │
├─────────────────────────────────────────┤
│ 6. Group videos by video_group_id       │
│    → Gộp các chunk thành 1 lesson       │
├─────────────────────────────────────────┤
│ 7. Calculate effective completion       │
│    → Dùng lib/training-effective-       │
│      video-completion.ts                │
│    → Validate heartbeat + 90% duration  │
└─────────────────────────────────────────┘
    ↓
Response JSON
    ↓
Frontend Render UI
```

### 2. Xem Video & Lưu Progress
```
User plays video
    ↓
Every 10 seconds: POST /api/training-progress
    ↓
┌─────────────────────────────────────────┐
│ 1. Get existing record                  │
│    → training_teacher_video_scores      │
│    → WHERE teacher_code + video_id      │
├─────────────────────────────────────────┤
│ 2. Calculate delta                      │
│    → now - last_heartbeat_at            │
│    → Validate: 1s ≤ delta ≤ 15s         │
├─────────────────────────────────────────┤
│ 3. Update server_time_seconds           │
│    → prevServerTime + delta             │
│    → Clamp: không vượt duration + 10s   │
├─────────────────────────────────────────┤
│ 4. Validate completion                  │
│    → IF server_time >= 90% duration     │
│    → THEN status = 'watched'            │
├─────────────────────────────────────────┤
│ 5. Upsert record                        │
│    → UPDATE server_time_seconds         │
│    → UPDATE last_heartbeat_at = NOW()   │
│    → UPDATE completion_status           │
└─────────────────────────────────────────┘
    ↓
Response: { success: true, data: {...} }
```

### 3. Kiểm Tra Quyền Làm Bài Tập
```
User clicks "Làm bài tập" button
    ↓
Frontend checks: canTakeQuiz
    ↓
┌─────────────────────────────────────────┐
│ const isCompleted =                     │
│   lesson.completion_status === 'completed'│
│                                         │
│ const isWatched =                       │
│   lesson.completion_status === 'watched'│
│                                         │
│ const canTakeQuiz =                     │
│   isCompleted || isWatched              │
└─────────────────────────────────────────┘
    ↓
IF canTakeQuiz = true
    → Navigate to assignment page
ELSE
    → Show toast: "Cần xem xong video"
```

---

## 📋 Mapping: Database → Frontend

### Lesson Card UI
```typescript
interface TrainingLesson {
  // Từ training_videos
  id: number                    // ← training_videos.id
  name: string                  // ← training_videos.title
  link: string                  // ← training_videos.video_link
  thumbnail_url: string         // ← training_videos.thumbnail_url
  description: string           // ← training_videos.description
  duration_minutes: number      // ← training_videos.duration_minutes
  duration_seconds: number      // ← training_videos.duration_seconds
  lesson_number: number         // ← training_videos.lesson_number
  
  // Từ training_teacher_video_scores
  score: number                 // ← training_teacher_video_scores.score
  completion_status: string     // ← training_teacher_video_scores.completion_status
  completed_at: string          // ← training_teacher_video_scores.completed_at
  time_spent_seconds: number    // ← training_teacher_video_scores.server_time_seconds
  
  // Computed từ grouping
  segments: Array<{
    id: number                  // ← training_videos.id (của từng chunk)
    url: string                 // ← training_videos.video_link
    duration_minutes: number    // ← training_videos.duration_minutes
    duration_seconds: number    // ← training_videos.duration_seconds
  }>
}
```

### Teacher Stats UI
```typescript
interface TrainingData {
  // Từ training_teacher_stats
  no: string                    // ← training_teacher_stats.id
  fullName: string              // ← training_teacher_stats.full_name
  code: string                  // ← training_teacher_stats.teacher_code
  userName: string              // ← training_teacher_stats.username
  workEmail: string             // ← training_teacher_stats.work_email
  centers: string               // ← training_teacher_stats.center
  khoiFinal: string             // ← training_teacher_stats.teaching_block
  status: string                // ← training_teacher_stats.status
  
  // Computed
  averageScore: number          // ← AVG(lessons.score WHERE score > 0)
  totalScore: number            // ← training_teacher_stats.total_score
  
  lessons: TrainingLesson[]
}
```

---

## 🎯 Key Takeaways

### Cột Quan Trọng Nhất Cho Completion Logic

1. **`training_teacher_video_scores.server_time_seconds`**
   - Thời gian xem thực tế do server tính
   - Dùng để validate >= 90% duration
   - Không thể fake từ client

2. **`training_teacher_video_scores.last_heartbeat_at`**
   - Chứng minh user thực sự xem trên TMS
   - Không chỉ import time_spent từ nguồn khác

3. **`training_teacher_video_scores.completion_status`**
   - Quyết định có thể làm bài tập hay không
   - Giá trị: not_started, in_progress, watched, completed

4. **`training_videos.duration_seconds`**
   - Dùng để tính 90% threshold
   - Ưu tiên hơn duration_minutes (chính xác hơn)

5. **`training_assignment_submissions.status`**
   - Nếu có bài nộp graded/submitted
   - → Video tự động chuyển sang 'completed'

---

**Ngày tạo:** 2026-05-14  
**Người tạo:** Kiro AI Assistant
