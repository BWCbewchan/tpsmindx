import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Initialize comments and reactions tables for posts
 * GET /api/truyenthong/init-comments
 */
export async function GET() {
    try {
        const client = await pool.connect();

        try {
            // Create comments table
            await client.query(`
                CREATE TABLE IF NOT EXISTS post_comments (
                    id SERIAL PRIMARY KEY,
                    post_id INTEGER REFERENCES communications(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL,
                    user_name TEXT NOT NULL,
                    user_email TEXT,
                    content TEXT NOT NULL,
                    parent_id INTEGER REFERENCES post_comments(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                -- Create index for better performance
                CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
                CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON post_comments(parent_id);
            `);

            // Create comment reactions table
            await client.query(`
                CREATE TABLE IF NOT EXISTS comment_reactions (
                    id SERIAL PRIMARY KEY,
                    comment_id INTEGER REFERENCES post_comments(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL,
                    reaction_type TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(comment_id, user_id)
                );

                -- Create index for better performance
                CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id);
            `);

            return NextResponse.json({ 
                success: true,
                message: 'Comments tables created successfully' 
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating comments tables:', error);
        return NextResponse.json({ 
            success: false,
            error: 'Failed to create tables',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
