# 🐛 Debug: User `banghh` Hiển Thị Tất Cả Video Đã Hoàn Thành

## Vấn Đề
- User `banghh` **KHÔNG CÓ** record trong bảng `training_teacher_video_scores`
- Nhưng khi đăng nhập, **TẤT CẢ VIDEO** hiển thị:
  - ✅ Trạng thái: "Hoàn thành" hoặc "Đã xem"
  - ✅ Có thể làm bài tập ngay lập tức

## Các Giả Thuyết

### ❌ Giả Thuyết 1: Logic Backend Sai
**Kiểm tra:**
```typescript
// lib/training-effective-video-completion.ts
export function effectiveVideoCompletionFromRaw(input) {
  // Khi không có record:
  // - mergedWatchedSeconds = 0
  // - hasTmsWatchHeartbeat = false
  // - hasPlatformQuizEvidenceForVideo = false (nếu không có bài nộp)
  
  if (watched === 0) {
    return { completion_status: 'not_started', completed_at: null }
  }
}
```
**Kết luận:** Logic backend ĐÚNG ✅

### ❌ Giả Thuyết 2: Logic Frontend Sai
**Kiểm tra:**
```typescript
// app/user/training/page.tsx
const isCompleted = lesson.completion_status === 'completed'
const isWatched = lesson.completion_status === 'watched'
const canTakeQuiz = isCompleted || isWatched
```
**Kết luận:** Logic frontend ĐÚNG ✅

### ✅ Giả Thuyết 3: Có Dữ Liệu Ẩn Trong Database

**Cần kiểm tra:**

1. **Có phải user `banghh` có bài nộp trong `training_assignment_submissions`?**
   ```sql
   SELECT tas.*, tva.video_id
   FROM training_assignment_submissions tas
   INNER JOIN training_video_assignments tva ON tva.id = tas.assignment_id
   WHERE tas.teacher_code = 'banghh'
     AND (tas.status = 'graded' OR (tas.submitted_at IS NOT NULL AND tas.status IN ('submitted', 'graded')));
   ```
   
   **Nếu có bài nộp** → `hasPlatformQuizEvidenceForVideo = true` → `completion_status = 'completed'` ✅

2. **Có phải video có `duration_seconds = 0` hoặc `NULL`?**
   ```sql
   SELECT id, title, duration_minutes, duration_seconds
   FROM training_videos
   WHERE status = 'active';
   ```
   
   **Nếu duration = 0** → có thể có bug trong logic fallback

3. **Có phải có record cũ với `completion_status = 'completed'` đã bị xóa?**
   - Kiểm tra logs
   - Kiểm tra migration history

### ✅ Giả Thuyết 4: Bug Trong Logic Grouping

**Kiểm tra:**
```typescript
// app/api/training-db/route.ts
const hasQuizEvidenceForLesson = sourceIds.some((id) =>
  quizEvidenceVideoIds.has(id),
);
```

**Nếu:**
- Video A có `video_group_id = 'group1'`
- Video B có `video_group_id = 'group1'`
- User `banghh` có bài nộp cho Video B
- → Video A cũng sẽ hiển thị `completed` ❌ BUG!

**Kịch bản:**
```
Video 1 (id=1, group_id='abc') ← không có record
Video 2 (id=2, group_id='abc') ← có bài nộp
→ Cả 2 video đều hiển thị 'completed' vì cùng group!
```

### ✅ Giả Thuyết 5: Bug Trong Query Quiz Evidence

**Kiểm tra:**
```typescript
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
```

**Nếu:**
- Query này trả về **TẤT CẢ video_id** mà user đã nộp bài
- Nhưng logic grouping làm cho **tất cả video trong cùng group** đều được đánh dấu completed
- → BUG!

## 🔍 Cách Debug

### Bước 1: Kiểm Tra Database
```sql
-- 1. Kiểm tra user banghh có record không
SELECT * FROM training_teacher_video_scores WHERE teacher_code = 'banghh';

-- 2. Kiểm tra user banghh có bài nộp không
SELECT tas.*, tva.video_id, tva.assignment_title
FROM training_assignment_submissions tas
INNER JOIN training_video_assignments tva ON tva.id = tas.assignment_id
WHERE tas.teacher_code = 'banghh';

-- 3. Kiểm tra video grouping
SELECT id, title, video_group_id, chunk_index, duration_seconds
FROM training_videos
WHERE status = 'active'
ORDER BY video_group_id, chunk_index;
```

### Bước 2: Thêm Console Log
```typescript
// app/api/training-db/route.ts
console.log('[DEBUG banghh] scoresMap:', Array.from(scoresMap.entries()));
console.log('[DEBUG banghh] quizEvidenceVideoIds:', Array.from(quizEvidenceVideoIds));
console.log('[DEBUG banghh] lessons:', lessons.map(l => ({
  id: l.id,
  name: l.name,
  completion_status: l.completion_status,
  score: l.score,
  time_spent: l.time_spent_seconds
})));
```

### Bước 3: Kiểm Tra Response API
```bash
# Call API với user banghh
curl -X GET "http://localhost:3000/api/training-db?code=banghh" \
  -H "Authorization: Bearer <token>" | jq
```

## 🎯 Nguyên Nhân Có Thể

### Nguyên Nhân 1: Video Grouping Bug ⭐ MOST LIKELY
```typescript
// Nếu user có bài nộp cho 1 video trong group
// → TẤT CẢ video trong group đều hiển thị 'completed'

const hasQuizEvidenceForLesson = sourceIds.some((id) =>
  quizEvidenceVideoIds.has(id),
);

// BUG: Nếu sourceIds = [1, 2, 3] và quizEvidenceVideoIds = [2]
// → hasQuizEvidenceForLesson = true
// → Cả 3 video đều 'completed'!
```

### Nguyên Nhân 2: Duration = 0 Bug
```typescript
// Nếu video không có duration_seconds
const ratioOk = dur > 0
  ? cappedWatch >= dur * 0.9
  : cappedWatch >= 120  // Fallback: cần xem ít nhất 120 giây

// Nhưng nếu watched = 0 và dur = 0
// → ratioOk = false
// → watchOk = false
// → Kết quả: 'not_started' ✅ ĐÚNG
```

### Nguyên Nhân 3: Cache Bug
```typescript
// Frontend có thể đang cache data cũ
const { data: trainingData } = useSWR(
  teacher && user ? `/api/training-db?code=${submitCode}` : null,
  secureFetcher,
  {
    revalidateOnFocus: true,
    dedupingInterval: 30000,  // ← Cache 30 giây
  }
);
```

## 🔧 Cách Fix

### Fix 1: Tách Riêng Quiz Evidence Cho Từng Video
```typescript
// Thay vì check toàn bộ group, check từng video riêng lẻ
const hasQuizEvidenceForThisVideo = quizEvidenceVideoIds.has(video.id);

// Chỉ video có bài nộp mới được đánh dấu 'completed'
const effective = effectiveVideoCompletionFromRaw({
  // ...
  hasPlatformQuizEvidenceForVideo: hasQuizEvidenceForThisVideo,  // ← Chỉ video này
  // ...
});
```

### Fix 2: Validate Duration
```typescript
// Đảm bảo video có duration hợp lệ
if (durationSeconds <= 0) {
  console.warn(`[Training DB] Video ${video.id} has invalid duration`);
  // Không cho phép 'watched' nếu không có duration
}
```

### Fix 3: Clear Cache
```typescript
// Thêm timestamp vào cache key
const { data: trainingData } = useSWR(
  teacher && user 
    ? `/api/training-db?code=${submitCode}&t=${Date.now()}` 
    : null,
  secureFetcher
);
```

## 📋 Action Items

1. ✅ Kiểm tra database: `SELECT * FROM training_teacher_video_scores WHERE teacher_code = 'banghh'`
2. ✅ Kiểm tra bài nộp: `SELECT * FROM training_assignment_submissions WHERE teacher_code = 'banghh'`
3. ✅ Thêm console log vào API `/api/training-db`
4. ✅ Test với user khác không có record
5. ✅ Fix bug nếu tìm thấy

---

**Ngày tạo:** 2026-05-14  
**Người tạo:** Kiro AI Assistant
