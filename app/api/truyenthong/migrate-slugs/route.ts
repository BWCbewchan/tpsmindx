import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateSlug } from '@/lib/utils';

/**
 * API endpoint to populate slugs for existing posts
 * Call this endpoint once after adding the slug column
 * GET /api/truyenthong/migrate-slugs
 */
export async function GET() {
    try {
        const client = await pool.connect();

        try {
            // Get all posts without slugs
            const postsResult = await client.query(
                'SELECT id, title, slug FROM communications ORDER BY id'
            );

            const posts = postsResult.rows;
            const updates: Array<{ id: number; slug: string }> = [];
            const slugsUsed = new Set<string>();

            for (const post of posts) {
                // If post already has a slug, add it to the set
                if (post.slug) {
                    slugsUsed.add(post.slug);
                    continue;
                }

                // Generate slug for posts without slug
                let slug = generateSlug(post.title);
                let counter = 1;

                // Make slug unique
                while (slugsUsed.has(slug)) {
                    slug = `${generateSlug(post.title)}-${counter}`;
                    counter++;
                }

                slugsUsed.add(slug);
                updates.push({ id: post.id, slug });
            }

            // Update posts with new slugs
            for (const update of updates) {
                await client.query(
                    'UPDATE communications SET slug = $1 WHERE id = $2',
                    [update.slug, update.id]
                );
            }

            return NextResponse.json({
                success: true,
                message: `Successfully populated slugs for ${updates.length} posts`,
                totalPosts: posts.length,
                updatedPosts: updates.length,
                updates: updates
            });

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error populating slugs:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to populate slugs',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
