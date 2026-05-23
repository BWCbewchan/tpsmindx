-- Create truyenthong_comments table
CREATE TABLE IF NOT EXISTS truyenthong_comments (
    id SERIAL PRIMARY KEY,
    post_slug VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255),
    content TEXT NOT NULL,
    parent_id INTEGER REFERENCES truyenthong_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create truyenthong_comment_reactions table
CREATE TABLE IF NOT EXISTS truyenthong_comment_reactions (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES truyenthong_comments(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    reaction_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_comments_post_slug ON truyenthong_comments(post_slug);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON truyenthong_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON truyenthong_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON truyenthong_comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON truyenthong_comment_reactions(user_id);

-- Add foreign key constraint to truyenthong_posts if exists
-- Uncomment the line below if you want to enforce referential integrity with posts table
-- ALTER TABLE truyenthong_comments ADD CONSTRAINT fk_comments_post 
--     FOREIGN KEY (post_slug) REFERENCES truyenthong_posts(slug) ON DELETE CASCADE;

COMMENT ON TABLE truyenthong_comments IS 'Store all comments for blog posts';
COMMENT ON TABLE truyenthong_comment_reactions IS 'Store reactions (like, love, etc.) for comments';
