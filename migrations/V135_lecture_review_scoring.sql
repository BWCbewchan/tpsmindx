-- Migration: V135_lecture_review_scoring.sql
-- Thêm các trường chấm điểm, hình thức đánh giá và phản hồi cho bảng lecture_review_applications

ALTER TABLE lecture_review_applications
  ADD COLUMN IF NOT EXISTS evaluation_format VARCHAR(20) DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS evaluation_details JSONB,
  ADD COLUMN IF NOT EXISTS evaluation_general_feedback TEXT,
  ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evaluated_by_name VARCHAR(255);

COMMENT ON COLUMN lecture_review_applications.evaluation_format IS 'Hình thức duyệt giảng: online hoặc offline';
COMMENT ON COLUMN lecture_review_applications.evaluation_details IS 'Chi tiết điểm 25 tiêu chí theo JSON';
COMMENT ON COLUMN lecture_review_applications.evaluation_general_feedback IS 'Nhận xét và góp ý chung của giám khảo';
COMMENT ON COLUMN lecture_review_applications.evaluated_at IS 'Thời điểm hoàn tất chấm điểm';
COMMENT ON COLUMN lecture_review_applications.evaluated_by_name IS 'Họ tên giám khảo thực hiện chấm điểm';
