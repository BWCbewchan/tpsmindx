import pool from '@/lib/db';
import { verifySessionCookieValue } from '@/lib/session-cookie';
import { findCommunicationPostByIdentifier } from '@/lib/truyenthong-posts';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const client = await pool.connect();
        try {
            const lookup = await findCommunicationPostByIdentifier(client, id);
            if (lookup.invalid) {
                return NextResponse.json({ error: 'Post identifier is invalid' }, { status: 400 });
            }
            if (!lookup.post) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }

            const post = lookup.post;
            if (post.status !== 'published') {
                const rawSession = request.cookies.get('tps_session')?.value;
                const session = rawSession ? await verifySessionCookieValue(rawSession) : null;
                if (!session?.canAdminPortal) {
                    return NextResponse.json({ error: 'Not found' }, { status: 404 });
                }
            }

            const postId = post.id;
            const like_count = post.like_count || 0;

            // Reaction breakdown — bao gồm cả reaction null (coi là 'like')
            const reactionResult = await client.query(
                `SELECT COALESCE(reaction, 'like') as reaction, COUNT(*) as count
                 FROM communication_likes
                 WHERE post_id = $1
                 GROUP BY COALESCE(reaction, 'like')
                 ORDER BY count DESC`,
                [postId]
            );

            const reaction_counts: Record<string, number> = {};
            reactionResult.rows.forEach((r: any) => {
                reaction_counts[r.reaction] = parseInt(r.count);
            });

            // Danh sách tất cả người dùng — enrich tên từ nhiều nguồn
            const usersResult = await client.query(
                `SELECT cl.user_id,
                    COALESCE(cl.reaction, 'like') AS reaction,
                    COALESCE(
                        cl.user_name,
                        (SELECT tc.user_name FROM truyenthong_comments tc
                         WHERE tc.user_id = cl.user_id AND tc.user_name IS NOT NULL LIMIT 1),
                        (SELECT pc.user_name FROM post_comments pc
                         WHERE pc.user_id = cl.user_id AND pc.user_name IS NOT NULL LIMIT 1)
                    ) AS user_name,
                    -- Lấy email để lookup teachers
                    COALESCE(
                        (SELECT tc.user_email FROM truyenthong_comments tc
                         WHERE tc.user_id = cl.user_id AND tc.user_email IS NOT NULL LIMIT 1),
                        (SELECT pc.user_email FROM post_comments pc
                         WHERE pc.user_id = cl.user_id AND pc.user_email IS NOT NULL LIMIT 1)
                    ) AS user_email
                 FROM communication_likes cl
                 WHERE cl.post_id = $1
                 ORDER BY cl.created_at DESC
                 LIMIT 100`,
                [postId]
            );

            let users = usersResult.rows as Array<{
                user_id: string; reaction: string;
                user_name: string | null; user_email: string | null
            }>;

            // Enrich từ teachers table qua email
            const nullUsers = users.filter(u => !u.user_name && u.user_email);
            if (nullUsers.length > 0) {
                const emails = nullUsers.map(u => u.user_email!);
                const teacherResult = await client.query(
                    `SELECT work_email, full_name FROM teachers
                     WHERE work_email = ANY($1) AND full_name IS NOT NULL`,
                    [emails]
                );
                const teacherMap: Record<string, string> = {};
                teacherResult.rows.forEach((t: any) => {
                    teacherMap[t.work_email] = t.full_name;
                });

                users = users.map(u => ({
                    ...u,
                    user_name: u.user_name || (u.user_email ? teacherMap[u.user_email] || null : null),
                }));

                // Backfill vào DB
                for (const u of users) {
                    if (u.user_name && !usersResult.rows.find((r: any) => r.user_id === u.user_id && r.user_name)) {
                        client.query(
                            'UPDATE communication_likes SET user_name = $1 WHERE user_id = $2 AND user_name IS NULL',
                            [u.user_name, u.user_id]
                        ).catch(() => {});
                    }
                }
            }

            return NextResponse.json(
                { like_count, reaction_counts, users },
                { headers: { 'Cache-Control': 'no-store' } }
            );
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching reactions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
