/**
 * Script chạy tất cả database migrations
 * Sử dụng: npm run db:migrate
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false,
    },
});

const defaultScreenCatalog = require('../lib/default-screen-catalog.json');

async function main() {
    console.log('🔌 Connecting to database...');
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Database: ${process.env.DB_NAME}`);

    try {
        // Test connection
        const res = await pool.query('SELECT NOW()');
        console.log(`✅ Connected! Server time: ${res.rows[0].now}\n`);
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        process.exit(1);
    }

    // Import migrations dynamically (need to handle TS → JS)
    // Since this is a JS script, we read the migrations from a simplified approach
    console.log('🔄 Running migrations...\n');

    // Step 1: Create _migrations table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      version INTEGER NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

    // Step 2: Get applied migrations
    const applied = await pool.query('SELECT name FROM _migrations');
    const appliedSet = new Set(applied.rows.map(r => r.name));

    // Step 3: Read SQL files from scripts directory and also run inline migrations
    const fs = require('fs');
    const path = require('path');

    const sqlFiles = [
        {
            name: 'create_communications', file: null, sql: `
      CREATE TABLE IF NOT EXISTS communications (
        id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
        description TEXT, content TEXT, featured_image TEXT, banner_image TEXT,
        post_type TEXT, audience TEXT, status TEXT DEFAULT 'draft',
        published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        view_count INTEGER DEFAULT 0, like_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `},
        {
            name: 'create_communication_likes', file: null, sql: `
      CREATE TABLE IF NOT EXISTS communication_likes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES communications(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      );
    `},
        { name: 'create_explanations', file: 'create_explanations_table.sql' },
        { name: 'create_teacher_certificates', file: 'create_teacher_certificates_table.sql' },
        { name: 'create_teacher_privacy_settings', file: 'create_teacher_privacy_settings_table.sql' },
                { name: 'create_truyenthong_comments', file: 'create_truyenthong_comments_tables.sql' },
                { name: 'create_training_tables', file: 'create_training_tables_postgres.sql' },
                { name: 'create_app_screens', file: null, sql: `
            CREATE TABLE IF NOT EXISTS app_screens (
                id SERIAL PRIMARY KEY,
                route_path VARCHAR(255) NOT NULL UNIQUE,
                label VARCHAR(255) NOT NULL,
                group_name VARCHAR(100) NOT NULL,
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE app_screens ADD COLUMN IF NOT EXISTS label VARCHAR(255) NOT NULL DEFAULT '';
            ALTER TABLE app_screens ADD COLUMN IF NOT EXISTS group_name VARCHAR(100) NOT NULL DEFAULT 'Hệ thống';
            ALTER TABLE app_screens ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
            ALTER TABLE app_screens ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
            ALTER TABLE app_screens ADD COLUMN IF NOT EXISTS description TEXT;
            ALTER TABLE app_screens ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE app_screens ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

            CREATE INDEX IF NOT EXISTS idx_app_screens_group_name ON app_screens(group_name);
            CREATE INDEX IF NOT EXISTS idx_app_screens_is_active ON app_screens(is_active);
            CREATE INDEX IF NOT EXISTS idx_app_screens_sort_order ON app_screens(sort_order);

            INSERT INTO app_screens (route_path, label, group_name, sort_order, description, is_active)
            SELECT route_path, label, group_name, sort_order, description, is_active
            FROM jsonb_to_recordset('${JSON.stringify(defaultScreenCatalog).replace(/'/g, "''")}'::jsonb)
                AS x(route_path text, label text, group_name text, sort_order integer, description text, is_active boolean)
            ON CONFLICT (route_path) DO NOTHING;
        ` },
                { name: 'create_system_events', file: null, sql: `
                        CREATE TABLE IF NOT EXISTS system_events (
                            id BIGSERIAL PRIMARY KEY,
                            event_name VARCHAR(100) NOT NULL,
                            user_id VARCHAR(255),
                            session_id VARCHAR(100),
                            properties JSONB NOT NULL DEFAULT '{}'::jsonb,
                            user_agent VARCHAR(500) DEFAULT '',
                            ip_address VARCHAR(45),
                            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                        );

                        CREATE INDEX IF NOT EXISTS idx_system_events_event_name_created_at
                            ON system_events(event_name, created_at DESC);
                        CREATE INDEX IF NOT EXISTS idx_system_events_created_at
                            ON system_events(created_at DESC);
                        CREATE INDEX IF NOT EXISTS idx_system_events_user_id_created_at
                            ON system_events(user_id, created_at DESC);
                        CREATE INDEX IF NOT EXISTS idx_system_events_session_id_created_at
                            ON system_events(session_id, created_at DESC);
                ` },
                { name: 'fix_assignment_answers_constraint', file: 'fix_assignment_answers_constraint.sql' }
        ];


    let appliedCount = 0;
    let errorCount = 0;

    for (const entry of sqlFiles) {
        if (appliedSet.has(entry.name)) {
            console.log(`  ⏭️  Skip: ${entry.name} (already applied)`);
            continue;
        }

        let sql = entry.sql;
        if (entry.file) {
            const filePath = path.join(__dirname, entry.file);
            if (!fs.existsSync(filePath)) {
                console.log(`  ⚠️  File not found: ${entry.file}`);
                continue;
            }
            sql = fs.readFileSync(filePath, 'utf8');
        }

        try {
            await pool.query('BEGIN');
            await pool.query(sql);
            await pool.query(
                'INSERT INTO _migrations (name, version) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
                [entry.name, appliedCount + 1]
            );
            await pool.query('COMMIT');
            console.log(`  ✅ Applied: ${entry.name}`);
            appliedCount++;
        } catch (err) {
            await pool.query('ROLLBACK');
            console.error(`  ❌ Failed: ${entry.name} - ${err.message}`);
            errorCount++;
        }
    }

    console.log(`\n📊 Summary: ${appliedCount} applied, ${errorCount} errors, ${appliedSet.size} already up-to-date`);

    // Show all tables
    const tables = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
    console.log(`\n📋 All tables (${tables.rows.length}):`);
    tables.rows.forEach(t => console.log(`   - ${t.tablename}`));

    await pool.end();
    console.log('\n✨ Done!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
