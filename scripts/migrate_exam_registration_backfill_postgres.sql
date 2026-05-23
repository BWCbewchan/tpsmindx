-- =========================================================
-- Backfill dữ liệu cũ -> schema mới exam_* (PostgreSQL)
--
-- Nguồn cũ dùng:
--   - explanations (bảng giải trình cũ)
--
-- Đích mới:
--   - exam_subject_catalog
--   - exam_sets
--   - exam_registrations
--   - teacher_exam_assignments
--   - teacher_exam_submissions
--   - exam_explanations
--
-- Lưu ý:
-- 1) Chỉ migrate các bản ghi có lms_code tồn tại trong training_teacher_stats.teacher_code
-- 2) Các bản ghi còn lại được liệt kê ở cuối script để xử lý thủ công
-- 3) assignment backfill được đánh dấu score=0, score_status='auto_zero', status='expired'
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- A) Seed subject catalog từ explanations cũ
-- ---------------------------------------------------------
WITH legacy_subjects AS (
  SELECT DISTINCT
    CASE
      WHEN e.subject ILIKE '[ROB]%' THEN 'ROBOTICS'
      WHEN e.subject ILIKE '[ART]%' THEN 'ART'
      WHEN e.subject ILIKE '[Trial]%' THEN 'TRIAL'
      ELSE 'CODING'
    END AS block_code,
    UPPER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(COALESCE(e.subject, 'UNKNOWN'), '^\[[^\]]+\]\s*', ''),
        '[^A-Za-z0-9]+', '_', 'g'
      )
    ) AS subject_code,
    COALESCE(NULLIF(e.subject, ''), 'UNKNOWN') AS subject_name
  FROM explanations e
  WHERE COALESCE(e.subject, '') <> ''
)
INSERT INTO exam_subject_catalog (exam_type, block_code, subject_code, subject_name, is_active)
SELECT 'expertise'::exam_type_enum, ls.block_code, ls.subject_code, ls.subject_name, TRUE
FROM legacy_subjects ls
ON CONFLICT (exam_type, block_code, subject_code) DO UPDATE
SET
  subject_name = EXCLUDED.subject_name,
  updated_at = CURRENT_TIMESTAMP;

-- ---------------------------------------------------------
-- B) Tạo bộ đề legacy cho từng môn để phục vụ mapping assignment
-- ---------------------------------------------------------
INSERT INTO exam_sets (
  subject_id,
  set_code,
  set_name,
  duration_minutes,
  total_points,
  passing_score,
  status,
  valid_from,
  valid_to
)
SELECT
  esc.id,
  'LEGACY-' || esc.subject_code AS set_code,
  'Legacy Set - ' || esc.subject_name AS set_name,
  30,
  10.00,
  7.00,
  'active',
  NULL,
  NULL
FROM exam_subject_catalog esc
WHERE esc.exam_type = 'expertise'
ON CONFLICT (subject_id, set_code) DO NOTHING;

-- ---------------------------------------------------------
-- C) Backfill registration + assignment + submission + explanation
-- ---------------------------------------------------------
WITH src AS (
  SELECT
    e.id AS legacy_explanation_id,
    e.teacher_name,
    e.lms_code AS teacher_code,
    e.email AS teacher_email,
    e.campus AS center_code,
    e.subject AS raw_subject,
    e.test_date,
    e.reason,
    e.status AS legacy_status,
    e.admin_note,
    e.admin_email,
    e.admin_name,
    e.created_at,
    e.updated_at,
    e.id AS source_key,
    CASE
      WHEN e.subject ILIKE '[ROB]%' THEN 'ROBOTICS'
      WHEN e.subject ILIKE '[ART]%' THEN 'ART'
      WHEN e.subject ILIKE '[Trial]%' THEN 'TRIAL'
      ELSE 'CODING'
    END AS block_code,
    UPPER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(COALESCE(e.subject, 'UNKNOWN'), '^\[[^\]]+\]\s*', ''),
        '[^A-Za-z0-9]+', '_', 'g'
      )
    ) AS subject_code
  FROM explanations e
),
valid_src AS (
  SELECT s.*
  FROM src s
  INNER JOIN training_teacher_stats tts
    ON LOWER(TRIM(tts.teacher_code)) = LOWER(TRIM(s.teacher_code))
),
ins_reg AS (
  INSERT INTO exam_registrations (
    teacher_code,
    exam_type,
    registration_type,
    block_code,
    subject_code,
    center_code,
    scheduled_at,
    source_form,
    created_at,
    updated_at
  )
  SELECT
    vs.teacher_code,
    'expertise'::exam_type_enum,
    'official'::registration_type_enum,
    vs.block_code,
    vs.subject_code,
    vs.center_code,
    COALESCE(vs.test_date::timestamp, vs.created_at),
    'system',
    vs.created_at,
    vs.updated_at
  FROM valid_src vs
  ON CONFLICT DO NOTHING
  RETURNING id, teacher_code, subject_code, scheduled_at, created_at
),
reg_map AS (
  SELECT
    vs.source_key,
    er.id AS registration_id,
    vs.teacher_code,
    vs.subject_code,
    vs.created_at,
    vs.updated_at,
    vs.test_date,
    vs.legacy_status,
    vs.admin_note,
    vs.admin_email,
    vs.admin_name,
    vs.teacher_name,
    vs.teacher_email,
    vs.center_code,
    vs.reason,
    vs.raw_subject
  FROM valid_src vs
  JOIN exam_registrations er
    ON er.teacher_code = vs.teacher_code
   AND er.subject_code = vs.subject_code
   AND er.scheduled_at = COALESCE(vs.test_date::timestamp, vs.created_at)
),
ins_assignment AS (
  INSERT INTO teacher_exam_assignments (
    registration_id,
    teacher_code,
    exam_type,
    registration_type,
    block_code,
    subject_code,
    selected_set_id,
    random_seed,
    random_assigned_at,
    open_at,
    close_at,
    assignment_status,
    score,
    score_status,
    expired_at,
    created_at,
    updated_at
  )
  SELECT
    rm.registration_id,
    rm.teacher_code,
    'expertise'::exam_type_enum,
    'official'::registration_type_enum,
    esc.block_code,
    rm.subject_code,
    es.id,
    'legacy-backfill-' || rm.source_key,
    rm.created_at,
    COALESCE(rm.test_date::timestamp, rm.created_at),
    COALESCE(rm.test_date::timestamp, rm.created_at) + INTERVAL '1 day',
    'expired'::assignment_status_enum,
    0,
    'auto_zero',
    rm.updated_at,
    rm.created_at,
    rm.updated_at
  FROM reg_map rm
  JOIN exam_subject_catalog esc
    ON esc.exam_type = 'expertise'
   AND esc.subject_code = rm.subject_code
  JOIN exam_sets es
    ON es.subject_id = esc.id
   AND es.set_code = 'LEGACY-' || esc.subject_code
  ON CONFLICT (registration_id) DO NOTHING
  RETURNING id, registration_id, teacher_code, created_at, updated_at
),
assignment_map AS (
  SELECT
    rm.*,
    tea.id AS assignment_id
  FROM reg_map rm
  JOIN teacher_exam_assignments tea
    ON tea.registration_id = rm.registration_id
),
ins_submission AS (
  INSERT INTO teacher_exam_submissions (
    assignment_id,
    teacher_code,
    started_at,
    submitted_at,
    time_spent_seconds,
    raw_score,
    percentage,
    is_passed,
    status,
    created_at,
    updated_at
  )
  SELECT
    am.assignment_id,
    am.teacher_code,
    NULL,
    am.updated_at,
    0,
    0,
    0,
    FALSE,
    'auto_closed',
    am.created_at,
    am.updated_at
  FROM assignment_map am
  ON CONFLICT (assignment_id) DO NOTHING
  RETURNING id
),
ins_explanations AS (
  INSERT INTO exam_explanations (
    assignment_id,
    teacher_code,
    teacher_name,
    teacher_email,
    center_code,
    subject_code,
    test_date,
    reason,
    status,
    admin_note,
    admin_email,
    admin_name,
    decided_at,
    created_at,
    updated_at
  )
  SELECT
    am.assignment_id,
    am.teacher_code,
    am.teacher_name,
    am.teacher_email,
    am.center_code,
    am.subject_code,
    am.test_date,
    am.reason,
    CASE am.legacy_status
      WHEN 'accepted' THEN 'accepted'::explanation_status_enum
      WHEN 'rejected' THEN 'rejected'::explanation_status_enum
      ELSE 'pending'::explanation_status_enum
    END,
    am.admin_note,
    am.admin_email,
    am.admin_name,
    CASE
      WHEN am.legacy_status IN ('accepted', 'rejected') THEN am.updated_at
      ELSE NULL
    END,
    am.created_at,
    am.updated_at
  FROM assignment_map am
  ON CONFLICT (assignment_id) DO NOTHING
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM valid_src) AS migrated_source_rows,
  (SELECT COUNT(*) FROM ins_reg) AS inserted_registrations,
  (SELECT COUNT(*) FROM ins_assignment) AS inserted_assignments,
  (SELECT COUNT(*) FROM ins_submission) AS inserted_submissions,
  (SELECT COUNT(*) FROM ins_explanations) AS inserted_exam_explanations;

COMMIT;

-- ---------------------------------------------------------
-- D) Bản ghi cũ bị bỏ qua do không tìm thấy teacher_code trong training_teacher_stats
-- ---------------------------------------------------------
SELECT
  e.id,
  e.teacher_name,
  e.lms_code,
  e.email,
  e.subject,
  e.test_date,
  e.status
FROM explanations e
LEFT JOIN training_teacher_stats tts
  ON LOWER(TRIM(tts.teacher_code)) = LOWER(TRIM(e.lms_code))
WHERE tts.teacher_code IS NULL
ORDER BY e.created_at DESC;
