-- Tạo bảng explanations để lưu giải trình của giáo viên
CREATE TABLE IF NOT EXISTS explanations (
  id SERIAL PRIMARY KEY,
  teacher_name VARCHAR(255) NOT NULL,
  lms_code VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  campus VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  test_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, rejected
  admin_note TEXT,
  admin_email VARCHAR(255),
  admin_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tạo index để tăng tốc query
CREATE INDEX idx_explanations_email ON explanations(email);
CREATE INDEX idx_explanations_status ON explanations(status);
CREATE INDEX idx_explanations_created_at ON explanations(created_at DESC);

-- Tạo trigger để tự động update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_explanations_updated_at BEFORE UPDATE
    ON explanations FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
