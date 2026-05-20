# 🔴 CRITICAL BUG FIX - Summary

## Vấn Đề
User `banghh` (và các users khác) có thể **làm bài tập mà chưa xem video** nếu có bài nộp cũ trong database.

## Nguyên Nhân
Logic trong `effectiveVideoCompletionFromRaw()` **KHÔNG VALIDATE** watch progress khi có `hasPlatformQuizEvidenceForVideo = true`.

```typescript
// Code cũ (BUG):
if (raw === 'completed' || input.hasPlatformQuizEvidenceForVideo) {
  return { completion_status: 'completed', completed_at: completedAtStr }
  // ❌ Không check hasTmsWatchHeartbeat
  // ❌ Không check mergedWatchedSeconds
}
```

## Giải Pháp
Thêm validation để đảm bảo user **ĐÃ XEM ĐỦ 90% VIDEO** trước khi cho phép `completion_status = 'completed'`.

```typescript
// Code mới (FIXED):
if (input.hasPlatformQuizEvidenceForVideo) {
  if (raw === 'completed') {
    return { completion_status: 'completed', completed_at: completedAtStr }
  }
  
  // ✅ Validate watch progress
  const watchOk = input.hasTmsWatchHeartbeat && ratioOk
  
  if (watchOk) {
    return { completion_status: 'completed', completed_at: completedAtStr }
  }
  
  // ❌ Chưa xem đủ → không cho phép completed
  if (watched > 0) {
    return { completion_status: 'in_progress', completed_at: null }
  }
  
  return { completion_status: 'not_started', completed_at: null }
}
```

## Files Changed
1. ✅ `lib/training-effective-video-completion.ts` - Fixed validation logic
2. ✅ `app/api/training-db/route.ts` - No changes needed (uses fixed function)

## Testing Required
1. Test với user `banghh` - không có record trong `training_teacher_video_scores`
2. Test với user có bài nộp nhưng chưa xem video
3. Test với user đã xem đủ video và có bài nộp
4. Test với user chưa xem video và không có bài nộp

## Expected Behavior After Fix

| Scenario | Watch Progress | Has Submission | Expected Status |
|----------|---------------|----------------|-----------------|
| Chưa xem, có bài nộp cũ | 0% | ✅ | `not_started` ❌ Không thể làm bài |
| Xem 50%, có bài nộp | 50% | ✅ | `in_progress` ❌ Không thể làm bài |
| Xem 95%, có bài nộp | 95% | ✅ | `completed` ✅ Có thể làm bài |
| Xem 95%, không có bài nộp | 95% | ❌ | `watched` ✅ Có thể làm bài |
| Chưa xem, không có bài nộp | 0% | ❌ | `not_started` ❌ Không thể làm bài |

## Deployment
```bash
# 1. Commit changes
git add lib/training-effective-video-completion.ts
git commit -m "fix: validate watch progress before allowing quiz completion"

# 2. Push to staging
git push origin staging

# 3. Test on staging
# 4. Deploy to production
git push origin main
```

## Verification Query
```sql
-- Kiểm tra users bị ảnh hưởng
SELECT 
  tvs.teacher_code,
  tvs.video_id,
  tvs.completion_status,
  tvs.server_time_seconds,
  tv.duration_seconds,
  ROUND(tvs.server_time_seconds::numeric / NULLIF(tv.duration_seconds, 0) * 100, 2) as watch_percentage
FROM training_teacher_video_scores tvs
JOIN training_videos tv ON tv.id = tvs.video_id
WHERE tvs.completion_status = 'completed'
  AND tvs.server_time_seconds < tv.duration_seconds * 0.9
ORDER BY watch_percentage ASC;
```

---

**Status:** ✅ FIXED  
**Date:** 2026-05-14  
**Severity:** CRITICAL 🔴
