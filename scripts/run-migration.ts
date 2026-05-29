/**
 * Script to run SQL migrations
 * Usage: npx tsx scripts/run-migration.ts
 */

// Load environment variables BEFORE any other imports
import { config } from 'dotenv';
import { join } from 'path';

// Load .env file first
config({ path: join(process.cwd(), '.env') });

// Now import pool (which will use the loaded env vars)
import pool from '../lib/db';
import { readFileSync } from 'fs';

async function runMigration() {
  try {
    console.log('🚀 Starting migration...');
    console.log('📊 DB Config:', {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
    });
    
    // Read SQL file
    const sqlPath = join(process.cwd(), 'migrations', 'create_ai_usage_tables.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    console.log('📄 SQL file loaded:', sqlPath);
    console.log('📊 Executing migration...');
    
    // Execute SQL
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('ai_usage_logs', 'ai_rate_limits', 'ai_analysis_cache')
      ORDER BY table_name
    `);
    
    console.log('\n📋 Created tables:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Check views
    const viewResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'ai_%'
      ORDER BY table_name
    `);
    
    if (viewResult.rows.length > 0) {
      console.log('\n📊 Created views:');
      viewResult.rows.forEach(row => {
        console.log(`   ✓ ${row.table_name}`);
      });
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
