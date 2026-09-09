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
                { name: 'fix_assignment_answers_constraint', file: 'fix_assignment_answers_constraint.sql' },
                { name: 'optimize_truyenthong_read_indexes', file: 'optimize_truyenthong_read_indexes.sql' },
                { name: 'V93_work_schedule_range_index', file: null, sql: `
                    CREATE INDEX IF NOT EXISTS idx_dangky_lich_lam_date_time
                        ON dangky_lich_lam(ngay, gio_bat_dau, gio_ket_thuc);
                ` },
                { name: 'V94_backfill_communication_notifications', file: null, sql: `
                    WITH active_recipients AS (
                        SELECT LOWER(TRIM(email)) AS recipient_email
                        FROM app_users
                        WHERE is_active IS TRUE
                            AND NULLIF(TRIM(email), '') IS NOT NULL

                        UNION

                        SELECT LOWER(
                            TRIM(
                                COALESCE(
                                    NULLIF(TRIM(work_email), ''),
                                    NULLIF(TRIM("Work email"), '')
                                )
                            )
                        ) AS recipient_email
                        FROM teachers
                        WHERE LOWER(
                            TRIM(
                                COALESCE(
                                    NULLIF(TRIM(status), ''),
                                    NULLIF(TRIM("Status"), ''),
                                    'active'
                                )
                            )
                        ) NOT IN ('deactive', 'inactive', 'disabled')
                    )
                    INSERT INTO notifications (
                        recipient_email,
                        title,
                        content,
                        type,
                        link,
                        is_read,
                        created_at
                    )
                    SELECT
                        recipients.recipient_email,
                        'Bài viết mới: ' || communications.title,
                        COALESCE(communications.description, communications.title),
                        'communication',
                        '/user/truyenthong/' || communications.slug,
                        FALSE,
                        COALESCE(communications.published_at, communications.created_at, NOW())
                    FROM active_recipients recipients
                    CROSS JOIN communications
                    WHERE recipients.recipient_email IS NOT NULL
                        AND POSITION('@' IN recipients.recipient_email) > 1
                        AND communications.status = 'published'
                        AND COALESCE(communications.published_at, communications.created_at)
                            >= NOW() - INTERVAL '180 days'
                        AND NOT EXISTS (
                            SELECT 1
                            FROM notifications existing
                            WHERE LOWER(TRIM(existing.recipient_email)) = recipients.recipient_email
                                AND existing.type = 'communication'
                                AND existing.link = '/user/truyenthong/' || communications.slug
                        );
                ` },
                { name: 'V95_exam_notification_dispatch', file: null, sql: `
                    ALTER TABLE notifications
                    ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(255);

                    CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_recipient_dedupe
                    ON notifications (LOWER(TRIM(recipient_email)), dedupe_key)
                    WHERE dedupe_key IS NOT NULL;

                    CREATE TABLE IF NOT EXISTS notification_dispatch_state (
                        job_name VARCHAR(100) PRIMARY KEY,
                        last_processed_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );

                    INSERT INTO notification_dispatch_state (job_name, last_processed_at)
                    VALUES ('exam_schedule_notifications', CURRENT_TIMESTAMP)
                    ON CONFLICT (job_name) DO NOTHING;
                ` },
                { name: 'V98_exam_feedback_reviews', file: null, sql: `
                    CREATE TABLE IF NOT EXISTS exam_feedback_reviews (
                        id BIGSERIAL PRIMARY KEY,
                        result_id INTEGER NOT NULL UNIQUE
                            REFERENCES chuyen_sau_results(id) ON DELETE CASCADE,
                        set_id INTEGER
                            REFERENCES chuyen_sau_bode(id) ON DELETE SET NULL,
                        set_code VARCHAR(100),
                        set_name VARCHAR(500),
                        subject_code VARCHAR(100),
                        subject_name VARCHAR(500),
                        reviewer_email VARCHAR(255) NOT NULL,
                        reviewer_code VARCHAR(100),
                        reviewer_name VARCHAR(255),
                        rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
                        system_comment TEXT,
                        subject_comment TEXT,
                        status VARCHAR(20) NOT NULL DEFAULT 'new'
                            CHECK (status IN ('new', 'in_progress', 'done')),
                        handled_by_email VARCHAR(255),
                        handled_at TIMESTAMP,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT ck_exam_feedback_has_content CHECK (
                            rating IS NOT NULL
                            OR LENGTH(BTRIM(COALESCE(system_comment, ''))) > 0
                            OR LENGTH(BTRIM(COALESCE(subject_comment, ''))) > 0
                        )
                    );

                    CREATE TABLE IF NOT EXISTS exam_feedback_review_questions (
                        id BIGSERIAL PRIMARY KEY,
                        review_id BIGINT NOT NULL
                            REFERENCES exam_feedback_reviews(id) ON DELETE CASCADE,
                        question_id INTEGER
                            REFERENCES chuyen_sau_cauhoi(id) ON DELETE SET NULL,
                        question_order INTEGER,
                        question_text_snapshot TEXT NOT NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(review_id, question_id)
                    );

                    CREATE INDEX IF NOT EXISTS idx_exam_feedback_reviews_set_id
                        ON exam_feedback_reviews(set_id);
                    CREATE INDEX IF NOT EXISTS idx_exam_feedback_reviews_subject_code
                        ON exam_feedback_reviews(subject_code);
                    CREATE INDEX IF NOT EXISTS idx_exam_feedback_reviews_status_created_at
                        ON exam_feedback_reviews(status, created_at DESC);
                    CREATE INDEX IF NOT EXISTS idx_exam_feedback_reviews_created_at
                        ON exam_feedback_reviews(created_at DESC);
                    CREATE INDEX IF NOT EXISTS idx_exam_feedback_review_questions_question
                        ON exam_feedback_review_questions(question_id);

                    DROP TRIGGER IF EXISTS trg_exam_feedback_reviews_updated_at
                        ON exam_feedback_reviews;
                    CREATE TRIGGER trg_exam_feedback_reviews_updated_at
                    BEFORE UPDATE ON exam_feedback_reviews
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                ` },
                { name: 'V99_push_subscriptions', file: null, sql: `
                    CREATE TABLE IF NOT EXISTS push_subscriptions (
                        id BIGSERIAL PRIMARY KEY,
                        recipient_email VARCHAR(255) NOT NULL,
                        endpoint TEXT NOT NULL UNIQUE,
                        p256dh TEXT NOT NULL,
                        auth_secret TEXT NOT NULL,
                        user_agent TEXT,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        last_success_at TIMESTAMP WITH TIME ZONE
                    );

                    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_recipient_email
                        ON push_subscriptions(LOWER(recipient_email));

                    DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at
                        ON push_subscriptions;
                    CREATE TRIGGER trg_push_subscriptions_updated_at
                    BEFORE UPDATE ON push_subscriptions
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                ` },
                { name: 'V100_teaching_document_folders', file: '../migrations/add_teaching_document_folders.sql' },
                { name: 'V101_teaching_document_material_links', file: '../migrations/add_teaching_document_material_links.sql' },
                { name: 'V102_hr_training_absence_notes', file: '../migrations/add_hr_training_absence_notes.sql' },
                { name: 'V103_training_assignment_context', file: '../migrations/add_training_assignment_context.sql' },
                { name: 'V103_hr_candidate_pedagogy_certificate_url', file: '../migrations/add_hr_candidate_pedagogy_certificate_url.sql' },
                { name: 'V104_k12_leader_documents', file: '../migrations/V104_k12_leader_documents.sql' },
                { name: 'V105_quan_ly_qc', file: '../migrations/create_quan_ly_qc.sql' },
                { name: 'V106_quan_ly_qc_teacher_account_and_scaled_score', file: '../migrations/update_quan_ly_qc_teacher_account_and_scaled_score.sql' },
                { name: 'V107_trial_checkout_raw', file: '../migrations/V107_trial_checkout_raw.sql' },
                { name: 'V108_trial_checkout_excel_view', file: '../migrations/V108_trial_checkout_excel_view.sql' }
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
