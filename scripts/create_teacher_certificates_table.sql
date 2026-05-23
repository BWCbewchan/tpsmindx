-- Create teacher_certificates table
CREATE TABLE IF NOT EXISTS teacher_certificates (
    id SERIAL PRIMARY KEY,
    teacher_email VARCHAR(255) NOT NULL,
    certificate_name VARCHAR(500) NOT NULL,
    certificate_url TEXT NOT NULL,
    certificate_type VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    description TEXT,
    cloudinary_public_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on teacher_email for faster queries
CREATE INDEX IF NOT EXISTS idx_teacher_certificates_email ON teacher_certificates(teacher_email);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_teacher_certificates_created_at ON teacher_certificates(created_at DESC);

-- Add comments
COMMENT ON TABLE teacher_certificates IS 'Store teacher certificates and credentials';
COMMENT ON COLUMN teacher_certificates.teacher_email IS 'Email of the teacher (FK to teachers)';
COMMENT ON COLUMN teacher_certificates.certificate_name IS 'Name/title of the certificate';
COMMENT ON COLUMN teacher_certificates.certificate_url IS 'Cloudinary URL of the certificate image/PDF';
COMMENT ON COLUMN teacher_certificates.certificate_type IS 'Type of certificate (e.g., Language, Technology, Teaching)';
COMMENT ON COLUMN teacher_certificates.cloudinary_public_id IS 'Cloudinary public ID for deletion';
