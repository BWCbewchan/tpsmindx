ALTER TABLE trial_checkout_raw
    ADD COLUMN IF NOT EXISTS trial_time_range TEXT;

COMMENT ON COLUMN trial_checkout_raw.trial_time_range IS
    'Trial session time range in HH:mm - HH:mm format. Nullable for legacy imported records.';

CREATE OR REPLACE VIEW trial_checkout AS
SELECT
    raw_id AS "Id",
    timestamp_at AS "Timestamp",
    trial_teacher_name AS "Tên giáo viên Trial",
    sales_owner_name AS "Tên sale phụ trách",
    student_name AS "Họ tên học viên",
    student_age_label AS "Tuổi",
    trial_date AS "Ngày trải nghiệm",
    track AS "Khối",
    trial_subject AS "Môn trải nghiệm",
    center_name AS "Cơ sở",
    ht1 AS "HT1",
    ht2 AS "HT2",
    ht3 AS "HT3",
    st1 AS "ST1",
    st2 AS "ST2",
    lg1 AS "LG1",
    lg2 AS "LG2",
    gt1 AS "GT1",
    gt2 AS "GT2",
    rob4b_1 AS "ROB4B-1",
    rob4b_2 AS "ROB4B-2",
    rob4b_3 AS "ROB4B-3",
    rob4b_4 AS "ROB4B-4",
    art4p_1 AS "ART4+1",
    art4p_2 AS "ART4+2",
    art4p_3 AS "ART4+3",
    art4p_4 AS "ART4+4",
    art4p_5 AS "ART4+5",
    total_score AS "Tổng điểm",
    case_result AS "Chốt case",
    general_comment AS "Nhận xét chung",
    evidence_link AS "Link",
    COALESCE(
        NULLIF(TRIM(trial_time_range), ''),
        NULLIF(TRIM(raw_payload->>'trialTimeRange'), ''),
        NULLIF(TRIM(raw_payload->>'Khung giờ trải nghiệm'), '')
    ) AS "Khung giờ trải nghiệm"
FROM trial_checkout_raw;

