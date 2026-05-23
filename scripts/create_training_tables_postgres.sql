-- ===================================================
-- PostgreSQL Schema for Training System
-- ===================================================

-- Bảng 1: Thông tin Video Đào tạo
CREATE TABLE training_videos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    video_link VARCHAR(1000) NOT NULL,
    start_date DATE NOT NULL,
    duration_minutes INTEGER,
    view_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('active', 'inactive', 'draft')),
    description TEXT,
    thumbnail_url VARCHAR(1000),
    lesson_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_videos_start_date ON training_videos(start_date);
CREATE INDEX idx_training_videos_status ON training_videos(status);
CREATE INDEX idx_training_videos_lesson_number ON training_videos(lesson_number);

-- Bảng 2: Bộ câu hỏi trong Video
CREATE TABLE training_video_questions (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL REFERENCES training_videos(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'open_ended')),
    time_in_video INTEGER,
    correct_answer TEXT,
    options JSONB,
    points DECIMAL(5, 2) DEFAULT 1.00,
    order_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_video_questions_video_id ON training_video_questions(video_id);
CREATE INDEX idx_training_video_questions_order ON training_video_questions(order_number);

-- Bảng 3: Assignment/Kiểm tra sau mỗi Video
CREATE TABLE training_video_assignments (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL REFERENCES training_videos(id) ON DELETE CASCADE,
    assignment_title VARCHAR(500) NOT NULL,
    assignment_type VARCHAR(20) DEFAULT 'quiz' CHECK (assignment_type IN ('quiz', 'test', 'exam', 'practice')),
    description TEXT,
    total_points DECIMAL(5, 2) DEFAULT 10.00,
    passing_score DECIMAL(5, 2) DEFAULT 7.00,
    time_limit_minutes INTEGER,
    max_attempts INTEGER DEFAULT 1,
    is_required BOOLEAN DEFAULT TRUE,
    due_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_video_assignments_video_id ON training_video_assignments(video_id);
CREATE INDEX idx_training_video_assignments_status ON training_video_assignments(status);
CREATE INDEX idx_training_video_assignments_due_date ON training_video_assignments(due_date);

-- Bảng 4: Câu hỏi của Assignment
CREATE TABLE training_assignment_questions (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES training_video_assignments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay', 'matching')),
    correct_answer TEXT,
    options JSONB,
    image_url VARCHAR(1000),
    explanation TEXT,
    points DECIMAL(5, 2) DEFAULT 1.00,
    order_number INTEGER,
    difficulty VARCHAR(10) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_assignment_questions_assignment_id ON training_assignment_questions(assignment_id);
CREATE INDEX idx_training_assignment_questions_order ON training_assignment_questions(order_number);
CREATE INDEX idx_training_assignment_questions_difficulty ON training_assignment_questions(difficulty);

-- Bảng 5: Kết quả làm Assignment của Giáo viên
CREATE TABLE training_assignment_submissions (
    id SERIAL PRIMARY KEY,
    teacher_code VARCHAR(50) NOT NULL,
    assignment_id INTEGER NOT NULL REFERENCES training_video_assignments(id) ON DELETE CASCADE,
    attempt_number INTEGER DEFAULT 1,
    score DECIMAL(5, 2) DEFAULT 0.00,
    total_points DECIMAL(5, 2),
    percentage DECIMAL(5, 2),
    is_passed BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
    started_at TIMESTAMP,
    submitted_at TIMESTAMP,
    graded_at TIMESTAMP,
    time_spent_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_teacher_assignment_attempt UNIQUE (teacher_code, assignment_id, attempt_number)
);

CREATE INDEX idx_training_assignment_submissions_teacher_code ON training_assignment_submissions(teacher_code);
CREATE INDEX idx_training_assignment_submissions_assignment_id ON training_assignment_submissions(assignment_id);
CREATE INDEX idx_training_assignment_submissions_status ON training_assignment_submissions(status);
CREATE INDEX idx_training_assignment_submissions_attempt ON training_assignment_submissions(attempt_number);

-- Bảng 6: Câu trả lời của Giáo viên trong Assignment
CREATE TABLE training_assignment_answers (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES training_assignment_submissions(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES training_assignment_questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    is_correct BOOLEAN DEFAULT FALSE,
    points_earned DECIMAL(5, 2) DEFAULT 0.00,
    feedback TEXT,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_assignment_answers_submission_id ON training_assignment_answers(submission_id);
CREATE INDEX idx_training_assignment_answers_question_id ON training_assignment_answers(question_id);

-- Bảng 7: Thông tin thống kê của Giáo viên
CREATE TABLE training_teacher_stats (
    id SERIAL PRIMARY KEY,
    teacher_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    username VARCHAR(100),
    work_email VARCHAR(200) NOT NULL,
    phone_number VARCHAR(20),
    status VARCHAR(50) DEFAULT 'Active',
    center VARCHAR(200),
    teaching_block VARCHAR(100),
    position VARCHAR(100),
    total_score DECIMAL(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_teacher_stats_teacher_code ON training_teacher_stats(teacher_code);
CREATE INDEX idx_training_teacher_stats_work_email ON training_teacher_stats(work_email);
CREATE INDEX idx_training_teacher_stats_center ON training_teacher_stats(center);
CREATE INDEX idx_training_teacher_stats_status ON training_teacher_stats(status);

-- Bảng 8: Điểm của từng Video
CREATE TABLE training_teacher_video_scores (
    id SERIAL PRIMARY KEY,
    teacher_code VARCHAR(50) NOT NULL REFERENCES training_teacher_stats(teacher_code) ON DELETE CASCADE,
    video_id INTEGER NOT NULL REFERENCES training_videos(id) ON DELETE CASCADE,
    score DECIMAL(5, 2) DEFAULT 0.00,
    completion_status VARCHAR(20) DEFAULT 'not_started' CHECK (completion_status IN ('not_started', 'in_progress', 'completed')),
    view_count INTEGER DEFAULT 0,
    first_viewed_at TIMESTAMP,
    completed_at TIMESTAMP,
    time_spent_seconds INTEGER DEFAULT 0,
    assigned_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_teacher_video UNIQUE (teacher_code, video_id)
);

CREATE INDEX idx_training_teacher_video_scores_teacher_code ON training_teacher_video_scores(teacher_code);
CREATE INDEX idx_training_teacher_video_scores_video_id ON training_teacher_video_scores(video_id);
CREATE INDEX idx_training_teacher_video_scores_completion_status ON training_teacher_video_scores(completion_status);
CREATE INDEX idx_training_teacher_video_scores_assigned_date ON training_teacher_video_scores(assigned_date);

-- Bảng 9: Câu trả lời của Giáo viên trong Video
CREATE TABLE training_teacher_answers (
    id SERIAL PRIMARY KEY,
    teacher_code VARCHAR(50) NOT NULL REFERENCES training_teacher_stats(teacher_code) ON DELETE CASCADE,
    video_id INTEGER NOT NULL REFERENCES training_videos(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES training_video_questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    is_correct BOOLEAN DEFAULT FALSE,
    points_earned DECIMAL(5, 2) DEFAULT 0.00,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_teacher_answers_teacher_code ON training_teacher_answers(teacher_code);
CREATE INDEX idx_training_teacher_answers_video_id ON training_teacher_answers(video_id);
CREATE INDEX idx_training_teacher_answers_question_id ON training_teacher_answers(question_id);

-- Function để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers cho auto update timestamp
CREATE TRIGGER update_training_videos_updated_at BEFORE UPDATE ON training_videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_video_questions_updated_at BEFORE UPDATE ON training_video_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_video_assignments_updated_at BEFORE UPDATE ON training_video_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_assignment_questions_updated_at BEFORE UPDATE ON training_assignment_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_assignment_submissions_updated_at BEFORE UPDATE ON training_assignment_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_teacher_stats_updated_at BEFORE UPDATE ON training_teacher_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_teacher_video_scores_updated_at BEFORE UPDATE ON training_teacher_video_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views
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
