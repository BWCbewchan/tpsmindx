# Implementation Tasks — HR Onboarding Training

## Tasks

- [x] 1. Database migration — tạo 3 bảng mới
  - [x] 1.1 Thêm migration V66 vào `lib/migrations.ts` với SQL tạo bảng `hr_candidates`, `hr_training_sessions`, `hr_candidate_training_records`
  - [x] 1.2 Thêm `ALTER TABLE teachers ADD COLUMN IF NOT EXISTS source VARCHAR(50)` vào migration
  - [x] 1.3 Thêm triggers `updated_at` cho 3 bảng mới
  - [x] 1.4 Thêm `INSERT INTO app_permissions` cho route `/admin/hr-onboarding` với super_admin

- [-] 2. Utility functions — pure functions cho business logic
  - [x] 2.1 Tạo `lib/hr-onboarding-utils.ts` với các hàm: `calculateAttendanceScore(attended, total)`, `calculateAvgTestScore(scores)`, `clampScore(score)`
  - [x] 2.2 Tạo `parseCsvRow`, `validateCsvRow` để xử lý CSV import
  - [x] 2.3 Tạo `mapCandidateToTeacher` để map fields khi promote
  - [ ] 2.4 Viết property-based tests cho các hàm trên dùng fast-check (Properties 12, 14, 15)

- [x] 3. API — Quản lý ứng viên (`/api/hr/onboarding/candidates`)
  - [x] 3.1 `GET` — danh sách ứng viên với pagination, filter gen_id/status/region_code, search
  - [x] 3.2 `POST` — tạo ứng viên thủ công, validate duplicate (email, gen_id)
  - [x] 3.3 `PATCH` — cập nhật fields cho phép (full_name, phone, desired_campus, work_block, subject_code)
  - [x] 3.4 `DELETE` — xóa ứng viên, từ chối nếu status in_training/passed/failed
  - [x] 3.5 `POST /api/hr/onboarding/candidates/import` — CSV import với summary response

- [x] 4. API — Quản lý buổi training (`/api/hr/onboarding/sessions`)
  - [x] 4.1 `GET` — lấy danh sách sessions theo gen_id, sorted by session_number ASC
  - [x] 4.2 `POST` — tạo session, validate session_number [1-4] và unique (gen_id, session_number)
  - [x] 4.3 `PATCH` — cập nhật title, session_date, video_id

- [x] 5. API — Ghi nhận điểm danh/điểm (`/api/hr/onboarding/records`)
  - [x] 5.1 `GET` — lấy records theo gen_id hoặc session_id, kèm candidateSummaries
  - [x] 5.2 `PATCH` — batch upsert records, clamp score, auto-update candidate status new→in_training

- [x] 6. API — Promote ứng viên (`/api/hr/onboarding/promote`)
  - [x] 6.1 `POST` — đổi status passed/failed/dropped, ghi updated_by_email
  - [x] 6.2 Khi status=passed: insert vào `teachers` (full_name, work_email, main_centre, course_line, status=Active, source=hr_onboarding)
  - [x] 6.3 Xử lý trường hợp teacher đã tồn tại (matched by email) — trả về teacherAlreadyExists=true

- [x] 7. UI — Dashboard `/admin/hr-onboarding`
  - [x] 7.1 Tạo page với danh sách GEN, filter theo region_code
  - [x] 7.2 Hiển thị summary stats: tổng ứng viên, count by status, avg attendance score, avg test score
  - [x] 7.3 Form thêm ứng viên thủ công (modal) — Tích hợp vào `/admin/hr-candidates/gen-planner` tab "Đào tạo đầu vào"
  - [ ] 7.4 CSV import UI: upload file, hiển thị summary kết quả

- [x] 8. UI — Chi tiết GEN `/admin/hr-onboarding/[gen]`
  - [x] 8.1 Tạo page với bảng điểm danh: cột name/email + 4 buổi (✓/✗ + điểm) + attendance_score + avg_score + status
  - [x] 8.2 Form tạo/sửa Training Sessions (tối đa 4 buổi)
  - [x] 8.3 Inline edit điểm danh và điểm kiểm tra từng ô, batch save
  - [x] 8.4 Nút đổi trạng thái ứng viên (passed/failed/dropped) với confirm dialog
  - [x] 8.5 Hiển thị placeholder khi chưa có sessions
  - [x] 8.6 Tích hợp vào `/admin/hr-candidates/gen-planner` tab "Đào tạo đầu vào"

- [ ] 9. Property-based tests
  - [ ] 9.1 Property 3: CSV import filters invalid rows
  - [ ] 9.2 Property 5: Pagination size invariant
  - [ ] 9.3 Property 11: Training record upsert idempotence
  - [ ] 9.4 Property 17: Promote idempotence (no duplicate teachers)
  - [ ] 9.5 Property 21 & 22: Access control 401/403
