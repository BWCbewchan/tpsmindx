import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireCommunicationActor } from '@/lib/communication-actor';
import { sanitizeText } from '@/lib/server-sanitize-html';
import {
    findCommunicationPostByIdentifier,
    resolveTruyenThongPostAdmin,
} from '@/lib/truyenthong-posts';

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

const MAX_COMMENT_CONTENT_LENGTH = 2000;

function normalizeCommentContent(value: unknown): string {
    return sanitizeText(String(value ?? '')).slice(0, MAX_COMMENT_CONTENT_LENGTH);
}

function normalizeOptionalCommentId(value: unknown): number | null | false {
    if (value === null || value === undefined || value === '') return null;
    const text = String(value).trim();
    if (!/^\d+$/.test(text)) return false;
    const parsed = Number.parseInt(text, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : false;
}

/**
 * Get comments for a post
 * GET /api/truyenthong/posts/[id]/comments
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const adminAuth = await resolveTruyenThongPostAdmin(request);
        const client = await pool.connect();

        try {
            const lookup = await findCommunicationPostByIdentifier(client, id, {
                summary: true,
            });
            if (lookup.invalid) {
                return NextResponse.json({ error: 'Post identifier is invalid' }, { status: 400 });
            }

            if (!lookup.post || (lookup.post.status !== 'published' && !adminAuth)) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }

            const postSlug = lookup.post.slug;
            const canSeeHidden = Boolean(adminAuth);

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
                  AND ($2::boolean OR c.hidden IS NOT TRUE)
                GROUP BY c.id, c.post_slug, c.user_id, c.user_name, c.user_email, c.content, c.parent_id, c.hidden, c.created_at, c.updated_at
                ORDER BY c.created_at ASC
            `, [postSlug, canSeeHidden]);

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
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const actor = await requireCommunicationActor(request);
        if (!actor.ok) return actor.response;

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Request body không hợp lệ' }, { status: 400 });
        }
        const { content, parentId } = body;
        const safeContent = normalizeCommentContent(content);
        const safeParentId = normalizeOptionalCommentId(parentId);

        if (!safeContent) {
            return NextResponse.json({ 
                error: 'Missing required fields' 
            }, { status: 400 });
        }
        if (safeParentId === false) {
            return NextResponse.json({ error: 'parentId is invalid' }, { status: 400 });
        }

        const client = await pool.connect();

        try {
            const lookup = await findCommunicationPostByIdentifier(client, id, {
                summary: true,
            });
            if (lookup.invalid) {
                return NextResponse.json({ error: 'Post identifier is invalid' }, { status: 400 });
            }
            if (!lookup.post || (lookup.post.status !== 'published' && !actor.isAdmin)) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }

            const postSlug = lookup.post.slug;
            if (safeParentId !== null) {
                const parent = await client.query(
                    'SELECT hidden FROM truyenthong_comments WHERE id = $1 AND post_slug = $2 LIMIT 1',
                    [safeParentId, postSlug],
                );
                if (parent.rows.length === 0) {
                    return NextResponse.json({ error: 'Parent comment not found' }, { status: 400 });
                }
                if (parent.rows[0]?.hidden === true && !actor.isAdmin) {
                    return NextResponse.json({ error: 'Parent comment not found' }, { status: 400 });
                }
            }

            const result = await client.query(
                `INSERT INTO truyenthong_comments (post_slug, user_id, user_name, user_email, content, parent_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING 
                    id, post_slug, user_id, user_name, user_email, content, parent_id, hidden,
                    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                    to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at`,
                [postSlug, actor.userId, actor.userName, actor.userEmail, safeContent, safeParentId]
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
