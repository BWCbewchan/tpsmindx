DO $$ BEGIN
  CREATE TYPE exam_type_enum AS ENUM ('expertise', 'experience');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE registration_type_enum AS ENUM ('official', 'additional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assignment_status_enum AS ENUM ('assigned', 'in_progress', 'submitted', 'expired', 'graded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE explanation_status_enum AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE question_type_enum AS ENUM ('multiple_choice', 'true_false', 'short_answer', 'essay');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS exam_subject_catalog (
  id BIGSERIAL PRIMARY KEY,
  exam_type exam_type_enum NOT NULL,
  block_code VARCHAR(50) NOT NULL,
  subject_code VARCHAR(100) NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_exam_subject UNIQUE (exam_type, block_code, subject_code)
);

CREATE INDEX IF NOT EXISTS idx_exam_subject_active
  ON exam_subject_catalog (is_active);

CREATE TABLE IF NOT EXISTS exam_sets (
  id BIGSERIAL PRIMARY KEY,
  subject_id BIGINT NOT NULL REFERENCES exam_subject_catalog(id) ON DELETE RESTRICT,
  set_code VARCHAR(100) NOT NULL,
  set_name VARCHAR(255) NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  total_points NUMERIC(6,2) NOT NULL CHECK (total_points > 0),
  passing_score NUMERIC(6,2) NOT NULL CHECK (passing_score >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  valid_from TIMESTAMP NULL,
  valid_to TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_exam_set_code UNIQUE (subject_id, set_code),
  CONSTRAINT ck_exam_set_valid_range CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_exam_sets_subject_status
  ON exam_sets (subject_id, status);

CREATE INDEX IF NOT EXISTS idx_exam_sets_valid_time
  ON exam_sets (valid_from, valid_to);

CREATE TABLE IF NOT EXISTS exam_set_questions (
  id BIGSERIAL PRIMARY KEY,
  set_id BIGINT NOT NULL REFERENCES exam_sets(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type question_type_enum NOT NULL DEFAULT 'multiple_choice',
  options JSONB NULL,
  correct_answer TEXT NULL,
  explanation TEXT NULL,
  points NUMERIC(6,2) NOT NULL DEFAULT 1.00 CHECK (points >= 0),
  order_number INTEGER NOT NULL CHECK (order_number > 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_exam_question_order UNIQUE (set_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_exam_questions_set
  ON exam_set_questions (set_id);

CREATE TABLE IF NOT EXISTS exam_registrations (
  id BIGSERIAL PRIMARY KEY,
  teacher_code VARCHAR(50) NOT NULL REFERENCES training_teacher_stats(teacher_code) ON DELETE RESTRICT,
  exam_type exam_type_enum NOT NULL,
  registration_type registration_type_enum NOT NULL,
  block_code VARCHAR(50) NOT NULL,
  subject_code VARCHAR(100) NOT NULL,
  center_code VARCHAR(255) NULL,
  scheduled_at TIMESTAMP NOT NULL,
  source_form VARCHAR(50) NOT NULL CHECK (source_form IN ('main_form','additional_form','system')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exam_reg_teacher
  ON exam_registrations (teacher_code, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_reg_subject
  ON exam_registrations (exam_type, block_code, subject_code);

CREATE TABLE IF NOT EXISTS teacher_exam_assignments (
  id BIGSERIAL PRIMARY KEY,
  registration_id BIGINT NOT NULL REFERENCES exam_registrations(id) ON DELETE CASCADE,
  teacher_code VARCHAR(50) NOT NULL REFERENCES training_teacher_stats(teacher_code) ON DELETE RESTRICT,
  exam_type exam_type_enum NOT NULL,
  registration_type registration_type_enum NOT NULL,
  block_code VARCHAR(50) NOT NULL,
  subject_code VARCHAR(100) NOT NULL,
  selected_set_id BIGINT NOT NULL REFERENCES exam_sets(id) ON DELETE RESTRICT,
  random_seed VARCHAR(100) NULL,
  random_assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  open_at TIMESTAMP NOT NULL,
  close_at TIMESTAMP NOT NULL,
  assignment_status assignment_status_enum NOT NULL DEFAULT 'assigned',
  score NUMERIC(6,2) NULL,
  score_status VARCHAR(20) NOT NULL DEFAULT 'null' CHECK (score_status IN ('null','auto_zero','graded')),
  expired_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_assignment_time CHECK (close_at > open_at),
  CONSTRAINT uq_assignment_registration UNIQUE (registration_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_exam_assignments_teacher
  ON teacher_exam_assignments (teacher_code, assignment_status);

CREATE INDEX IF NOT EXISTS idx_teacher_exam_assignments_close_at
  ON teacher_exam_assignments (close_at);

CREATE INDEX IF NOT EXISTS idx_teacher_exam_assignments_subject
  ON teacher_exam_assignments (exam_type, block_code, subject_code);

CREATE TABLE IF NOT EXISTS teacher_exam_submissions (
  id BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL REFERENCES teacher_exam_assignments(id) ON DELETE CASCADE,
  teacher_code VARCHAR(50) NOT NULL REFERENCES training_teacher_stats(teacher_code) ON DELETE RESTRICT,
  started_at TIMESTAMP NULL,
  submitted_at TIMESTAMP NULL,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  raw_score NUMERIC(6,2) NULL,
  percentage NUMERIC(6,2) NULL CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
  is_passed BOOLEAN NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','graded','auto_closed')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_submission_assignment UNIQUE (assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_exam_submissions_teacher
  ON teacher_exam_submissions (teacher_code, status);

CREATE TABLE IF NOT EXISTS teacher_exam_answers (
  id BIGSERIAL PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES teacher_exam_submissions(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES exam_set_questions(id) ON DELETE RESTRICT,
  answer_text TEXT NULL,
  is_correct BOOLEAN NULL,
  points_earned NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
  answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_submission_question UNIQUE (submission_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_exam_answers_submission
  ON teacher_exam_answers (submission_id);

CREATE TABLE IF NOT EXISTS exam_explanations (
  id BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL REFERENCES teacher_exam_assignments(id) ON DELETE CASCADE,
  teacher_code VARCHAR(50) NOT NULL REFERENCES training_teacher_stats(teacher_code) ON DELETE RESTRICT,
  teacher_name VARCHAR(255) NOT NULL,
  teacher_email VARCHAR(255) NULL,
  center_code VARCHAR(255) NULL,
  subject_code VARCHAR(100) NOT NULL,
  test_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status explanation_status_enum NOT NULL DEFAULT 'pending',
  admin_note TEXT NULL,
  admin_email VARCHAR(255) NULL,
  admin_name VARCHAR(255) NULL,
  decided_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_exam_explanation_assignment UNIQUE (assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_explanations_teacher
  ON exam_explanations (teacher_code, status);

CREATE INDEX IF NOT EXISTS idx_exam_explanations_created_at
  ON exam_explanations (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_explanations_pending_per_assignment
  ON exam_explanations (assignment_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS exam_assignment_events (
  id BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL REFERENCES teacher_exam_assignments(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'assigned',
    'started',
    'submitted',
    'expired_auto_zero',
    'graded',
    'explanation_created',
    'explanation_accepted',
    'explanation_rejected'
  )),
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('system','teacher','admin')),
  actor_code VARCHAR(100) NULL,
  payload JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exam_assignment_events_assignment
  ON exam_assignment_events (assignment_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_exam_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exam_subject_catalog_updated_at ON exam_subject_catalog;
CREATE TRIGGER trg_exam_subject_catalog_updated_at
BEFORE UPDATE ON exam_subject_catalog
FOR EACH ROW EXECUTE FUNCTION set_exam_updated_at();

DROP TRIGGER IF EXISTS trg_exam_sets_updated_at ON exam_sets;
CREATE TRIGGER trg_exam_sets_updated_at
BEFORE UPDATE ON exam_sets
FOR EACH ROW EXECUTE FUNCTION set_exam_updated_at();

DROP TRIGGER IF EXISTS trg_exam_set_questions_updated_at ON exam_set_questions;
CREATE TRIGGER trg_exam_set_questions_updated_at
BEFORE UPDATE ON exam_set_questions
FOR EACH ROW EXECUTE FUNCTION set_exam_updated_at();

DROP TRIGGER IF EXISTS trg_exam_registrations_updated_at ON exam_registrations;
CREATE TRIGGER trg_exam_registrations_updated_at
BEFORE UPDATE ON exam_registrations
FOR EACH ROW EXECUTE FUNCTION set_exam_updated_at();

DROP TRIGGER IF EXISTS trg_teacher_exam_assignments_updated_at ON teacher_exam_assignments;
CREATE TRIGGER trg_teacher_exam_assignments_updated_at
BEFORE UPDATE ON teacher_exam_assignments
FOR EACH ROW EXECUTE FUNCTION set_exam_updated_at();

DROP TRIGGER IF EXISTS trg_teacher_exam_submissions_updated_at ON teacher_exam_submissions;
CREATE TRIGGER trg_teacher_exam_submissions_updated_at
BEFORE UPDATE ON teacher_exam_submissions
FOR EACH ROW EXECUTE FUNCTION set_exam_updated_at();

DROP TRIGGER IF EXISTS trg_exam_explanations_updated_at ON exam_explanations;
CREATE TRIGGER trg_exam_explanations_updated_at
BEFORE UPDATE ON exam_explanations
FOR EACH ROW EXECUTE FUNCTION set_exam_updated_at();
