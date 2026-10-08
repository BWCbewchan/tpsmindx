CREATE TABLE IF NOT EXISTS facility_evaluations (
  id BIGSERIAL PRIMARY KEY,
  form_month VARCHAR(7) NOT NULL CHECK (form_month ~ '^[0-9]{4}-[0-9]{2}$'),
  center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL,
  center_name VARCHAR(255) NOT NULL,
  center_short_code VARCHAR(50),
  center_region VARCHAR(100),
  recipient_id VARCHAR(255),
  recipient_name VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255),
  recipient_role_code VARCHAR(20) NOT NULL,
  recipient_role_name VARCHAR(255),
  leader_code VARCHAR(50) NOT NULL,
  leader_name VARCHAR(255) NOT NULL,
  leader_email VARCHAR(255),
  leader_role_code VARCHAR(20) NOT NULL,
  leader_role_name VARCHAR(255),
  criterion_1_raw SMALLINT NOT NULL CHECK (criterion_1_raw BETWEEN 1 AND 5),
  criterion_1_score NUMERIC(4,1) NOT NULL CHECK (criterion_1_score BETWEEN 0 AND 10),
  criterion_2_raw SMALLINT NOT NULL CHECK (criterion_2_raw BETWEEN 1 AND 5),
  criterion_2_score NUMERIC(4,1) NOT NULL CHECK (criterion_2_score BETWEEN 0 AND 10),
  criterion_3_raw SMALLINT NOT NULL CHECK (criterion_3_raw BETWEEN 1 AND 5),
  criterion_3_score NUMERIC(4,1) NOT NULL CHECK (criterion_3_score BETWEEN 0 AND 10),
  criterion_4_raw SMALLINT NOT NULL CHECK (criterion_4_raw BETWEEN 1 AND 5),
  criterion_4_score NUMERIC(4,1) NOT NULL CHECK (criterion_4_score BETWEEN 0 AND 10),
  criterion_5_raw SMALLINT NOT NULL CHECK (criterion_5_raw BETWEEN 1 AND 5),
  criterion_5_score NUMERIC(4,1) NOT NULL CHECK (criterion_5_score BETWEEN 0 AND 10),
  total_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (total_score BETWEEN 0 AND 10),
  improvement_note TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facility_evaluations_month_created
  ON facility_evaluations(form_month, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facility_evaluations_center_month
  ON facility_evaluations(center_id, form_month, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facility_evaluations_leader_month
  ON facility_evaluations(LOWER(leader_email), form_month, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facility_evaluations_created_by
  ON facility_evaluations(LOWER(created_by_email), created_at DESC);

DROP TRIGGER IF EXISTS trg_facility_evaluations_updated_at
  ON facility_evaluations;
CREATE TRIGGER trg_facility_evaluations_updated_at
BEFORE UPDATE ON facility_evaluations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
  IF to_regclass('public.roles') IS NOT NULL AND to_regclass('public.role_permissions') IS NOT NULL THEN
    INSERT INTO role_permissions (role_code, route_path)
    SELECT r.role_code, '/admin/quan-ly-qc'
    FROM roles r
    WHERE r.role_code IN ('TEGL', 'TM', 'K12')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
