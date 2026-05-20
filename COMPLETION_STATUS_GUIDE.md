# 📊 Completion Status Guide - Bảng `training_teacher_video_scores`

## 🎯 Tổng Quan

Cột `completion_status` trong bảng `training_teacher_video_scores` có **4 trạng thái** được định nghĩa bởi constraint:

```sql
ALTER TABLE training_teacher_video_scores 
ADD CONSTRAINT training_teacher_video_scores_completion_status_check 
CHECK (completion_status IN ('not_started', 'in_progress', 'watched', 'completed'));
```

---

## 📋 Các Trạng Thái

### 1️⃣ `not_started` - Chưa Bắt Đầu

#### Định Nghĩa
Video chưa được xem, không có bất kỳ progress nào.

#### Điều Kiện
```typescript
// Khi:
time_spent_seconds = 0
server_time_seconds = 0
last_heartbeat_at = NULL
```

#### Quyền Hạn
- ❌ **KHÔNG THỂ** làm bài tập
- ❌ **KHÔNG THỂ** xem lại video từ vị trí cũ (vì chưa có vị trí)
- ✅ **CÓ THỂ** bắt đầu xem video

#### UI Display
```typescript
// Badge màu xám
<span className="bg-gray-100 text-gray-800">
  Chưa học
</span>
```

#### Database Example
```sql
SELECT * FROM training_teacher_video_scores 
WHERE completion_status = 'not_started';

-- Result:
teacher_code | video_id | time_spent_seconds | server_time_seconds | completion_status
-------------|----------|-------------------|---------------------|------------------
GV001        | 1        | 0                 | 0                   | not_started
```

---

### 2️⃣ `in_progress` - Đang Xem

#### Định Nghĩa
Video đang được xem nhưng chưa đủ 90% thời lượng.

#### Điều Kiện
```typescript
// Khi:
server_time_seconds > 0
server_time_seconds < (duration_seconds * 0.90)  // < 90%
last_heartbeat_at IS NOT NULL
```

#### Quyền Hạn
- ❌ **KHÔNG THỂ** làm bài tập (chưa xem đủ)
- ✅ **CÓ THỂ** tiếp tục xem video từ vị trí đã dừng
- ✅ **CÓ THỂ** xem lại từ đầu

#### UI Display
```typescript
// Badge màu vàng + progress bar
<span className="bg-yellow-100 text-yellow-800">
  Đang học - {progress}%
</span>

// Progress bar
<div className="w-full bg-gray-200 rounded-full h-1.5">
  <div 
    className="bg-[#c41230] h-1.5 rounded-full"
    style={{ width: `${progress}%` }}
  />
</div>
```

#### Database Example
```sql
SELECT * FROM training_teacher_video_scores 
WHERE completion_status = 'in_progress';

-- Result:
teacher_code | video_id | time_spent_seconds | server_time_seconds | duration_seconds | completion_status
-------------|----------|-------------------|---------------------|------------------|------------------
GV001        | 1        | 900               | 900                 | 1800             | in_progress
-- 900 / 1800 = 50% (< 90%)
```

#### Logic Code
```typescript
// lib/training-effective-video-completion.ts
if (watched > 0) {
  return { completion_status: 'in_progress', completed_at: null }
}
```

---

### 3️⃣ `watched` - Đã Xem Xong

#### Định Nghĩa
Video đã được xem đủ 90% thời lượng, có heartbeat từ TMS, **NHƯNG CHƯA LÀM BÀI TẬP**.

#### Điều Kiện
```typescript
// Khi:
server_time_seconds >= (duration_seconds * 0.90)  // >= 90%
last_heartbeat_at IS NOT NULL
hasTmsWatchHeartbeat = true
hasPlatformQuizEvidenceForVideo = false  // Chưa có bài nộp
```

#### Quyền Hạn
- ✅ **CÓ THỂ** làm bài tập (đã xem đủ video)
- ✅ **CÓ THỂ** xem lại video
- ✅ **CÓ THỂ** tiếp tục xem phần còn lại (nếu chưa xem hết 100%)

#### UI Display
```typescript
// Badge màu xanh dương
<span className="bg-blue-100 text-blue-800">
  👁️ Đã xem
</span>

// Button làm bài tập: ENABLED
<button className="bg-[#a1001f] text-white hover:bg-[#8a001a]">
  Làm bài kiểm tra
</button>
```

#### Database Example
```sql
SELECT * FROM training_teacher_video_scores 
WHERE completion_status = 'watched';

-- Result:
teacher_code | video_id | time_spent_seconds | server_time_seconds | duration_seconds | completion_status
-------------|----------|-------------------|---------------------|------------------|------------------
GV001        | 1        | 1650              | 1650                | 1800             | watched
-- 1650 / 1800 = 91.67% (>= 90%)
```

#### Logic Code
```typescript
// lib/training-effective-video-completion.ts
const ratioOk = dur > 0
  ? cappedWatch >= dur * TRAINING_WATCH_COMPLETION_RATIO  // 0.90
  : cappedWatch >= TRAINING_WATCH_FALLBACK_MIN_SECONDS    // 120s

const watchOk = input.hasTmsWatchHeartbeat && ratioOk

if (watchOk) {
  return { completion_status: 'watched', completed_at: completedAtStr }
}
```

---

### 4️⃣ `completed` - Hoàn Thành

#### Định Nghĩa
Video đã được xem đủ 90% **VÀ** đã làm bài tập (có bài nộp trong `training_assignment_submissions`).

#### Điều Kiện
```typescript
// Khi:
server_time_seconds >= (duration_seconds * 0.90)  // >= 90%
last_heartbeat_at IS NOT NULL
hasTmsWatchHeartbeat = true
hasPlatformQuizEvidenceForVideo = true  // Có bài nộp
```

#### Quyền Hạn
- ✅ **CÓ THỂ** làm lại bài tập (nếu max_attempts cho phép)
- ✅ **CÓ THỂ** xem lại video
- ✅ **CÓ THỂ** xem điểm bài tập

#### UI Display
```typescript
// Badge màu xanh lá
<span className="bg-green-100 text-green-800">
  ✓ Hoàn thành
</span>

// Hiển thị điểm
<div className="text-sm text-gray-600">
  Điểm: {score.toFixed(1)}/10
</div>

// Button làm bài tập: ENABLED (làm lại)
<button className="bg-[#a1001f] text-white hover:bg-[#8a001a]">
  Làm lại bài kiểm tra
</button>
```

#### Database Example
```sql
SELECT 
  tvs.*,
  tas.score as quiz_score,
  tas.submitted_at
FROM training_teacher_video_scores tvs
LEFT JOIN training_assignment_submissions tas 
  ON tas.teacher_code = tvs.teacher_code
LEFT JOIN training_video_assignments tva 
  ON tva.id = tas.assignment_id AND tva.video_id = tvs.video_id
WHERE tvs.completion_status = 'completed';

-- Result:
teacher_code | video_id | server_time_seconds | duration_seconds | completion_status | quiz_score | submitted_at
-------------|----------|---------------------|------------------|-------------------|------------|-------------
GV001        | 1        | 1750                | 1800             | completed         | 8.5        | 2026-05-14
-- 1750 / 1800 = 97.22% (>= 90%) + có bài nộp
```

#### Logic Code
```typescript
// lib/training-effective-video-completion.ts
if (input.hasPlatformQuizEvidenceForVideo) {
  if (raw === 'completed') {
    return { completion_status: 'completed', completed_at: completedAtStr }
  }
  
  const watchOk = input.hasTmsWatchHeartbeat && ratioOk
  
  if (watchOk) {
    return { completion_status: 'completed', completed_at: completedAtStr }
  }
  
  // ⚠️ Nếu có bài nộp nhưng chưa xem đủ video → KHÔNG cho phép completed
  // (Trường hợp này xảy ra khi import data cũ)
  return { completion_status: 'in_progress', completed_at: null }
}
```

---

## 🔄 State Transition Diagram

```
┌─────────────┐
│ not_started │ ← Khởi tạo ban đầu
└──────┬──────┘
       │ User bắt đầu xem video
       │ (server_time_seconds > 0)
       ↓
┌─────────────┐
│ in_progress │ ← Đang xem (< 90%)
└──────┬──────┘
       │ User xem đủ 90%
       │ (server_time_seconds >= 90% duration)
       ↓
┌─────────────┐
│   watched   │ ← Đã xem xong, chưa làm bài
└──────┬──────┘
       │ User làm bài tập và nộp
       │ (hasPlatformQuizEvidenceForVideo = true)
       ↓
┌─────────────┐
│  completed  │ ← Hoàn thành (có bài nộp)
└─────────────┘
```

### Lưu Ý Quan Trọng

1. **Không thể nhảy từ `not_started` → `completed`**
   - Phải qua `in_progress` → `watched` → `completed`
   - Đảm bảo user thực sự xem video

2. **`watched` vs `completed`**
   - `watched`: Xem đủ video, **CHƯA** làm bài tập
   - `completed`: Xem đủ video, **ĐÃ** làm bài tập

3. **Có thể quay lại trạng thái trước**
   - Nếu import data sai: `completed` → `in_progress` (nếu chưa xem đủ)
   - Migration có thể fix: `completed` → `watched` (nếu không có bài nộp)

---

## 📊 So Sánh Chi Tiết

| Tiêu Chí | not_started | in_progress | watched | completed |
|----------|-------------|-------------|---------|-----------|
| **server_time_seconds** | 0 | > 0, < 90% | >= 90% | >= 90% |
| **last_heartbeat_at** | NULL | NOT NULL | NOT NULL | NOT NULL |
| **Có bài nộp** | ❌ | ❌ | ❌ | ✅ |
| **Có thể làm bài tập** | ❌ | ❌ | ✅ | ✅ |
| **Hiển thị điểm** | ❌ | ❌ | ❌ | ✅ |
| **Progress bar** | 0% | 1-89% | 90-100% | 100% |
| **Badge color** | Gray | Yellow | Blue | Green |
| **completed_at** | NULL | NULL | NULL hoặc có | Có |

---

## 🔍 Query Examples

### 1. Tìm users chưa bắt đầu xem
```sql
SELECT teacher_code, COUNT(*) as not_started_count
FROM training_teacher_video_scores
WHERE completion_status = 'not_started'
GROUP BY teacher_code
ORDER BY not_started_count DESC;
```

### 2. Tìm users đang xem dở
```sql
SELECT 
  teacher_code,
  video_id,
  server_time_seconds,
  ROUND(server_time_seconds::numeric / NULLIF(duration_seconds, 0) * 100, 2) as progress_percent
FROM training_teacher_video_scores tvs
JOIN training_videos tv ON tv.id = tvs.video_id
WHERE completion_status = 'in_progress'
ORDER BY progress_percent DESC;
```

### 3. Tìm users đã xem xong nhưng chưa làm bài
```sql
SELECT teacher_code, COUNT(*) as watched_count
FROM training_teacher_video_scores
WHERE completion_status = 'watched'
GROUP BY teacher_code
ORDER BY watched_count DESC;
```

### 4. Tìm users hoàn thành
```sql
SELECT 
  tvs.teacher_code,
  COUNT(*) as completed_count,
  AVG(tvs.score) as avg_score
FROM training_teacher_video_scores tvs
WHERE completion_status = 'completed'
GROUP BY tvs.teacher_code
ORDER BY completed_count DESC;
```

### 5. Kiểm tra data integrity (users có `completed` nhưng chưa xem đủ)
```sql
SELECT 
  tvs.teacher_code,
  tvs.video_id,
  tvs.completion_status,
  tvs.server_time_seconds,
  tv.duration_seconds,
  ROUND(tvs.server_time_seconds::numeric / NULLIF(tv.duration_seconds, 0) * 100, 2) as watch_percent
FROM training_teacher_video_scores tvs
JOIN training_videos tv ON tv.id = tvs.video_id
WHERE tvs.completion_status = 'completed'
  AND tvs.server_time_seconds < tv.duration_seconds * 0.9
ORDER BY watch_percent ASC;
```

---

## 🛠️ Migration History

### Migration: Fix Completion Status
```sql
-- Chuyển các bản ghi 'completed' nhưng không có điểm sang 'watched'
UPDATE training_teacher_video_scores
SET completion_status = 'watched'
WHERE completion_status = 'completed' 
  AND (score IS NULL OR score < 7);
```

**Lý do:** Trước đây có bug cho phép user có `completion_status = 'completed'` mà không cần làm bài tập.

---

## 🎯 Best Practices

### 1. Khi Tạo Record Mới
```typescript
// Luôn bắt đầu với 'not_started'
INSERT INTO training_teacher_video_scores
  (teacher_code, video_id, completion_status, server_time_seconds)
VALUES
  ('GV001', 1, 'not_started', 0);
```

### 2. Khi Update Progress
```typescript
// Chỉ update khi có heartbeat hợp lệ
UPDATE training_teacher_video_scores
SET 
  server_time_seconds = $1,
  last_heartbeat_at = NOW(),
  completion_status = CASE
    WHEN $1 >= duration_seconds * 0.9 THEN 'watched'
    WHEN $1 > 0 THEN 'in_progress'
    ELSE 'not_started'
  END
WHERE teacher_code = $2 AND video_id = $3;
```

### 3. Khi User Nộp Bài
```typescript
// Chỉ cho phép 'completed' nếu đã xem đủ video
UPDATE training_teacher_video_scores
SET 
  completion_status = CASE
    WHEN server_time_seconds >= duration_seconds * 0.9 THEN 'completed'
    ELSE completion_status  -- Giữ nguyên nếu chưa xem đủ
  END,
  completed_at = CASE
    WHEN server_time_seconds >= duration_seconds * 0.9 THEN NOW()
    ELSE NULL
  END
WHERE teacher_code = $1 AND video_id = $2;
```

---

## ⚠️ Common Pitfalls

### 1. ❌ Cho phép `completed` mà không check watch progress
```typescript
// SAI:
if (hasQuizSubmission) {
  completion_status = 'completed'  // ❌ Không check xem đã xem video chưa
}
```

### 2. ❌ Dùng `time_spent_seconds` thay vì `server_time_seconds`
```typescript
// SAI:
if (time_spent_seconds >= duration * 0.9) {  // ❌ Có thể fake
  completion_status = 'watched'
}

// ĐÚNG:
if (server_time_seconds >= duration * 0.9) {  // ✅ Server tính, không fake được
  completion_status = 'watched'
}
```

### 3. ❌ Không check `hasTmsWatchHeartbeat`
```typescript
// SAI:
if (mergedWatchedSeconds >= duration * 0.9) {  // ❌ Có thể là import data
  completion_status = 'watched'
}

// ĐÚNG:
if (hasTmsWatchHeartbeat && mergedWatchedSeconds >= duration * 0.9) {  // ✅
  completion_status = 'watched'
}
```

---

**Ngày tạo:** 2026-05-14  
**Người tạo:** Kiro AI Assistant  
**Version:** 1.0
