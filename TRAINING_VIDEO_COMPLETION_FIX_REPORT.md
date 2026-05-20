# Báo Cáo: Sửa Logic Hoàn Thành Video Đào Tạo Nâng Cao

## Vấn Đề
Người dùng chưa có điểm bài kiểm tra (chưa làm bài hoặc chưa đạt) nhưng vẫn được hiển thị là "Hoàn thành" và có thể làm bài kiểm tra ngay sau khi xem xong video.

## Nguyên Nhân
Logic cũ gộp chung hai điều kiện vào trạng thái `completed`:
1. Đã xem đủ 90% video + có heartbeat từ TMS
2. Đã có bài nộp kiểm tra đạt (>= 7 điểm)

Điều này dẫn đến nhầm lẫn: người dùng mới xem xong video đã được coi là "Hoàn thành" mặc dù chưa làm bài kiểm tra.

## Giải Pháp
Phân tách rõ ràng 4 trạng thái cho `completion_status`:
- `not_started`: Chưa bắt đầu
- `in_progress`: Đang xem (chưa đủ 90%)
- `watched`: **MỚI** - Đã xem đủ 90% video, có thể làm bài kiểm tra
- `completed`: Đã đạt bài kiểm tra (điểm >= 7)

## Các Thay Đổi Đã Thực Hiện

### 1. Database Migration (lib/migrations.ts)
**File**: `lib/migrations.ts`
**Thay đổi**: Thêm migration V43
```typescript
{
  name: 'V43_add_watched_status_to_training',
  version: 43,
  sql: `
    -- Cập nhật ràng buộc CHECK để hỗ trợ trạng thái 'watched'
    ALTER TABLE training_teacher_video_scores 
    DROP CONSTRAINT IF EXISTS training_teacher_video_scores_completion_status_check;
    
    ALTER TABLE training_teacher_video_scores 
    ADD CONSTRAINT training_teacher_video_scores_completion_status_check 
    CHECK (completion_status IN ('not_started', 'in_progress', 'watched', 'completed'));

    -- Sửa dữ liệu cũ: chuyển 'completed' nhưng chưa có điểm sang 'watched'
    UPDATE training_teacher_video_scores
    SET completion_status = 'watched'
    WHERE completion_status = 'completed' AND (score IS NULL OR score < 7);
  `,
}
```

### 2. Logic Tính Toán Hiệu Dụng (lib/training-effective-video-completion.ts)
**File**: `lib/training-effective-video-completion.ts`
**Thay đổi**: Cập nhật hàm `effectiveVideoCompletionFromRaw`

**Trước**:
```typescript
// Gộp chung: xem đủ video HOẶC có quiz evidence → 'completed'
const watchOk = quizOk || (input.hasTmsWatchHeartbeat && ratioOk)
if (watchOk) {
  return { completion_status: 'completed', completed_at: completedAtStr }
}
```

**Sau**:
```typescript
// Phân tách rõ ràng:
// 1. Có quiz evidence → 'completed'
if (raw === 'completed' || input.hasPlatformQuizEvidenceForVideo) {
  return { completion_status: 'completed', completed_at: completedAtStr }
}

// 2. Xem đủ video + có heartbeat → 'watched'
const watchOk = input.hasTmsWatchHeartbeat && ratioOk
if (watchOk) {
  return { completion_status: 'watched', completed_at: completedAtStr }
}
```

### 3. API Lưu Tiến Độ Xem Video (app/api/training-progress/route.ts)
**File**: `app/api/training-progress/route.ts`
**Thay đổi**: Khi xem đủ 90% video, chỉ đánh dấu là `watched` thay vì `completed`

```typescript
// Trước: validatedIsCompleted ? 'completed' : ...
// Sau: validatedIsCompleted ? 'watched' : ...
const statusParam = validatedIsCompleted
  ? 'watched'  // ← Thay đổi ở đây
  : (clampedServerTime > 0 ? 'in_progress' : 'not_started');
```

**Thêm logic giữ nguyên trạng thái**:
```sql
completion_status = CASE
  WHEN training_teacher_video_scores.completion_status = 'completed' THEN 'completed'
  WHEN training_teacher_video_scores.completion_status = 'watched' THEN 'watched'
  ELSE $4::text
END
```

### 4. API Kiểm Tra Điều Kiện Làm Bài (app/api/training-submissions/route.ts)
**File**: `app/api/training-submissions/route.ts`

#### 4a. Cho phép làm bài khi đã xem video
**Thay đổi**: Kiểm tra điều kiện trong POST handler
```typescript
// Trước: if (effective.completion_status !== 'completed')
// Sau: if (!['watched', 'completed'].includes(effective.completion_status))
if (!['watched', 'completed'].includes(effective.completion_status)) {
  return NextResponse.json(
    { error: `Bạn cần hoàn thành xem video "${videoTitle}" trước khi làm bài tập này.` },
    { status: 403 }
  );
}
```

#### 4b. Cập nhật trạng thái khi chấm điểm
**Thay đổi**: Trong PUT handler (action: 'grade')
```typescript
// Chỉ chuyển sang 'completed' khi đạt điểm, không đạt thì giữ nguyên
const updateVideoScoreQuery = `
  ...
  DO UPDATE SET
    score = GREATEST(training_teacher_video_scores.score, $3),
    completion_status = CASE 
      WHEN training_teacher_video_scores.completion_status = 'completed' THEN 'completed'
      WHEN $4::boolean THEN 'completed'  -- Chỉ khi đạt
      ELSE training_teacher_video_scores.completion_status  -- Giữ nguyên (watched)
    END,
    ...
`;
```

### 5. Giao Diện Người Dùng (app/user/training/page.tsx)
**File**: `app/user/training/page.tsx`

#### 5a. Thêm biến trạng thái mới
```typescript
const isCompleted = lesson.completion_status === 'completed'
const isWatched = lesson.completion_status === 'watched'
const canTakeQuiz = isCompleted || isWatched  // Cho phép làm bài khi đã xem
```

#### 5b. Cập nhật hiển thị nhãn trạng thái
```typescript
<span className={`... ${
  isCompleted
    ? 'bg-green-100 text-green-800'
    : isWatched
      ? 'bg-blue-100 text-blue-800'  // Màu xanh dương cho "Đã xem"
      : ...
}`}>
  {isCompleted
    ? '✓ Hoàn thành'
    : isWatched
      ? '👁️ Đã xem'  // Nhãn mới
      : ...
  }
</span>
```

#### 5c. Cập nhật màu viền card
```typescript
className={`... ${
  isCompleted
    ? 'border-green-300 bg-green-50/30'
    : isWatched
      ? 'border-blue-300 bg-blue-50/30'  // Màu xanh nhạt cho "Đã xem"
      : 'border-gray-200'
}`}
```

#### 5d. Cập nhật nút làm bài kiểm tra
```typescript
<button
  onClick={(e) => {
    e.stopPropagation()
    if (canTakeQuiz) {  // Thay vì isCompleted
      router.push(`/user/dao-tao-nang-cao?start_assignment_id=${assignment.id}`)
    } else {
      toast.error('Bạn cần hoàn thành xem video bài học trước...')
    }
  }}
  className={canTakeQuiz ? 'bg-[#a1001f] ...' : 'bg-gray-100 ...'}
>
  Làm bài kiểm tra
  {!canTakeQuiz && <span>(Cần xem hết video)</span>}
</button>
```

## Luồng Hoạt Động Mới

### Kịch Bản 1: Người dùng xem video lần đầu
1. Bắt đầu xem → `in_progress`
2. Xem đủ 90% → `watched` (màu xanh dương, nhãn "👁️ Đã xem")
3. Nút "Làm bài kiểm tra" được kích hoạt
4. Làm bài và đạt (>= 7 điểm) → `completed` (màu xanh lá, nhãn "✓ Hoàn thành")

### Kịch Bản 2: Người dùng làm bài nhưng không đạt
1. Trạng thái: `watched`
2. Làm bài, điểm < 7 → Vẫn giữ `watched`
3. Có thể làm lại bài kiểm tra
4. Làm lại và đạt → `completed`

### Kịch Bản 3: Dữ liệu cũ (đã có trong DB)
- Migration V43 tự động sửa: `completed` + điểm < 7 → `watched`
- Đảm bảo tính nhất quán dữ liệu

## Kiểm Tra Sau Khi Deploy

### 1. Kiểm tra Database
```sql
-- Xem phân bố trạng thái
SELECT completion_status, COUNT(*) 
FROM training_teacher_video_scores 
GROUP BY completion_status;

-- Kiểm tra dữ liệu bất thường
SELECT * FROM training_teacher_video_scores 
WHERE completion_status = 'completed' AND (score IS NULL OR score < 7);
```

### 2. Kiểm tra Giao diện
- [ ] Xem video đến 90% → Hiển thị "👁️ Đã xem" (màu xanh dương)
- [ ] Nút "Làm bài kiểm tra" được kích hoạt sau khi xem xong
- [ ] Làm bài và đạt → Hiển thị "✓ Hoàn thành" (màu xanh lá)
- [ ] Làm bài không đạt → Vẫn hiển thị "👁️ Đã xem", có thể làm lại
- [ ] Progress bar chỉ đếm bài `completed` (đã đạt điểm)

### 3. Kiểm tra API
```bash
# Test xem video
curl -X POST /api/training-progress \
  -H "Content-Type: application/json" \
  -d '{"teacherCode":"banghh","videoId":1,"timeSpent":540,"isCompleted":true}'

# Kiểm tra response: completion_status = 'watched'

# Test làm bài kiểm tra
curl -X POST /api/training-submissions \
  -H "Content-Type: application/json" \
  -d '{"teacher_code":"banghh","assignment_id":1}'

# Kiểm tra: Cho phép nếu video_completion_status = 'watched' hoặc 'completed'
```

## Tác Động

### Tích Cực
✅ Phân biệt rõ ràng "đã xem video" vs "đã hoàn thành (có điểm)"
✅ Người dùng hiểu rõ tiến độ của mình
✅ Khuyến khích làm bài kiểm tra để đạt trạng thái "Hoàn thành"
✅ Dữ liệu thống kê chính xác hơn (chỉ đếm bài đã đạt điểm)

### Cần Lưu Ý
⚠️ Migration V43 sẽ chạy tự động khi restart app
⚠️ Dữ liệu cũ sẽ được cập nhật (completed → watched nếu chưa có điểm)
⚠️ Cần thông báo cho người dùng về thay đổi giao diện

## Tổng Kết
Đã hoàn thành việc sửa logic hoàn thành video đào tạo nâng cao với 5 file được cập nhật:
1. ✅ `lib/migrations.ts` - Migration V43
2. ✅ `lib/training-effective-video-completion.ts` - Logic tính toán
3. ✅ `app/api/training-progress/route.ts` - API lưu tiến độ
4. ✅ `app/api/training-submissions/route.ts` - API kiểm tra & chấm điểm
5. ✅ `app/user/training/page.tsx` - Giao diện người dùng

Hệ thống giờ đây phân biệt rõ ràng giữa "đã xem video" và "đã hoàn thành (có điểm đạt)", giúp người dùng và quản trị viên theo dõi tiến độ chính xác hơn.
