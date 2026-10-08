CREATE TABLE IF NOT EXISTS facility_evaluation_forms (
  id BIGSERIAL PRIMARY KEY,
  form_month VARCHAR(7) NOT NULL CHECK (form_month ~ '^[0-9]{4}-[0-9]{2}$'),
  public_token VARCHAR(96) NOT NULL UNIQUE,
  created_by_email VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_facility_evaluation_forms_active_month
  ON facility_evaluation_forms(form_month)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_facility_evaluation_forms_token
  ON facility_evaluation_forms(public_token)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_facility_evaluation_forms_updated_at
  ON facility_evaluation_forms;
CREATE TRIGGER trg_facility_evaluation_forms_updated_at
BEFORE UPDATE ON facility_evaluation_forms
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
