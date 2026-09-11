CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS trial_checkout_raw (
    raw_id BIGINT PRIMARY KEY,
    source_file TEXT NOT NULL,
    source_sheet TEXT NOT NULL,
    source_row_number INTEGER NOT NULL CHECK (source_row_number >= 2),
    timestamp_raw TEXT,
    timestamp_at TIMESTAMP WITHOUT TIME ZONE,
    trial_teacher_name TEXT NOT NULL,
    sales_owner_name TEXT,
    student_name TEXT,
    student_age_label TEXT,
    trial_date_raw TEXT,
    trial_date DATE,
    track TEXT,
    trial_subject TEXT,
    center_name TEXT,
    ht1 NUMERIC(5, 2) CHECK (ht1 IS NULL OR ht1 BETWEEN 0 AND 5),
    ht2 NUMERIC(5, 2) CHECK (ht2 IS NULL OR ht2 BETWEEN 0 AND 5),
    ht3 NUMERIC(5, 2) CHECK (ht3 IS NULL OR ht3 BETWEEN 0 AND 5),
    st1 NUMERIC(5, 2) CHECK (st1 IS NULL OR st1 BETWEEN 0 AND 5),
    st2 NUMERIC(5, 2) CHECK (st2 IS NULL OR st2 BETWEEN 0 AND 5),
    lg1 NUMERIC(5, 2) CHECK (lg1 IS NULL OR lg1 BETWEEN 0 AND 5),
    lg2 NUMERIC(5, 2) CHECK (lg2 IS NULL OR lg2 BETWEEN 0 AND 5),
    gt1 NUMERIC(5, 2) CHECK (gt1 IS NULL OR gt1 BETWEEN 0 AND 5),
    gt2 NUMERIC(5, 2) CHECK (gt2 IS NULL OR gt2 BETWEEN 0 AND 5),
    rob4b_1 NUMERIC(5, 2) CHECK (rob4b_1 IS NULL OR rob4b_1 BETWEEN 0 AND 5),
    rob4b_2 NUMERIC(5, 2) CHECK (rob4b_2 IS NULL OR rob4b_2 BETWEEN 0 AND 5),
    rob4b_3 NUMERIC(5, 2) CHECK (rob4b_3 IS NULL OR rob4b_3 BETWEEN 0 AND 5),
    rob4b_4 NUMERIC(5, 2) CHECK (rob4b_4 IS NULL OR rob4b_4 BETWEEN 0 AND 5),
    art4p_1 NUMERIC(5, 2) CHECK (art4p_1 IS NULL OR art4p_1 BETWEEN 0 AND 5),
    art4p_2 NUMERIC(5, 2) CHECK (art4p_2 IS NULL OR art4p_2 BETWEEN 0 AND 5),
    art4p_3 NUMERIC(5, 2) CHECK (art4p_3 IS NULL OR art4p_3 BETWEEN 0 AND 5),
    art4p_4 NUMERIC(5, 2) CHECK (art4p_4 IS NULL OR art4p_4 BETWEEN 0 AND 5),
    art4p_5 NUMERIC(5, 2) CHECK (art4p_5 IS NULL OR art4p_5 BETWEEN 0 AND 5),
    total_score NUMERIC(5, 2) CHECK (total_score IS NULL OR total_score BETWEEN 0 AND 5),
    case_result TEXT,
    general_comment TEXT,
    evidence_link TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trial_checkout_raw_trial_date
    ON trial_checkout_raw (trial_date);

CREATE INDEX IF NOT EXISTS idx_trial_checkout_raw_timestamp_at
    ON trial_checkout_raw (timestamp_at);

CREATE INDEX IF NOT EXISTS idx_trial_checkout_raw_center_name
    ON trial_checkout_raw (LOWER(center_name));

CREATE INDEX IF NOT EXISTS idx_trial_checkout_raw_teacher_name
    ON trial_checkout_raw (LOWER(trial_teacher_name));

CREATE INDEX IF NOT EXISTS idx_trial_checkout_raw_subject
    ON trial_checkout_raw (trial_subject);

CREATE INDEX IF NOT EXISTS idx_trial_checkout_raw_track
    ON trial_checkout_raw (track);

CREATE INDEX IF NOT EXISTS idx_trial_checkout_raw_case_result
    ON trial_checkout_raw (case_result);

CREATE INDEX IF NOT EXISTS idx_trial_checkout_raw_raw_payload
    ON trial_checkout_raw USING GIN (raw_payload);

DROP TRIGGER IF EXISTS trg_trial_checkout_raw_updated_at ON trial_checkout_raw;
CREATE TRIGGER trg_trial_checkout_raw_updated_at
BEFORE UPDATE ON trial_checkout_raw
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE trial_checkout_raw IS
    'Raw import of trial checkout/evaluation records from Data_trial_raw.xlsx Sheet1. Keep raw_payload for audit and future remapping.';

COMMENT ON COLUMN trial_checkout_raw.raw_id IS
    'Source Id column from Sheet1. Used as the natural idempotency key.';

COMMENT ON COLUMN trial_checkout_raw.raw_payload IS
    'Original row values keyed by the workbook headers, preserving source labels and values for audit.';
