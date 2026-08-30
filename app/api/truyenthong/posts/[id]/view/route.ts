import pool from '@/lib/db';
import { requireSameOriginMutation } from '@/lib/api-security';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import {
    findCommunicationPostByIdentifier,
    resolveTruyenThongPostAdmin,
} from '@/lib/truyenthong-posts';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const originDenied = requireSameOriginMutation(request);
        if (originDenied) return originDenied;
        const limited = await rateLimitOr429Async(`post-view:${clientIpFromRequest(request)}`, 300, 60_000);
        if (limited) return limited;

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
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }

            const post = lookup.post;
            if (post.status !== 'published' && !adminAuth) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
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
