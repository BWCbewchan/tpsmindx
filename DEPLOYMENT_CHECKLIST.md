# Checklist Triển Khai: Sửa Logic Hoàn Thành Video

## Trước Khi Deploy

### 1. Kiểm Tra Code
- [x] Migration V43 đã được thêm vào `lib/migrations.ts`
- [x] Logic `effectiveVideoCompletionFromRaw` đã được cập nhật
- [x] API `/api/training-progress` đã cập nhật trạng thái `watched`
- [x] API `/api/training-submissions` đã cho phép làm bài khi `watched`
- [x] UI đã hiển thị đúng nhãn "👁️ Đã xem" và "✓ Hoàn thành"
- [ ] Build thành công không có lỗi TypeScript
- [ ] Không có lỗi ESLint

### 2. Backup Database
```bash
# Backup bảng training_teacher_video_scores trước khi deploy
pg_dump -h <host> -U <user> -d <database> \
  -t training_teacher_video_scores \
  --data-only \
  > backup_training_scores_$(date +%Y%m%d_%H%M%S).sql
```

### 3. Kiểm Tra Môi Trường
- [ ] Database connection string đúng
- [ ] Có quyền ALTER TABLE trên database
- [ ] Đủ dung lượng để chạy migration

## Trong Quá Trình Deploy

### 1. Deploy Code
```bash
# Pull code mới
git pull origin main

# Install dependencies (nếu cần)
npm install

# Build
npm run build

# Restart application
pm2 restart tms-mindx
# hoặc
systemctl restart tms-mindx
```

### 2. Theo Dõi Migration
```bash
# Xem log migration
tail -f /var/log/tms-mindx/app.log | grep -i migration

# Hoặc xem console output
pm2 logs tms-mindx --lines 100
```

**Kết quả mong đợi**:
```
🔄 Running database migrations...
  ✅ Migration applied: V43_add_watched_status_to_training (v43)
✅ Applied 1 migration(s).
```

### 3. Kiểm Tra Migration Thành Công
```sql
-- 1. Kiểm tra constraint mới
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'training_teacher_video_scores'::regclass 
  AND conname LIKE '%completion_status%';

-- Kết quả mong đợi: CHECK (completion_status IN ('not_started', 'in_progress', 'watched', 'completed'))

-- 2. Kiểm tra dữ liệu đã được cập nhật
SELECT completion_status, COUNT(*) as count
FROM training_teacher_video_scores
GROUP BY completion_status
ORDER BY completion_status;

-- 3. Kiểm tra không còn bản ghi bất thường
SELECT COUNT(*) as invalid_records
FROM training_teacher_video_scores
WHERE completion_status = 'completed' 
  AND (score IS NULL OR score < 7);

-- Kết quả mong đợi: 0
```

## Sau Khi Deploy

### 1. Kiểm Tra Chức Năng Cơ Bản

#### Test Case 1: Xem Video Mới
**Bước thực hiện**:
1. Đăng nhập với tài khoản `banghh`
2. Vào trang "Đào tạo nâng cao"
3. Chọn một video chưa xem
4. Xem video đến 90%

**Kết quả mong đợi**:
- [ ] Trạng thái chuyển sang "👁️ Đã xem" (màu xanh dương)
- [ ] Card có viền xanh dương nhạt
- [ ] Nút "Làm bài kiểm tra" được kích hoạt (màu đỏ)

#### Test Case 2: Làm Bài Kiểm Tra Và Đạt
**Bước thực hiện**:
1. Từ video có trạng thái "👁️ Đã xem"
2. Click "Làm bài kiểm tra"
3. Hoàn thành bài kiểm tra với điểm >= 7

**Kết quả mong đợi**:
- [ ] Có thể vào làm bài (không bị chặn)
- [ ] Sau khi nộp bài, trạng thái chuyển sang "✓ Hoàn thành" (màu xanh lá)
- [ ] Card có viền xanh lá nhạt
- [ ] Progress bar tăng lên (đếm thêm 1 bài hoàn thành)

#### Test Case 3: Làm Bài Kiểm Tra Nhưng Không Đạt
**Bước thực hiện**:
1. Từ video có trạng thái "👁️ Đã xem"
2. Click "Làm bài kiểm tra"
3. Hoàn thành bài kiểm tra với điểm < 7

**Kết quả mong đợi**:
- [ ] Trạng thái vẫn là "👁️ Đã xem" (không chuyển sang "Hoàn thành")
- [ ] Vẫn có thể làm lại bài kiểm tra
- [ ] Progress bar không tăng

#### Test Case 4: Video Chưa Xem Hết
**Bước thực hiện**:
1. Chọn video mới
2. Xem chưa đến 90%
3. Click vào nút "Làm bài kiểm tra"

**Kết quả mong đợi**:
- [ ] Nút bị disable (màu xám)
- [ ] Hiển thị text "(Cần xem hết video)"
- [ ] Click vào hiển thị toast error: "Bạn cần hoàn thành xem video..."

### 2. Kiểm Tra Dữ Liệu Cũ

#### Test với tài khoản `banghh`
```sql
-- Kiểm tra trạng thái hiện tại của banghh
SELECT 
  v.title,
  tvs.completion_status,
  tvs.score,
  tvs.time_spent_seconds,
  tvs.server_time_seconds
FROM training_teacher_video_scores tvs
JOIN training_videos v ON v.id = tvs.video_id
WHERE tvs.teacher_code = 'banghh'
ORDER BY v.lesson_number;
```

**Kết quả mong đợi**:
- [ ] Các video đã xem nhưng chưa có điểm → `watched`
- [ ] Các video đã có điểm >= 7 → `completed`
- [ ] Các video chưa xem → `not_started` hoặc `in_progress`

### 3. Kiểm Tra API

#### Test API Training Progress
```bash
# Lấy token từ browser (F12 > Application > Local Storage > token)
TOKEN="your_token_here"

# Test lưu tiến độ xem video
curl -X POST https://your-domain.com/api/training-progress \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teacherCode": "banghh",
    "videoId": 1,
    "timeSpent": 540,
    "isCompleted": true,
    "totalDuration": 600
  }'
```

**Kết quả mong đợi**:
```json
{
  "success": true,
  "data": {
    "completion_status": "watched",  // ← Phải là "watched", không phải "completed"
    "time_spent_seconds": 540,
    ...
  }
}
```

#### Test API Training Submissions
```bash
# Test bắt đầu làm bài (video đã xem)
curl -X POST https://your-domain.com/api/training-submissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teacher_code": "banghh",
    "assignment_id": 1,
    "teacher_info": {
      "full_name": "Bang HH",
      "center": "HN1",
      "teaching_block": "Coding"
    }
  }'
```

**Kết quả mong đợi**:
- [ ] Status 201 (Created) nếu video đã xem
- [ ] Status 403 (Forbidden) nếu video chưa xem, với message: "Bạn cần hoàn thành xem video..."

### 4. Kiểm Tra Performance

```sql
-- Kiểm tra query performance
EXPLAIN ANALYZE
SELECT 
  a.*, 
  v.title as video_title,
  tvs.completion_status as video_completion_status
FROM training_video_assignments a
LEFT JOIN training_videos v ON a.video_id = v.id
LEFT JOIN training_teacher_video_scores tvs 
  ON v.id = tvs.video_id AND tvs.teacher_code = 'banghh'
WHERE a.video_id IS NOT NULL
ORDER BY v.lesson_number ASC;
```

**Kết quả mong đợi**:
- [ ] Execution time < 100ms
- [ ] Sử dụng index đúng cách

### 5. Kiểm Tra Thống Kê

```sql
-- Thống kê tổng quan sau migration
SELECT 
  completion_status,
  COUNT(*) as total,
  COUNT(CASE WHEN score >= 7 THEN 1 END) as passed,
  AVG(score) as avg_score,
  AVG(time_spent_seconds) as avg_time_seconds
FROM training_teacher_video_scores
GROUP BY completion_status
ORDER BY 
  CASE completion_status
    WHEN 'completed' THEN 1
    WHEN 'watched' THEN 2
    WHEN 'in_progress' THEN 3
    WHEN 'not_started' THEN 4
  END;
```

**Kết quả mong đợi**:
```
completion_status | total | passed | avg_score | avg_time_seconds
------------------+-------+--------+-----------+-----------------
completed         |   150 |    150 |      8.5  |           1200
watched           |    45 |      0 |      0.0  |            900
in_progress       |    30 |      0 |      0.0  |            300
not_started       |   275 |      0 |      0.0  |              0
```

## Rollback Plan (Nếu Có Vấn Đề)

### 1. Rollback Code
```bash
# Quay về commit trước
git reset --hard HEAD~1

# Rebuild và restart
npm run build
pm2 restart tms-mindx
```

### 2. Rollback Database
```bash
# Restore từ backup
psql -h <host> -U <user> -d <database> < backup_training_scores_YYYYMMDD_HHMMSS.sql

# Xóa migration record
psql -h <host> -U <user> -d <database> -c \
  "DELETE FROM _migrations WHERE name = 'V43_add_watched_status_to_training';"
```

### 3. Rollback Constraint
```sql
-- Khôi phục constraint cũ
ALTER TABLE training_teacher_video_scores 
DROP CONSTRAINT IF EXISTS training_teacher_video_scores_completion_status_check;

ALTER TABLE training_teacher_video_scores 
ADD CONSTRAINT training_teacher_video_scores_completion_status_check 
CHECK (completion_status IN ('not_started', 'in_progress', 'completed'));
```

## Thông Báo Người Dùng

### Email/Thông Báo Nội Bộ
```
Tiêu đề: Cập nhật hệ thống Đào tạo nâng cao

Kính gửi các thầy cô,

Hệ thống Đào tạo nâng cao đã được cập nhật với các cải tiến sau:

1. Phân biệt rõ ràng trạng thái:
   - "👁️ Đã xem": Đã xem xong video, có thể làm bài kiểm tra
   - "✓ Hoàn thành": Đã làm bài kiểm tra và đạt điểm >= 7

2. Tiến độ hoàn thành chính xác hơn:
   - Chỉ tính những bài đã đạt điểm kiểm tra
   - Khuyến khích hoàn thành bài kiểm tra để đạt 100%

3. Giao diện trực quan hơn:
   - Màu xanh dương: Đã xem video
   - Màu xanh lá: Hoàn thành (có điểm đạt)

Trân trọng,
Ban Quản trị
```

## Checklist Tổng Hợp

### Pre-Deploy
- [ ] Code review hoàn tất
- [ ] Backup database
- [ ] Thông báo downtime (nếu cần)

### Deploy
- [ ] Deploy code thành công
- [ ] Migration chạy thành công
- [ ] Application khởi động bình thường

### Post-Deploy
- [ ] Test Case 1: Xem video mới ✓
- [ ] Test Case 2: Làm bài và đạt ✓
- [ ] Test Case 3: Làm bài không đạt ✓
- [ ] Test Case 4: Video chưa xem hết ✓
- [ ] Kiểm tra dữ liệu cũ ✓
- [ ] Kiểm tra API ✓
- [ ] Kiểm tra performance ✓
- [ ] Kiểm tra thống kê ✓

### Communication
- [ ] Thông báo người dùng về thay đổi
- [ ] Cập nhật tài liệu hướng dẫn
- [ ] Ghi nhận feedback từ người dùng

## Liên Hệ Hỗ Trợ
Nếu gặp vấn đề trong quá trình deploy, liên hệ:
- Dev Team: [email/slack channel]
- On-call: [phone number]
