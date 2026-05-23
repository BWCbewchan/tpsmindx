-- Create teacher_privacy_settings table
CREATE TABLE IF NOT EXISTS teacher_privacy_settings (
    id SERIAL PRIMARY KEY,
    teacher_email VARCHAR(255) NOT NULL UNIQUE,
    show_birthday BOOLEAN DEFAULT false,
    show_on_public_list BOOLEAN DEFAULT true,
    show_phone BOOLEAN DEFAULT false,
    show_personal_email BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on teacher_email for faster queries
CREATE INDEX IF NOT EXISTS idx_teacher_privacy_email ON teacher_privacy_settings(teacher_email);

-- Add comments
COMMENT ON TABLE teacher_privacy_settings IS 'Privacy settings for each teacher';
COMMENT ON COLUMN teacher_privacy_settings.teacher_email IS 'Email of the teacher (FK to teachers)';
COMMENT ON COLUMN teacher_privacy_settings.show_birthday IS 'Show birthday on public communications page';
COMMENT ON COLUMN teacher_privacy_settings.show_on_public_list IS 'Show on public teacher list';
COMMENT ON COLUMN teacher_privacy_settings.show_phone IS 'Show phone number publicly';
COMMENT ON COLUMN teacher_privacy_settings.show_personal_email IS 'Show personal email publicly';

-- Insert default settings for existing teachers (optional)
-- This ensures all teachers have privacy settings
-- Uncomment if you want to initialize settings for existing teachers
-- INSERT INTO teacher_privacy_settings (teacher_email, show_birthday, show_on_public_list)
-- SELECT DISTINCT email, true, true FROM teachers
-- ON CONFLICT (teacher_email) DO NOTHING;
