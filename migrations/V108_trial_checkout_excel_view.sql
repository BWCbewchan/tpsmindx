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
    evidence_link AS "Link"
FROM trial_checkout_raw;

COMMENT ON VIEW trial_checkout IS
    'Excel-facing view for trial checkout data. Keeps trial_checkout_raw as the canonical import/audit table while exposing original workbook column names without raw prefixes.';
