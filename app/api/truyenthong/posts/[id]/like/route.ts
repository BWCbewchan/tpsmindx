import pool from '@/lib/db';
import { verifySessionCookieValue } from '@/lib/session-cookie';
import { findCommunicationPostByIdentifier } from '@/lib/truyenthong-posts';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { userId, reaction, userName } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            const lookup = await findCommunicationPostByIdentifier(client, id);
            if (lookup.invalid) {
                return NextResponse.json({ error: 'Post identifier is invalid' }, { status: 400 });
            }
            if (!lookup.post) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }

            const post = lookup.post;
            if (post.status !== 'published') {
                const rawSession = request.cookies.get('tps_session')?.value;
                const session = rawSession ? await verifySessionCookieValue(rawSession) : null;
                if (!session?.canAdminPortal) {
                    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
                }
            }

            const postId = post.id;

            let finalUserName = userName;
            if (!finalUserName) {
                try {
                    const rawSession = request.cookies.get('tps_session')?.value;
                    if (rawSession) {
                        const session = await verifySessionCookieValue(rawSession);
                        if (session?.email) {
                            finalUserName = session.email.split('@')[0];
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }

            await client.query('BEGIN');

            // Check if user already liked the post
            const checkLike = await client.query(
                'SELECT id, reaction FROM communication_likes WHERE post_id = $1 AND user_id = $2',
                [postId, userId]
            );

            let isLiked = false;
            let savedReaction: string | null = null;
            let action = '';

            if (checkLike.rows.length > 0) {
                const existingReaction = checkLike.rows[0].reaction;
                // Same reaction → unlike; different reaction → update
                if (!reaction || existingReaction === reaction) {
                    await client.query(
                        'DELETE FROM communication_likes WHERE post_id = $1 AND user_id = $2',
                        [postId, userId]
                    );
                    await client.query(
                        'UPDATE communications SET like_count = like_count - 1 WHERE id = $1',
                        [postId]
                    );
                    isLiked = false;
                    savedReaction = null;
                    action = 'unliked';
                } else {
                    // Update reaction, ensure we also update user_name if we have it now but it was null before
                    await client.query(
                        'UPDATE communication_likes SET reaction = $1, user_name = COALESCE(user_name, $4) WHERE post_id = $2 AND user_id = $3',
                        [reaction, postId, userId, finalUserName || 'Ẩn danh']
                    );
                    isLiked = true;
                    savedReaction = reaction;
                    action = 'reacted';
                }
            } else {
                await client.query(
                    'INSERT INTO communication_likes (post_id, user_id, reaction, user_name) VALUES ($1, $2, $3, $4)',
                    [postId, userId, reaction || 'like', finalUserName || 'Ẩn danh']
                );
                await client.query(
                    'UPDATE communications SET like_count = like_count + 1 WHERE id = $1',
                    [postId]
                );
                isLiked = true;
                savedReaction = reaction || 'like';
                action = 'liked';
            }

            await client.query('COMMIT');

            // Get updated like count + reaction breakdown
            const result = await client.query(
                'SELECT like_count FROM communications WHERE id = $1',
                [postId]
            );

            const reactionCountsResult = await client.query(
                `SELECT reaction, COUNT(*) as count
                 FROM communication_likes
                 WHERE post_id = $1 AND reaction IS NOT NULL
                 GROUP BY reaction ORDER BY count DESC`,
                [postId]
            );
            const reaction_counts: Record<string, number> = {};
            reactionCountsResult.rows.forEach((r: any) => {
                reaction_counts[r.reaction] = parseInt(r.count);
            });

            return NextResponse.json({
                like_count: result.rows[0].like_count,
                isLiked,
                reaction: savedReaction,
                reaction_counts,
                action
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error toggling like:', error);
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error processing like request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
