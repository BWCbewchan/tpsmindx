import { NextResponse } from 'next/server';
import pool from '@/lib/db';

interface Comment {
    id: number;
    post_slug: string;
    user_id: string;
    user_name: string;
    user_email?: string;
    content: string;
    parent_id?: number;
    created_at: string;
    updated_at?: string;
    hidden?: boolean;
    reaction_count: number;
    reactions: Array<{ type: string; user_id: string }>;
    replies: Comment[];
}

/**
 * Get comments for a post
 * GET /api/truyenthong/posts/[id]/comments
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const postSlug = id;
        const client = await pool.connect();

        try {
            // Get all comments with reactions count (including hidden ones - will be filtered on client based on user role)
            const result = await client.query(`
                SELECT 
                    c.id,
                    c.post_slug,
                    c.user_id,
                    c.user_name,
                    c.user_email,
                    c.content,
                    c.parent_id,
                    c.hidden,
                    to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                    to_char(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
                    COUNT(DISTINCT cr.id) as reaction_count,
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'type', cr.reaction_type,
                            'user_id', cr.user_id
                        )
                    ) FILTER (WHERE cr.id IS NOT NULL) as reactions
                FROM truyenthong_comments c
                LEFT JOIN truyenthong_comment_reactions cr ON c.id = cr.comment_id
                WHERE c.post_slug = $1
                GROUP BY c.id, c.post_slug, c.user_id, c.user_name, c.user_email, c.content, c.parent_id, c.hidden, c.created_at, c.updated_at
                ORDER BY c.created_at ASC
            `, [postSlug]);

            // Build nested comment structure
            const commentsMap = new Map<number, Comment>();
            const rootComments: Comment[] = [];

            result.rows.forEach(comment => {
                commentsMap.set(comment.id, {
                    ...comment,
                    replies: []
                });
            });

            result.rows.forEach(comment => {
                if (comment.parent_id) {
                    const parent = commentsMap.get(comment.parent_id);
                    const currentComment = commentsMap.get(comment.id);
                    if (parent && currentComment) {
                        parent.replies.push(currentComment);
                    }
                } else {
                    const currentComment = commentsMap.get(comment.id);
                    if (currentComment) {
                        rootComments.push(currentComment);
                    }
                }
            });

            return NextResponse.json(rootComments);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching comments:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * Create a new comment
 * POST /api/truyenthong/posts/[id]/comments
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const postSlug = id;
        const body = await request.json();
        const { userId, userName, userEmail, content, parentId } = body;

        if (!userId || !userName || !content) {
            return NextResponse.json({ 
                error: 'Missing required fields' 
            }, { status: 400 });
        }

        const client = await pool.connect();

        try {
            const result = await client.query(
                `INSERT INTO truyenthong_comments (post_slug, user_id, user_name, user_email, content, parent_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING 
                    id, post_slug, user_id, user_name, user_email, content, parent_id, hidden,
                    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                    to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at`,
                [postSlug, userId, userName, userEmail, content, parentId || null]
            );

            return NextResponse.json(result.rows[0], { status: 201 });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating comment:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
