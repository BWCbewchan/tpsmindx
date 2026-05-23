-- ===================================================
-- Bảng 1: Thông tin Video Đào tạo
-- ===================================================

CREATE TABLE training_videos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(500) NOT NULL COMMENT 'Tiêu đề video (VD: LESSON 01: Kỹ năng trao đổi với PHHS)',
    video_link VARCHAR(1000) NOT NULL COMMENT 'Link video đào tạo (cloudinary)',
    start_date DATE NOT NULL COMMENT 'Ngày bắt đầu assign video',
    duration_minutes INT COMMENT 'Thời lượng video (phút)',
    view_count INT DEFAULT 0 COMMENT 'Số lượt xem',
    status ENUM('active', 'inactive', 'draft') DEFAULT 'draf' COMMENT 'Trạng thái video',
    description TEXT COMMENT 'Mô tả chi tiết video',
    thumbnail_url VARCHAR(1000) COMMENT 'Link ảnh thumbnail',
    lesson_number INT COMMENT 'Số thứ tự bài học (1, 2, 3...)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_start_date (start_date),
    INDEX idx_status (status),
    INDEX idx_lesson_number (lesson_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu thông tin video đào tạo nâng cao';

-- ===================================================
-- Bảng 2: Bộ câu hỏi trong Video
-- ===================================================

CREATE TABLE training_video_questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    video_id INT NOT NULL COMMENT 'ID của video',
    question_text TEXT NOT NULL COMMENT 'Nội dung câu hỏi',
    question_type ENUM('multiple_choice', 'true_false', 'short_answer', 'open_ended') DEFAULT 'multiple_choice' COMMENT 'Loại câu hỏi',
    time_in_video INT COMMENT 'Thời điểm xuất hiện câu hỏi trong video (giây)',
    correct_answer TEXT COMMENT 'Đáp án đúng',
    options JSON COMMENT 'Các lựa chọn cho câu hỏi trắc nghiệm (JSON array)',
    points DECIMAL(5, 2) DEFAULT 1.00 COMMENT 'Số điểm của câu hỏi',
    order_number INT COMMENT 'Thứ tự câu hỏi trong video',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES training_videos(id) ON DELETE CASCADE,
    INDEX idx_video_id (video_id),
    INDEX idx_order (order_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu câu hỏi trong video đào tạo';

-- ===================================================
-- Bảng 3: Assignment/Kiểm tra sau mỗi Video
-- ===================================================

CREATE TABLE training_video_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    video_id INT NOT NULL COMMENT 'ID của video',
    assignment_title VARCHAR(500) NOT NULL COMMENT 'Tiêu đề bài kiểm tra (VD: Kiểm tra LESSON 01)',
    assignment_type ENUM('quiz', 'test', 'exam', 'practice') DEFAULT 'quiz' COMMENT 'Loại bài kiểm tra',
    description TEXT COMMENT 'Mô tả bài kiểm tra',
    total_points DECIMAL(5, 2) DEFAULT 10.00 COMMENT 'Tổng điểm của assignment',
    passing_score DECIMAL(5, 2) DEFAULT 7.00 COMMENT 'Điểm đạt (để pass)',
    time_limit_minutes INT COMMENT 'Thời gian làm bài (phút), NULL = không giới hạn',
    max_attempts INT DEFAULT 1 COMMENT 'Số lần làm bài tối đa',
    is_required BOOLEAN DEFAULT TRUE COMMENT 'Bắt buộc hay không',
    due_date DATETIME COMMENT 'Hạn nộp bài',
    status ENUM('draft', 'published', 'closed') DEFAULT 'published' COMMENT 'Trạng thái assignment',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES training_videos(id) ON DELETE CASCADE,
    INDEX idx_video_id (video_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu bài kiểm tra/assignment sau mỗi video';

-- ===================================================
-- Bảng 4: Câu hỏi của Assignment
-- ===================================================

CREATE TABLE training_assignment_questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    assignment_id INT NOT NULL COMMENT 'ID của assignment',
    question_text TEXT NOT NULL COMMENT 'Nội dung câu hỏi',
    question_type ENUM('multiple_choice', 'true_false', 'short_answer', 'essay', 'matching') DEFAULT 'multiple_choice' COMMENT 'Loại câu hỏi',
    correct_answer TEXT COMMENT 'Đáp án đúng',
    options JSON COMMENT 'Các lựa chọn (JSON array): ["A. Option 1", "B. Option 2", ...]',
    image_url VARCHAR(1000) COMMENT 'Link hình ảnh minh họa cho câu hỏi (nếu có)',
    explanation TEXT COMMENT 'Giải thích đáp án',
    points DECIMAL(5, 2) DEFAULT 1.00 COMMENT 'Số điểm của câu hỏi',
    order_number INT COMMENT 'Thứ tự câu hỏi',
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium' COMMENT 'Độ khó',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES training_video_assignments(id) ON DELETE CASCADE,
    INDEX idx_assignment_id (assignment_id),
    INDEX idx_order (order_number),
    INDEX idx_difficulty (difficulty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu câu hỏi trong assignment';

-- ===================================================
-- Bảng 5: Kết quả làm Assignment của Giáo viên
-- ===================================================

CREATE TABLE training_assignment_submissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_code VARCHAR(50) NOT NULL COMMENT 'Mã giáo viên',
    assignment_id INT NOT NULL COMMENT 'ID của assignment',
    attempt_number INT DEFAULT 1 COMMENT 'Lần làm bài thứ mấy',
    score DECIMAL(5, 2) DEFAULT 0.00 COMMENT 'Điểm đạt được',
    total_points DECIMAL(5, 2) COMMENT 'Tổng điểm của bài',
    percentage DECIMAL(5, 2) COMMENT 'Phần trăm đúng',
    is_passed BOOLEAN DEFAULT FALSE COMMENT 'Đạt hay không đạt',
    status ENUM('in_progress', 'submitted', 'graded') DEFAULT 'in_progress' COMMENT 'Trạng thái bài làm',
    started_at TIMESTAMP NULL COMMENT 'Thời gian bắt đầu làm',
    submitted_at TIMESTAMP NULL COMMENT 'Thời gian nộp bài',
    graded_at TIMESTAMP NULL COMMENT 'Thời gian chấm điểm',
    time_spent_seconds INT DEFAULT 0 COMMENT 'Thời gian làm bài (giây)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES training_video_assignments(id) ON DELETE CASCADE,
    INDEX idx_teacher_code (teacher_code),
    INDEX idx_assignment_id (assignment_id),
    INDEX idx_status (status),
    INDEX idx_attempt (attempt_number),
    UNIQUE KEY unique_teacher_assignment_attempt (teacher_code, assignment_id, attempt_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu kết quả làm assignment của giáo viên';

-- ===================================================
-- Bảng 6: Câu trả lời của Giáo viên trong Assignment
-- ===================================================

CREATE TABLE training_assignment_answers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    submission_id INT NOT NULL COMMENT 'ID của submission',
    question_id INT NOT NULL COMMENT 'ID của câu hỏi',
    answer_text TEXT COMMENT 'Câu trả lời của giáo viên',
    is_correct BOOLEAN DEFAULT FALSE COMMENT 'Đúng hay sai',
    points_earned DECIMAL(5, 2) DEFAULT 0.00 COMMENT 'Điểm đạt được',
    feedback TEXT COMMENT 'Phản hồi từ hệ thống hoặc giáo viên',
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian trả lời',
    FOREIGN KEY (submission_id) REFERENCES training_assignment_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES training_assignment_questions(id) ON DELETE CASCADE,
    INDEX idx_submission_id (submission_id),
    INDEX idx_question_id (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu câu trả lời chi tiết trong assignment';

-- ===================================================
-- Bảng 7: Thông tin thống kê của Giáo viên
-- ===================================================

CREATE TABLE training_teacher_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã giáo viên (VD: datpt1, cuongnx)',
    full_name VARCHAR(200) NOT NULL COMMENT 'Họ và tên',
    username VARCHAR(100) COMMENT 'Tên đăng nhập',
    work_email VARCHAR(200) NOT NULL COMMENT 'Email công việc',
    phone_number VARCHAR(20) COMMENT 'Số điện thoại',
    status VARCHAR(50) DEFAULT 'Active' COMMENT 'Trạng thái (Active, Inactive, etc.)',
    center VARCHAR(200) COMMENT 'Cơ sở làm việc (VD: HN - A3 VinHomes Gardenia Hàm Nghi)',
    teaching_block VARCHAR(100) COMMENT 'Khối final (Coding, Robotics, etc.)',
    position VARCHAR(100) COMMENT 'Chức vụ (LEC, Senior, Lead, etc.)',
    total_score DECIMAL(5, 2) DEFAULT 0.00 COMMENT 'Điểm tổng kết',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_teacher_code (teacher_code),
    INDEX idx_work_email (work_email),
    INDEX idx_center (center),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu thông tin thống kê giáo viên đào tạo';

-- ===================================================
-- Bảng 8: Điểm của từng Video
-- ===================================================

CREATE TABLE training_teacher_video_scores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_code VARCHAR(50) NOT NULL COMMENT 'Mã giáo viên',
    video_id INT NOT NULL COMMENT 'ID của video',
    score DECIMAL(5, 2) DEFAULT 0.00 COMMENT 'Điểm số đạt được',
    completion_status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started' COMMENT 'Trạng thái hoàn thành',
    view_count INT DEFAULT 0 COMMENT 'Số lần xem của giáo viên này',
    first_viewed_at TIMESTAMP NULL COMMENT 'Lần xem đầu tiên',
    completed_at TIMESTAMP NULL COMMENT 'Thời gian hoàn thành',
    time_spent_seconds INT DEFAULT 0 COMMENT 'Tổng thời gian học (giây)',
    assigned_date DATE COMMENT 'Ngày được assign video',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_code) REFERENCES training_teacher_stats(teacher_code) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES training_videos(id) ON DELETE CASCADE,
    UNIQUE KEY unique_teacher_video (teacher_code, video_id),
    INDEX idx_teacher_code (teacher_code),
    INDEX idx_video_id (video_id),
    INDEX idx_completion_status (completion_status),
    INDEX idx_assigned_date (assigned_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu điểm và tiến độ học của giáo viên cho từng video';

-- ===================================================
-- Bảng 9: Câu trả lời của Giáo viên trong Video
-- ===================================================

CREATE TABLE training_teacher_answers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_code VARCHAR(50) NOT NULL COMMENT 'Mã giáo viên',
    video_id INT NOT NULL COMMENT 'ID của video',
    question_id INT NOT NULL COMMENT 'ID của câu hỏi',
    answer_text TEXT COMMENT 'Câu trả lời của giáo viên',
    is_correct BOOLEAN DEFAULT FALSE COMMENT 'Đúng hay sai',
    points_earned DECIMAL(5, 2) DEFAULT 0.00 COMMENT 'Điểm đạt được cho câu này',
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian trả lời',
    FOREIGN KEY (teacher_code) REFERENCES training_teacher_stats(teacher_code) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES training_videos(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES training_video_questions(id) ON DELETE CASCADE,
    INDEX idx_teacher_code (teacher_code),
    INDEX idx_video_id (video_id),
    INDEX idx_question_id (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu câu trả lời của giáo viên';

-- ===================================================
-- Insert dữ liệu mẫu cho Video
-- ===================================================

INSERT INTO training_videos (title, video_link, start_date, duration_minutes, lesson_number, description) VALUES
('LESSON 01: Kỹ năng trao đổi với PHHS', 'https://edpuzzle.com/assignments/689582795b3559738e69355b/watch', '2025-12-01', 30, 1, 'Kỹ năng trao đổi với phụ huynh học sinh'),
('LESSON 02: Kỹ năng quan sát học viên', 'https://edpuzzle.com/assignments/689582795b3559738e69355b/watch', '2025-12-05', 25, 2, 'Quan sát, nhận biết học sinh + Giải quyết xung đột, xử lý hành vi học sinh'),
('LESSON 03: Kỹ năng giao tiếp với học viên', 'https://edpuzzle.com/assignments/689582795b3559738e69355b/watch', '2025-12-10', 28, 3, 'Phương pháp giao tiếp với học viên ở từng độ tuổi');

-- ===================================================
-- Insert dữ liệu mẫu cho Assignment
-- ===================================================

INSERT INTO training_video_assignments (video_id, assignment_title, assignment_type, description, total_points, passing_score, time_limit_minutes, max_attempts, due_date) VALUES
(1, 'Kiểm tra LESSON 01: Kỹ năng trao đổi với PHHS', 'quiz', 'Bài kiểm tra sau khi xem video LESSON 01', 10.00, 7.00, 30, 3, '2025-12-15 23:59:59'),
(2, 'Kiểm tra LESSON 02: Kỹ năng quan sát học viên', 'quiz', 'Bài kiểm tra sau khi xem video LESSON 02', 10.00, 7.00, 30, 3, '2025-12-20 23:59:59'),
(3, 'Kiểm tra LESSON 03: Kỹ năng giao tiếp', 'quiz', 'Bài kiểm tra sau khi xem video LESSON 03', 10.00, 7.00, 30, 3, '2025-12-25 23:59:59');

-- ===================================================
-- Insert dữ liệu mẫu cho câu hỏi Assignment (VD cho Assignment 1)
-- ===================================================

INSERT INTO training_assignment_questions (assignment_id, question_text, question_type, correct_answer, options, points, order_number, difficulty) VALUES
(1, 'Khi trao đổi với phụ huynh học sinh, điều quan trọng nhất là gì?', 'multiple_choice', 'B', 
 '["A. Nói nhanh để tiết kiệm thời gian", "B. Lắng nghe và thấu hiểu", "C. Chỉ nói về điểm yếu của học sinh", "D. Không cần chuẩn bị trước"]', 
 2.00, 1, 'easy'),
(1, 'Cách xử lý khi phụ huynh phàn nàn về con em mình?', 'multiple_choice', 'C', 
 '["A. Bảo vệ ngay lập tức phía giáo viên", "B. Im lặng không trả lời", "C. Lắng nghe và tìm hiểu vấn đề", "D. Đổ lỗi cho học sinh khác"]', 
 2.00, 2, 'medium'),
(1, 'Tần suất nên trao đổi với phụ huynh là bao nhiêu?', 'multiple_choice', 'B', 
 '["A. Chỉ khi có vấn đề", "B. Định kỳ và khi cần thiết", "C. Không cần thiết", "D. Mỗi ngày"]', 
 2.00, 3, 'easy');

-- ===================================================
-- Insert dữ liệu mẫu cho Giáo viên
-- ===================================================

INSERT INTO training_teacher_stats (teacher_code, full_name, username, work_email, phone_number, status, center, teaching_block, position, total_score) VALUES
('datpt1', 'Phạm Tuấn Đạt', 'datpt1', 'datpt1@mindx.net.vn', '0912345678', 'Active', 'HN - A3 VinHomes Gardenia Hàm Nghi', 'Coding', 'LEC', 8.91),
('cuongnx', 'Nguyễn Xuân Cường', 'cuongnx', 'cuongnx@mindx.net.vn', '0912345679', 'Active', 'HN - 98 Nguyễn Văn Cừ', 'Coding', 'LEC', 6.73),
('tienntq', 'Nguyễn Thị Quỳnh Tiên', 'tienntq', 'tienntq@mindx.net.vn', '0912345680', 'Active', 'HCM - Phan Văn Trị', 'Coding', 'LEC', 7.33),
('anhnp2', 'Nguyễn Phương Anh', 'anhnp2', 'anhnp2@mindx.net.vn', '0912345681', 'Active', 'HN - 98 Nguyễn Văn Cừ', 'Coding', 'LEC', 9.20),
('longnh', 'Nguyễn Hoàng Long', 'longnh', 'longnh@mindx.net.vn', '0912345682', 'Active', 'HCM - 255-257 Hùng Vương', 'Coding', 'LEC', 6.07),
('khangnvn', 'Nguyễn Vũ Nam Khang', 'khangnvn', 'khangnvn@mindx.net.vn', '0912345683', 'Active', 'HCM - 120-122 Phạm Văn Đồng', 'Coding', 'LEC', 8.95),
('ductbt', 'Bùi Trọng Đức', 'ductbt', 'ductbt@mindx.net.vn', '0912345684', 'Active', 'Quảng Ninh - 70 Nguyễn Văn Cừ', 'Coding', 'LEC', 6.98);

-- ===================================================
-- View để xem thống kê tổng hợp
-- ===================================================

CREATE VIEW v_training_teacher_overview AS
SELECT 
    ts.teacher_code,
    ts.full_name,
    ts.username,
    ts.work_email,
    ts.phone_number,
    ts.status,
    ts.center,
    ts.teaching_block,
    ts.position,
    ts.total_score,
    COUNT(DISTINCT tvs.id) as total_videos_assigned,
    SUM(CASE WHEN tvs.completion_status = 'completed' THEN 1 ELSE 0 END) as videos_completed,
    AVG(CASE WHEN tvs.completion_status = 'completed' THEN tvs.score ELSE NULL END) as avg_video_score,
    COUNT(DISTINCT tas.id) as total_assignments_taken,
    SUM(CASE WHEN tas.is_passed = TRUE THEN 1 ELSE 0 END) as assignments_passed,
    AVG(CASE WHEN tas.status = 'graded' THEN tas.score ELSE NULL END) as avg_assignment_score,
    SUM(tvs.time_spent_seconds) / 60 as total_time_spent_minutes
FROM training_teacher_stats ts
LEFT JOIN training_teacher_video_scores tvs ON ts.teacher_code = tvs.teacher_code
LEFT JOIN training_assignment_submissions tas ON ts.teacher_code = tas.teacher_code
GROUP BY ts.teacher_code, ts.full_name, ts.username, ts.work_email, ts.phone_number, 
         ts.status, ts.center, ts.teaching_block, ts.position, ts.total_score;

-- ===================================================
-- View để xem chi tiết điểm theo từng video
-- ===================================================

CREATE VIEW v_training_score_matrix AS
SELECT 
    ts.teacher_code,
    ts.full_name,
    ts.center,
    tv.lesson_number,
    tv.title as video_title,
    tvs.score as video_score,
    tvs.completion_status,
    tvs.assigned_date,
    tvs.completed_at,
    tas.score as assignment_score,
    tas.is_passed as assignment_passed,
    tas.attempt_number,
    tas.submitted_at as assignment_submitted_at
FROM training_teacher_stats ts
LEFT JOIN training_teacher_video_scores tvs ON ts.teacher_code = tvs.teacher_code
LEFT JOIN training_videos tv ON tvs.video_id = tv.id
LEFT JOIN training_video_assignments tva ON tv.id = tva.video_id
LEFT JOIN training_assignment_submissions tas ON ts.teacher_code = tas.teacher_code AND tva.id = tas.assignment_id
ORDER BY ts.teacher_code, tv.lesson_number;

-- ===================================================
-- View: Kết quả Assignment chi tiết
-- ===================================================

CREATE VIEW v_assignment_results AS
SELECT 
    tas.id as submission_id,
    ts.teacher_code,
    ts.full_name,
    tv.title as video_title,
    tva.assignment_title,
    tas.attempt_number,
    tas.score,
    tas.total_points,
    tas.percentage,
    tas.is_passed,
    tas.status,
    tas.time_spent_seconds / 60 as time_spent_minutes,
    tas.started_at,
    tas.submitted_at,
    tas.graded_at
FROM training_assignment_submissions tas
JOIN training_video_assignments tva ON tas.assignment_id = tva.id
JOIN training_videos tv ON tva.video_id = tv.id
LEFT JOIN training_teacher_stats ts ON tas.teacher_code = ts.teacher_code
ORDER BY ts.teacher_code, tv.lesson_number, tas.attempt_number;

-- ===================================================
-- Stored Procedure: Cập nhật tổng điểm cho giáo viên
-- ===================================================

DELIMITER //

CREATE PROCEDURE update_teacher_total_score(IN p_teacher_code VARCHAR(50))
BEGIN
    UPDATE training_teacher_stats
    SET total_score = (
        SELECT COALESCE(AVG(score), 0)
        FROM training_teacher_video_scores
        WHERE teacher_code = p_teacher_code 
        AND completion_status = 'completed'
    )
    WHERE teacher_code = p_teacher_code;
END //

DELIMITER ;

-- ===================================================
-- Trigger: Tự động cập nhật tổng điểm khi có điểm mới
-- ===================================================

DELIMITER //

CREATE TRIGGER after_video_score_update
AFTER UPDATE ON training_teacher_video_scores
FOR EACH ROW
BEGIN
    CALL update_teacher_total_score(NEW.teacher_code);
END //

CREATE TRIGGER after_video_score_insert
AFTER INSERT ON training_teacher_video_scores
FOR EACH ROW
BEGIN
    CALL update_teacher_total_score(NEW.teacher_code);
END //

DELIMITER ;

-- ===================================================
-- Các Query hữu ích
-- ===================================================

-- 1. Lấy danh sách giáo viên với điểm tổng kết và số video đã hoàn thành
-- SELECT * FROM v_training_teacher_overview ORDER BY total_score DESC;

-- 2. Lấy ma trận điểm (giống giao diện dashboard)
-- SELECT * FROM v_training_score_matrix;

-- 3. Lấy kết quả assignment của giáo viên
-- SELECT * FROM v_assignment_results WHERE teacher_code = 'datpt1';

-- 4. Lấy top giáo viên có điểm cao nhất
-- SELECT * FROM training_teacher_stats ORDER BY total_score DESC LIMIT 10;

-- 5. Lấy thống kê theo cơ sở
-- SELECT center, COUNT(*) as teacher_count, AVG(total_score) as avg_score
-- FROM training_teacher_stats
-- GROUP BY center
-- ORDER BY avg_score DESC;

-- 6. Lấy danh sách video đã được assign
-- SELECT tv.*, COUNT(tvs.id) as assigned_count
-- FROM training_videos tv
-- LEFT JOIN training_teacher_video_scores tvs ON tv.id = tvs.video_id
-- GROUP BY tv.id
-- ORDER BY tv.lesson_number;

-- 7. Lấy thống kê assignment theo video
-- SELECT 
--     tv.title,
--     tva.assignment_title,
--     COUNT(DISTINCT tas.teacher_code) as total_teachers,
--     SUM(CASE WHEN tas.is_passed = TRUE THEN 1 ELSE 0 END) as passed_count,
--     AVG(tas.score) as avg_score,
--     AVG(tas.percentage) as avg_percentage
-- FROM training_videos tv
-- JOIN training_video_assignments tva ON tv.id = tva.video_id
-- LEFT JOIN training_assignment_submissions tas ON tva.id = tas.assignment_id
-- GROUP BY tv.id, tva.id;

-- 8. Lấy chi tiết câu trả lời của một giáo viên trong assignment
-- SELECT 
--     ts.full_name,
--     tva.assignment_title,
--     taq.question_text,
--     taa.answer_text,
--     taa.is_correct,
--     taa.points_earned,
--     taq.correct_answer
-- FROM training_assignment_answers taa
-- JOIN training_assignment_submissions tas ON taa.submission_id = tas.id
-- JOIN training_assignment_questions taq ON taa.question_id = taq.id
-- JOIN training_video_assignments tva ON taq.assignment_id = tva.id
-- LEFT JOIN training_teacher_stats ts ON tas.teacher_code = ts.teacher_code
-- WHERE tas.teacher_code = 'datpt1' AND tas.id = 1;

-- 9. Kiểm tra giáo viên nào chưa làm assignment
-- SELECT 
--     ts.teacher_code,
--     ts.full_name,
--     tva.assignment_title,
--     tva.due_date
-- FROM training_teacher_stats ts
-- CROSS JOIN training_video_assignments tva
-- LEFT JOIN training_assignment_submissions tas ON ts.teacher_code = tas.teacher_code 
--     AND tva.id = tas.assignment_id
-- WHERE tas.id IS NULL AND tva.status = 'published'
-- ORDER BY tva.due_date, ts.teacher_code;

-- 10. Thống kê tỷ lệ pass/fail theo assignment
-- SELECT 
--     tva.assignment_title,
--     COUNT(DISTINCT tas.teacher_code) as total_submissions,
--     SUM(CASE WHEN tas.is_passed = TRUE THEN 1 ELSE 0 END) as passed,
--     SUM(CASE WHEN tas.is_passed = FALSE THEN 1 ELSE 0 END) as failed,
--     ROUND(SUM(CASE WHEN tas.is_passed = TRUE THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as pass_rate
-- FROM training_video_assignments tva
-- LEFT JOIN training_assignment_submissions tas ON tva.id = tas.assignment_id
-- WHERE tas.status = 'graded'
-- GROUP BY tva.id, tva.assignment_title;

