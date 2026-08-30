import pool from '@/lib/db';
import {
    findCommunicationPostByIdentifier,
    resolveTruyenThongPostAdmin,
} from '@/lib/truyenthong-posts';
import { NextRequest, NextResponse } from 'next/server';

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
            if (!lookup.post) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }

            const post = lookup.post;
            if (post.status !== 'published' && !adminAuth) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

            // Danh sách người thả cảm xúc, enrich tên từ nhiều nguồn cũ/mới.
            const usersResult = await client.query(
                `SELECT cl.user_id,
                    COALESCE(cl.reaction, 'like') AS reaction,
                    COALESCE(
                        NULLIF(TRIM(cl.user_name), ''),
                        (SELECT NULLIF(TRIM(au.display_name), '')
                         FROM app_users au
                         WHERE LOWER(TRIM(au.email)) = LOWER(TRIM(cl.user_id))
                           AND au.is_active = true
                         LIMIT 1),
                        (SELECT NULLIF(TRIM(COALESCE(t.full_name, t."Full name")), '')
                         FROM teachers t
                         WHERE LOWER(TRIM(COALESCE(t.work_email, t."Work email", ''))) = LOWER(TRIM(cl.user_id))
                         LIMIT 1),
                        (SELECT tc.user_name FROM truyenthong_comments tc
                         WHERE tc.user_id = cl.user_id AND NULLIF(TRIM(tc.user_name), '') IS NOT NULL LIMIT 1),
                        (SELECT pc.user_name FROM post_comments pc
                         WHERE pc.user_id = cl.user_id AND NULLIF(TRIM(pc.user_name), '') IS NOT NULL LIMIT 1),
                        NULLIF(split_part(cl.user_id, '@', 1), '')
                    ) AS user_name
                 FROM communication_likes cl
                 WHERE cl.post_id = $1
                 ORDER BY cl.created_at DESC
                 LIMIT 100`,
                [postId]
            );

            let users = usersResult.rows as Array<{
                user_id: string;
                reaction: string;
                user_name: string | null;
            }>;

            users = users.map((u) => ({
                ...u,
                user_name: typeof u.user_name === 'string' ? u.user_name.trim() || null : null,
            }));

            // Backfill tên để các lần sau không phải enrich lại quá nhiều.
            for (const u of users) {
                if (u.user_name) {
                    client.query(
                        `UPDATE communication_likes
                         SET user_name = $1
                         WHERE post_id = $2
                           AND user_id = $3
                           AND NULLIF(TRIM(user_name), '') IS NULL`,
                        [u.user_name, postId, u.user_id],
                    ).catch(() => {});
                }
            }

            const publicUsers = users.map((user, index) => ({
                user_id: `reaction-user-${index + 1}`,
                user_name: user.user_name,
                reaction: user.reaction,
            }));

            return NextResponse.json(
                { like_count, reaction_counts, users: publicUsers },
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
