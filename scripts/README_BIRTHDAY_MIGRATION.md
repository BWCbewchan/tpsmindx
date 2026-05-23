# Migration: Đổi mặc định hiển thị sinh nhật từ "Bật" sang "Tắt"

## Tổng quan

Migration này thay đổi giá trị mặc định của cột `show_birthday` trong bảng `teacher_privacy_settings` từ `true` sang `false`.

## Các thay đổi đã thực hiện

### 1. Code Changes (Đã hoàn thành)

- ✅ **app/api/teacher-privacy/route.ts**
  - Dòng 44: Đổi giá trị mặc định khi tạo mới record từ `true` → `false`
  - Dòng 113: Đổi fallback value trong upsert từ `true` → `false`

- ✅ **scripts/create_teacher_privacy_settings_table.sql**
  - Dòng 6: Đổi `DEFAULT true` → `DEFAULT false` cho cột `show_birthday`

### 2. Database Migration (Cần chạy)

Để áp dụng thay đổi vào database hiện tại, chạy lệnh sau:

```bash
node scripts/run-update-birthday-default.js
```

## Chi tiết Migration

### Ảnh hưởng

- **User mới**: Sẽ có `show_birthday = false` (Tắt) theo mặc định
- **User hiện tại**: Giữ nguyên cài đặt hiện tại (không bị thay đổi)

### Nếu muốn cập nhật tất cả user hiện tại

Nếu bạn muốn đổi tất cả user hiện có từ "Bật" sang "Tắt", hãy:

1. Mở file `scripts/update_show_birthday_default.sql`
2. Bỏ comment (uncomment) các dòng sau:

```sql
UPDATE teacher_privacy_settings 
SET show_birthday = false, updated_at = CURRENT_TIMESTAMP
WHERE show_birthday = true;
```

3. Chạy lại migration:

```bash
node scripts/run-update-birthday-default.js
```

⚠️ **Cảnh báo**: Thao tác này sẽ ảnh hưởng đến TẤT CẢ user hiện có!

## Kiểm tra kết quả

Sau khi chạy migration, script sẽ hiển thị:

1. ✅ Trạng thái kết nối database
2. ✅ Kết quả thực thi migration
3. ✅ Giá trị mặc định mới của cột
4. ✅ Thống kê số lượng user có birthday enabled/disabled

## Rollback (Nếu cần)

Nếu cần quay lại giá trị mặc định cũ (`true`), chạy:

```sql
ALTER TABLE teacher_privacy_settings 
ALTER COLUMN show_birthday SET DEFAULT true;
```

## Ghi chú

- Migration này an toàn và không ảnh hưởng đến dữ liệu hiện có
- Chỉ thay đổi giá trị mặc định cho record mới
- User có thể tự bật/tắt trong trang Profile bất cứ lúc nào
