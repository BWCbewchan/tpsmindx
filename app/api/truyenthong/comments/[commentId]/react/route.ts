import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireCommunicationActor } from '@/lib/communication-actor';

const ALLOWED_REACTIONS = new Set(['like', 'love', 'haha', 'sad', 'angry']);

function normalizeCommentId(value: unknown): number | null {
    const text = String(value ?? '').trim();
    if (!/^\d+$/.test(text)) return null;
    const parsed = Number.parseInt(text, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Toggle reaction on a comment
 * POST /api/truyenthong/comments/[commentId]/react
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ commentId: string }> }
) {
    try {
        const { commentId } = await params;
        const safeCommentId = normalizeCommentId(commentId);
        if (!safeCommentId) {
            return NextResponse.json({ error: 'Invalid commentId' }, { status: 400 });
        }

        const actor = await requireCommunicationActor(request);
        if (!actor.ok) return actor.response;

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Request body không hợp lệ' }, { status: 400 });
        }
        const { reactionType } = body;

        if (typeof reactionType !== 'string' || !ALLOWED_REACTIONS.has(reactionType)) {
            return NextResponse.json({ 
                error: 'Invalid reactionType' 
            }, { status: 400 });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const commentAccess = await client.query(
                `SELECT c.hidden, p.status AS post_status
                 FROM truyenthong_comments c
                 JOIN communications p ON p.slug = c.post_slug
                 WHERE c.id = $1
                 LIMIT 1`,
                [safeCommentId],
            );
            if (commentAccess.rows.length === 0) {
                await client.query('ROLLBACK');
                return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
            }

            const target = commentAccess.rows[0];
            if ((target.post_status !== 'published' || target.hidden === true) && !actor.isAdmin) {
                await client.query('ROLLBACK');
                return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
            }

            // Check if user already reacted
            const existingReaction = await client.query(
                'SELECT * FROM truyenthong_comment_reactions WHERE comment_id = $1 AND user_id = $2',
                [safeCommentId, actor.userId]
            );

            if (existingReaction.rows.length > 0) {
                const existing = existingReaction.rows[0];
                
                if (existing.reaction_type === reactionType) {
                    // Remove reaction if same type
                    await client.query(
                        'DELETE FROM truyenthong_comment_reactions WHERE comment_id = $1 AND user_id = $2',
                        [safeCommentId, actor.userId]
                    );
                } else {
                    // Update to new reaction type
                    await client.query(
                        'UPDATE truyenthong_comment_reactions SET reaction_type = $1 WHERE comment_id = $2 AND user_id = $3',
                        [reactionType, safeCommentId, actor.userId]
                    );
                }
            } else {
                // Add new reaction
                await client.query(
                    'INSERT INTO truyenthong_comment_reactions (comment_id, user_id, reaction_type) VALUES ($1, $2, $3)',
                    [safeCommentId, actor.userId, reactionType]
                );
            }

            await client.query('COMMIT');

            // Get updated reactions
            const reactions = await client.query(
                `SELECT reaction_type, COUNT(*) as count
                 FROM truyenthong_comment_reactions
                 WHERE comment_id = $1
                 GROUP BY reaction_type`,
                [safeCommentId]
            );

            return NextResponse.json({
                success: true,
                reactions: reactions.rows
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error toggling reaction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
