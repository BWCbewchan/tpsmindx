-- Add hidden column to truyenthong_comments table
ALTER TABLE truyenthong_comments 
ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE;

-- Add index for hidden column for better performance
CREATE INDEX IF NOT EXISTS idx_comments_hidden ON truyenthong_comments(hidden);

COMMENT ON COLUMN truyenthong_comments.hidden IS 'Flag to hide comment from public view (set by admin)';
