CREATE TABLE IF NOT EXISTS check_cong_import_files (
  id BIGSERIAL PRIMARY KEY,
  period_month VARCHAR(7) NOT NULL CHECK (period_month ~ '^\d{4}-\d{2}$'),
  original_file_name TEXT NOT NULL,
  original_file_type VARCHAR(20) NOT NULL DEFAULT 'csv'
    CHECK (original_file_type IN ('csv', 'excel')),
  sheet_name TEXT,
  s3_bucket TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  record_count INTEGER NOT NULL DEFAULT 0,
  content_sha256 VARCHAR(64) NOT NULL,
  uploaded_by_email VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE check_cong_import_files
  ADD COLUMN IF NOT EXISTS sheet_name TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_check_cong_import_files_period_active
  ON check_cong_import_files(period_month, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_cong_import_files_created
  ON check_cong_import_files(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_check_cong_import_active_month
  ON check_cong_import_files(period_month)
  WHERE is_active IS TRUE;
