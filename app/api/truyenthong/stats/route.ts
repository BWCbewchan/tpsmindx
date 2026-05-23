import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const client = await pool.connect();
        try {
            // Get total posts
            const totalPostsResult = await client.query('SELECT COUNT(*) FROM communications');
            const totalPosts = parseInt(totalPostsResult.rows[0].count);

            // Get total views
            const totalViewsResult = await client.query('SELECT SUM(view_count) FROM communications');
            const totalViews = parseInt(totalViewsResult.rows[0].sum || '0');

            // Get total likes
            const totalLikesResult = await client.query('SELECT SUM(like_count) FROM communications');
            const totalLikes = parseInt(totalLikesResult.rows[0].sum || '0');

            // Get recent 5 posts
            const recentPostsResult = await client.query(`
        SELECT id, slug, title, published_at, view_count, status 
        FROM communications 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
            const recentPosts = recentPostsResult.rows;

            const commentsAggResult = await client.query(`
        SELECT
          COUNT(*)::int AS total_comments,
          COUNT(*) FILTER (WHERE hidden IS TRUE)::int AS hidden_comments
        FROM truyenthong_comments
      `);
            const totalComments = parseInt(commentsAggResult.rows[0]?.total_comments || '0', 10);
            const totalCommentsHidden = parseInt(commentsAggResult.rows[0]?.hidden_comments || '0', 10);
            const totalCommentsShown = Math.max(0, totalComments - totalCommentsHidden);

            return NextResponse.json({
                totalPosts,
                totalViews,
                totalLikes,
                totalComments,
                totalCommentsShown,
                totalCommentsHidden,
                recentPosts,
                growth: 0,
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
