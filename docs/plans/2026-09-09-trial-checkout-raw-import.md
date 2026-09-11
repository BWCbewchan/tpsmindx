# Trial checkout raw import

## Mục tiêu

Đưa dữ liệu trial checkout/evaluation từ workbook `Data_trial_raw.xlsx` vào Supabase đầy đủ, giữ được dữ liệu gốc để audit và tạo nền tảng cho các báo cáo hoặc mapping nghiệp vụ sau này.

Skill đã áp dụng:

- `spreadsheets:Spreadsheets` để đọc, phân tích workbook `.xlsx` và xác định sheet/cột/dòng dữ liệu.

## Nguồn dữ liệu

- File nguồn: `C:\Users\ASUS\Downloads\Data_trial_raw.xlsx`
- Workbook có 5 sheet: `Dashboard`, `Sheet1`, `Theo khối`, `Theo cơ sở`, `Theo môn`.
- Sheet dữ liệu chính: `Sheet1`.
- Số dòng dữ liệu chính: 16.005 dòng, chưa tính header.
- Số cột dữ liệu chính: 32 cột.
- Khoá tự nhiên của nguồn: cột `Id`; trong lần kiểm tra ngày 2026-09-09 có đủ 16.005 giá trị và không trùng.

Các sheet `Theo khối`, `Theo cơ sở`, `Theo môn` là sheet tổng hợp/pivot từ dữ liệu chính, chưa import thành bảng riêng. Nếu cần báo cáo, ưu tiên tính lại từ `trial_checkout_raw` để tránh lệch số khi dữ liệu raw thay đổi.

## Bảng Supabase

Bảng raw canonical: `trial_checkout_raw`.

View truy vấn theo tên cột Excel: `trial_checkout`.

Bảng `trial_checkout_raw` cũng là nơi append form checkout mới do giáo viên gửi từ `/user/checkout/create`; view `trial_checkout` tiếp tục expose đúng tên cột Excel.

Migration bảng raw: `migrations/V107_trial_checkout_raw.sql`.

Migration view tên cột Excel: `migrations/V108_trial_checkout_excel_view.sql`.

Script import: `scripts/import_trial_checkout_raw.js`.

Trạng thái import ngày 2026-09-09:

- Đã tạo/đảm bảo schema trên Supabase.
- Đã import/upsert 16.005 dòng từ `Sheet1`.
- Verify DB: 16.005 dòng, 16.005 `raw_id` distinct, 0 `raw_payload` rỗng.
- Phân bổ `Khối` trong DB khớp workbook: Coding 6.360, Robotics 6.220, Art 3.425.
- Phân bổ `Chốt case` trong DB khớp workbook: Pass 11.711, Fail 697, `4 tháng` 386, `1:1` 106, trống 3.105.

Trạng thái view ngày 2026-09-09:

- Đã tạo/replace `trial_checkout` trên Supabase bằng `scripts/apply_trial_checkout_excel_view.js`.
- Verify view: 16.005 dòng.
- Verify cột: đủ 32 cột theo header Excel, không expose hậu tố/prefix `raw` ở lớp view.

Điều chỉnh ngày 2026-09-09:

- Form checkout mới không dùng bảng phụ; API append vào `trial_checkout_raw`.
- Nếu bảng phụ `trial_checkout_submissions` đã từng được tạo trong Supabase từ lần thử trước, code hiện tại không còn sử dụng. Không drop tự động để tránh phá schema ngoài ý muốn.

Chạy kiểm tra không ghi DB:

```bash
node scripts/import_trial_checkout_raw.js --dry-run
```

Chạy import thật:

```bash
node scripts/import_trial_checkout_raw.js
```

Script tự tạo/đảm bảo schema từ migration rồi upsert theo `raw_id`, nên chạy lại không nhân đôi dữ liệu.

## Luồng dữ liệu

```text
Data_trial_raw.xlsx / Sheet1
  -> scripts/import_trial_checkout_raw.js
  -> kiểm tra header, bỏ dòng trống, validate Id và tên giáo viên
  -> parse ngày/giờ, parse điểm số, giữ text gốc
  -> Supabase public.trial_checkout_raw
  -> Supabase public.trial_checkout view với header Excel
  -> truy vấn/báo cáo nội bộ hoặc mapping sang bảng nghiệp vụ sau này
```

Luồng dữ liệu form mới:

```text
app/user/checkout/create
  -> /api/user/checkout/forms POST
  -> validate session, Phase 1, rubric Phase 2, chốt case Phase 3
  -> tính lại total_score trên server
  -> sinh publicToken và public URL /public/checkout/[token]
  -> Supabase public.trial_checkout_raw
  -> Supabase public.trial_checkout view thấy dòng mới theo 32 cột Excel
  -> app/user/checkout/manage qua /api/user/checkout/forms GET
  -> người dùng bấm Link để mở trang public dạng phiếu đánh giá
```

Các lớp dữ liệu:

1. Input: workbook Excel tải từ nguồn trial checkout/evaluation.
2. Validate/Normalize: script kiểm tra shape 32 cột, `Id`, `Timestamp`, không trùng `Id`, không thiếu tên giáo viên; parse ngày và điểm.
3. Processing: mapping theo vị trí cột của `Sheet1` sang tên cột snake_case trong DB.
4. Storage: bảng `trial_checkout_raw` lưu cột chuẩn hóa và `raw_payload jsonb`.
5. Output: `trial_checkout_raw` cho audit/import; `trial_checkout` cho truy vấn theo tên cột Excel, thống kê, mapping teacher/center hoặc API sau này.
6. Audit: `source_file`, `source_sheet`, `source_row_number`, `raw_payload`, `imported_at`, `updated_at`.

## Mapping cột

| Cột Excel | Cột DB | Kiểu DB | Ghi chú |
| --- | --- | --- | --- |
| `Id` | `raw_id` | `bigint` | Primary key/idempotency key từ nguồn. |
| `Timestamp` | `timestamp_raw`, `timestamp_at` | `text`, `timestamp` | Giữ text gốc và parse timestamp không timezone theo wall-clock trong file. |
| `Tên giáo viên Trial` | `trial_teacher_name` | `text` | Bắt buộc theo dữ liệu hiện tại. |
| `Tên sale phụ trách` | `sales_owner_name` | `text` | Có thể trống. |
| `Họ tên học viên` | `student_name` | `text` | PII, có 1 dòng trống trong file hiện tại. |
| `Tuổi` | `student_age_label` | `text` | Là nhãn tuổi/lớp, không ép số. |
| `Ngày trải nghiệm` | `trial_date_raw`, `trial_date` | `text`, `date` | Giữ text gốc và parse date. |
| `Khối` | `track` | `text` | Giá trị quan sát: Coding, Robotics, Art. |
| `Môn trải nghiệm` | `trial_subject` | `text` | Mã/tên môn trial. |
| `Cơ sở` | `center_name` | `text` | Tên cơ sở dạng text, chưa FK sang `centers`. |
| `HT1`..`GT2` | `ht1`..`gt2` | `numeric(5,2)` | Nhóm điểm rubric chung/Coding/PreB, cho phép null. |
| `ROB4B-1`..`ROB4B-4` | `rob4b_1`..`rob4b_4` | `numeric(5,2)` | Nhóm điểm ROB4B, cho phép null. |
| `ART4+1`..`ART4+5` | `art4p_1`..`art4p_5` | `numeric(5,2)` | Nhóm điểm Art, cho phép null. |
| `Tổng điểm` | `total_score` | `numeric(5,2)` | Điểm tổng/trung bình theo file, cho phép null. |
| `Chốt case` | `case_result` | `text` | Giá trị quan sát: Pass, Fail, `4 tháng`, `1:1`, hoặc trống. |
| `Nhận xét chung` | `general_comment` | `text` | Nhận xét tự do, có PII/ngữ cảnh học viên. |
| `Link` | `evidence_link` | `text` | Dữ liệu import giữ link gốc; form mới lưu public URL `/public/checkout/[token]` để gửi/xem phiếu. Trang quản lý luôn mở bản render phiếu qua `/public/checkout/[token-or-id]`. |
| Toàn bộ dòng | `raw_payload` | `jsonb` | Lưu các giá trị gốc theo header Excel. |

## View `trial_checkout`

`trial_checkout` la view doc tu `trial_checkout_raw` va expose 32 cot dung theo header Excel:

`Id`, `Timestamp`, `Tên giáo viên Trial`, `Tên sale phụ trách`, `Họ tên học viên`, `Tuổi`, `Ngày trải nghiệm`, `Khối`, `Môn trải nghiệm`, `Cơ sở`, `HT1`, `HT2`, `HT3`, `ST1`, `ST2`, `LG1`, `LG2`, `GT1`, `GT2`, `ROB4B-1`, `ROB4B-2`, `ROB4B-3`, `ROB4B-4`, `ART4+1`, `ART4+2`, `ART4+3`, `ART4+4`, `ART4+5`, `Tổng điểm`, `Chốt case`, `Nhận xét chung`, `Link`.

Ly do khong doi ten truc tiep cot trong bang raw: import script va audit layer can ten cot on dinh, con view giup UI/API/report dung dung ten Excel ma khong pha idempotent import.

## Tổng quan dữ liệu ngày 2026-09-09

- `Id`: từ 68 đến 16.203, không trùng.
- `Ngày trải nghiệm`: từ 2006-05-31 đến 2026-12-07 theo dữ liệu file.
- `Timestamp`: từ 2025-01-06 đến 2026-12-08 theo dữ liệu file.
- `Tổng điểm`: 15.854 dòng có điểm, min 1, max 5, trung bình khoảng 3,485.
- Theo `Khối`: Coding 6.360, Robotics 6.220, Art 3.425.
- Theo `Chốt case`: Pass 11.711, Fail 697, `4 tháng` 386, `1:1` 106, trống 3.105.
- Cột `Link` có 3 giá trị không phải HTTP/HTTPS; vẫn import nguyên trạng để không mất dữ liệu gốc.

## Ràng buộc

- Theo yêu cầu nghiệp vụ ngày 2026-09-09, giáo viên được xem toàn bộ form checkout đã gửi sẵn qua API quản lý form.
- Form mới ghi tiếp vào `trial_checkout_raw` để không tách khỏi bảng checkout cũ; `source_file = teacher-checkout-form`, `source_sheet = app/user/checkout/create`, `raw_payload.source = teacher-checkout-form`.
- Public page không list dữ liệu; form mới mở bằng `raw_payload.publicToken`, dữ liệu import cũ mở từ trang quản lý bằng `raw_id`.
- Khi xây API/UI trên dữ liệu này, phải lọc theo role và center-scope theo `docs/CENTER_BASED_ACCESS.md`; `center_name` hiện là text nên cần bước mapping sang `centers` trước khi dùng làm phân quyền cứng.
- Không FK `trial_teacher_name` sang `teachers` trong bảng raw vì file chỉ có tên, chưa có teacher code/email ổn định. Mapping teacher nên làm ở bảng/phần xử lý riêng.
- Các cột điểm cho phép null vì mỗi môn dùng bộ tiêu chí khác nhau.
- Check constraint chỉ giới hạn điểm chuẩn hóa trong khoảng 0-5; các dị thường khác được giữ trong raw để xử lý sau.
- Ngày bất thường và link không hợp lệ không bị sửa trong raw import. Nếu cần báo cáo chính thức, tạo bước data quality/cleaning riêng.

## Kiểm tra sau import

Query verify tối thiểu:

```sql
SELECT
  COUNT(*) AS row_count,
  MIN(raw_id) AS min_raw_id,
  MAX(raw_id) AS max_raw_id,
  MIN(trial_date) AS min_trial_date,
  MAX(trial_date) AS max_trial_date,
  COUNT(*) FILTER (WHERE total_score IS NOT NULL) AS total_score_count,
  COUNT(*) FILTER (
    WHERE evidence_link IS NOT NULL AND evidence_link !~* '^https?://'
  ) AS invalid_link_count
FROM trial_checkout_raw;
```
