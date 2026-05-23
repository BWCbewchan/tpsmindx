import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Add hidden column to truyenthong_comments
 * GET /api/truyenthong/migrate-add-hidden-column
 */
export async function GET() {
    try {
        const client = await pool.connect();

        try {
            // Add hidden column to truyenthong_comments table
            await client.query(`
                ALTER TABLE truyenthong_comments 
                ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE;
            `);

            // Add index for hidden column for better performance
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_comments_hidden ON truyenthong_comments(hidden);
            `);

            return NextResponse.json({ 
                success: true,
                message: 'Hidden column added to truyenthong_comments successfully' 
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({ 
            error: 'Migration failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
