# Requirements Document

## Introduction

Tính năng **Đào tạo đầu vào (HR Onboarding Training)** cho phép HR/quản lý quản lý toàn bộ vòng đời đào tạo ứng viên mới: từ nhập liệu ứng viên, gán vào GEN, theo dõi 4 buổi training (điểm danh + điểm kiểm tra), đánh giá chuyên cần, đến quyết định pass/fail và chuyển ứng viên đạt sang bảng `teachers`.

Hệ thống hiện tại đã có: `hr_gen_catalog`, `hr_candidate_gen_assignments`, `training_videos`, `teachers`, `hr_gen_attendance_records`. Tính năng mới bổ sung bảng `hr_candidates` (nguồn dữ liệu chính thức thay thế Google Sheet cho luồng onboarding), `hr_training_sessions`, và `hr_candidate_training_records`.

Flow ưu tiên: **HR/quản lý** — luồng ứng viên tự đăng nhập sẽ được phát triển sau.

---

## Glossary

- **HR_System**: Hệ thống quản lý đào tạo đầu vào (ứng dụng Next.js hiện tại)
- **HR_Manager**: Người dùng có quyền HR hoặc super_admin trong hệ thống
- **Candidate**: Ứng viên đang trong quá trình đào tạo đầu vào
- **GEN**: Nhóm đào tạo (ví dụ: GEN-2024-01), được quản lý trong `hr_gen_catalog`
- **Training_Session**: Một buổi training trong GEN, đánh số từ 1 đến 4
- **Training_Record**: Bản ghi điểm danh và điểm kiểm tra của một Candidate trong một Training_Session
- **Attendance_Score**: Điểm chuyên cần, tính theo tỷ lệ số buổi có mặt / tổng số buổi
- **Pass_Threshold**: Ngưỡng điểm để HR đánh giá ứng viên đạt (do HR quyết định thủ công)
- **CSV_Import**: Tính năng nhập danh sách ứng viên từ file CSV
- **Candidate_Status**: Trạng thái của ứng viên: `new` | `in_training` | `passed` | `failed` | `dropped`

---

## Requirements

### Requirement 1: Quản lý danh sách ứng viên

**User Story:** As an HR_Manager, I want to add and manage candidates manually or via CSV import, so that I can maintain an accurate list of candidates for onboarding training.

#### Acceptance Criteria

1. THE HR_System SHALL provide a form for HR_Manager to create a Candidate with the fields: full_name, email, phone, region_code, desired_campus, work_block, subject_code, gen_id, source (`manual`).
2. WHEN an HR_Manager submits a valid candidate creation form, THE HR_System SHALL save the Candidate to the `hr_candidates` table with status `new` and record the `created_by_email`.
3. IF the submitted email already exists in `hr_candidates` for the same gen_id, THEN THE HR_System SHALL return a validation error indicating a duplicate candidate.
4. THE HR_System SHALL provide a CSV import feature that accepts a UTF-8 encoded file with columns: full_name, email, phone, region_code, desired_campus, work_block, subject_code, gen_id.
5. WHEN an HR_Manager imports a valid CSV file, THE HR_System SHALL parse each row, skip rows with missing full_name or email, and insert valid rows with source `csv` and status `new`.
6. WHEN a CSV import completes, THE HR_System SHALL return a summary containing: total rows processed, rows inserted, rows skipped, and reasons for skipped rows.
7. THE HR_System SHALL display the candidate list with pagination (default 25 per page, max 200), filterable by gen_id, status, region_code, and searchable by name/email/phone.
8. WHEN an HR_Manager updates a Candidate's fields (full_name, phone, desired_campus, work_block, subject_code), THE HR_System SHALL save the changes and record the updated_at timestamp.
9. IF an HR_Manager attempts to delete a Candidate with status `in_training`, `passed`, or `failed`, THEN THE HR_System SHALL reject the deletion and return an error message.

---

### Requirement 2: Quản lý buổi training (Training Sessions)

**User Story:** As an HR_Manager, I want to define training sessions for each GEN, so that I can track attendance and scores per session.

#### Acceptance Criteria

1. THE HR_System SHALL allow HR_Manager to create up to 4 Training_Sessions per GEN, each with: gen_id, session_number (1–4), title, session_date, and an optional video_id referencing `training_videos`.
2. WHEN an HR_Manager creates a Training_Session with a duplicate (gen_id, session_number) combination, THE HR_System SHALL reject the request and return a conflict error.
3. THE HR_System SHALL display all Training_Sessions for a given GEN ordered by session_number ascending.
4. WHEN an HR_Manager updates a Training_Session's title, session_date, or video_id, THE HR_System SHALL save the changes and update the updated_at timestamp.
5. IF an HR_Manager attempts to create a Training_Session with session_number outside the range 1–4, THEN THE HR_System SHALL return a validation error.

---

### Requirement 3: Ghi nhận điểm danh và điểm kiểm tra

**User Story:** As an HR_Manager, I want to record attendance and test scores for each candidate per session, so that I can track training progress accurately.

#### Acceptance Criteria

1. THE HR_System SHALL allow HR_Manager to record a Training_Record for each (candidate_id, session_id) pair with fields: attendance (boolean), score (decimal 0–10), recorded_by_email.
2. WHEN an HR_Manager submits a Training_Record for an existing (candidate_id, session_id) pair, THE HR_System SHALL update the existing record (upsert) and update the updated_at timestamp.
3. IF a submitted score value is outside the range 0–10, THEN THE HR_System SHALL clamp the value to the nearest boundary (0 or 10) before saving.
4. THE HR_System SHALL support batch upsert of Training_Records for all candidates in a GEN for a given session in a single API call.
5. WHEN a Training_Record is saved for a Candidate with status `new`, THE HR_System SHALL automatically update the Candidate's status to `in_training`.
6. THE HR_System SHALL calculate and return the Attendance_Score for each Candidate as: (number of sessions with attendance = true) / (total sessions in GEN) × 10, rounded to 2 decimal places.
7. THE HR_System SHALL calculate and return the average test score for each Candidate across all sessions where a score has been recorded.

---

### Requirement 4: Đánh giá pass/fail và chuyển sang teachers

**User Story:** As an HR_Manager, I want to mark candidates as passed or failed and promote passed candidates to the teachers table, so that the onboarding pipeline is complete.

#### Acceptance Criteria

1. THE HR_System SHALL allow HR_Manager to change a Candidate's status to `passed`, `failed`, or `dropped` via an explicit status update action.
2. WHEN an HR_Manager sets a Candidate's status to `passed`, THE HR_System SHALL insert a corresponding record into the `teachers` table using the Candidate's full_name, email, work_block, subject_code, and desired_campus as the main_centre.
3. WHEN a Candidate is promoted to `teachers`, THE HR_System SHALL set the teacher's status to `Active` and record the source as `hr_onboarding`.
4. IF a Candidate with status `passed` already exists in the `teachers` table (matched by email), THEN THE HR_System SHALL skip the insert and return a notice that the teacher record already exists.
5. WHEN an HR_Manager sets a Candidate's status to `failed` or `dropped`, THE HR_System SHALL record the status change without modifying the `teachers` table.
6. THE HR_System SHALL record the email of the HR_Manager who performed the status change in the `hr_candidates` table.

---

### Requirement 5: Dashboard tổng quan GEN training

**User Story:** As an HR_Manager, I want to see a summary dashboard for each GEN, so that I can monitor overall training progress at a glance.

#### Acceptance Criteria

1. THE HR_System SHALL display per-GEN summary statistics including: total candidates, count by status (new/in_training/passed/failed/dropped), average attendance score, and average test score.
2. THE HR_System SHALL display per-session statistics for a GEN including: session title, session date, attendance count, and average score for that session.
3. WHEN an HR_Manager filters the dashboard by region_code, THE HR_System SHALL recalculate and display statistics scoped to the selected region.
4. THE HR_System SHALL display the candidate list within a GEN with columns: name, email, attendance per session (✓/✗), score per session, attendance score, average score, and current status.
5. WHEN no Training_Sessions have been created for a GEN, THE HR_System SHALL display a placeholder message indicating that sessions have not been set up yet.

---

### Requirement 6: Phân quyền truy cập

**User Story:** As a system administrator, I want access to the onboarding training module to be restricted to authorized HR roles, so that candidate data is protected.

#### Acceptance Criteria

1. THE HR_System SHALL restrict all candidate management and training record APIs to users with role `super_admin` or permission route `/admin/hr-onboarding`.
2. WHEN an unauthenticated request is made to any onboarding training API, THE HR_System SHALL return HTTP 401.
3. WHEN an authenticated user without the required role or permission accesses an onboarding training API, THE HR_System SHALL return HTTP 403 with a descriptive error message in Vietnamese.
4. THE HR_System SHALL reuse the existing `requireBearerSession` and `withApiProtection` middleware for all new API routes.
