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
            
            const result = await client.query(
                'UPDATE communications SET view_count = view_count + 1 WHERE id = $1 RETURNING view_count',
                [postId]
            );

            return NextResponse.json({ view_count: result.rows[0].view_count });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error incrementing view count:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
