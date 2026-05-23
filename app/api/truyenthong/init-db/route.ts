import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const client = await pool.connect();

        try {
            await client.query(`
        CREATE TABLE IF NOT EXISTS communications (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          description TEXT,
          content TEXT,
          featured_image TEXT,
          banner_image TEXT,
          post_type TEXT,
          audience TEXT,
          status TEXT DEFAULT 'draft',
          published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          view_count INTEGER DEFAULT 0,
          like_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Add slug column if it doesn't exist (for existing tables)
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communications' AND column_name = 'slug') THEN
                ALTER TABLE communications ADD COLUMN slug TEXT;
                -- Create index for better performance
                CREATE INDEX IF NOT EXISTS idx_communications_slug ON communications(slug);
            END IF;
        END $$;

        -- Add like_count column if it doesn't exist (for existing tables)
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communications' AND column_name = 'like_count') THEN
                ALTER TABLE communications ADD COLUMN like_count INTEGER DEFAULT 0;
            END IF;
        END $$;

        -- Create likes tracking table
        CREATE TABLE IF NOT EXISTS communication_likes (
          id SERIAL PRIMARY KEY,
          post_id INTEGER REFERENCES communications(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(post_id, user_id)
        );
      `);
            return NextResponse.json({ message: 'Table communications created or already exists' });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating table:', error);
        return NextResponse.json({ error: 'Failed to create table' }, { status: 500 });
    }
}
