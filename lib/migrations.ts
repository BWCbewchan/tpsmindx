import { Pool } from 'pg'
import { DEFAULT_SCREEN_CATALOG_JSON } from './default-screen-catalog'

// ============================================================
// Hệ thống Migration tự động cho TPS
// Khi chạy app, tất cả tables sẽ được tạo tự động nếu chưa có
// Thêm chức năng mới → thêm migration vào danh sách → restart app
// ============================================================

interface Migration {
  name: string
  version: number
  sql: string
}

const migrations: Migration[] = [
  {
    name: 'initial_setup_v5_complete',
    version: 1,
    sql: `
      -- 1. Function updated_at
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- 2. Core Auth & System Tables
      CREATE TABLE IF NOT EXISTS roles (
        role_code VARCHAR(20) PRIMARY KEY,
        role_name VARCHAR(255) NOT NULL,
        description TEXT,
        department VARCHAR(100) DEFAULT 'Other',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT 'Other';
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(255),
        password_hash VARCHAR(255),
        display_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'admin',
        auth_type VARCHAR(20) DEFAULT 'app',
        is_active BOOLEAN DEFAULT true,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS username VARCHAR(255);
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20) DEFAULT 'app';
      CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
      CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username);

      CREATE TABLE IF NOT EXISTS app_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        route_path VARCHAR(255) NOT NULL,
        can_access BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_route UNIQUE (user_id, route_path)
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role_code VARCHAR(20) NOT NULL REFERENCES roles(role_code) ON DELETE CASCADE,
        route_path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role_code, route_path)
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        role_code VARCHAR(20) NOT NULL REFERENCES roles(role_code) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, role_code)
      );

      CREATE TABLE IF NOT EXISTS centers (
        id SERIAL PRIMARY KEY,
        region VARCHAR(100),
        short_code VARCHAR(50) UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        email VARCHAR(255),
        status VARCHAR(20) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE centers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';
      ALTER TABLE centers ADD COLUMN IF NOT EXISTS email VARCHAR(255);

      CREATE TABLE IF NOT EXISTS teaching_leaders (
        code VARCHAR(50) PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        role_code VARCHAR(20) REFERENCES roles(role_code),
        role_name VARCHAR(255),
        center VARCHAR(255),
        courses TEXT,
        area VARCHAR(100),
        status VARCHAR(20) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE teaching_leaders ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';

      -- 3. Teacher Core Tables (Dữ liệu từ Google Sheet)
      CREATE TABLE IF NOT EXISTS teachers (
        code VARCHAR(50) PRIMARY KEY,
        "Full name" VARCHAR(255),
        "User name" VARCHAR(100),
        "Work email" VARCHAR(255),
        "Main centre" VARCHAR(255),
        "Status" VARCHAR(50) DEFAULT 'Active',
        "Course Line" VARCHAR(100),
        full_name VARCHAR(255),
        user_name VARCHAR(100),
        work_email VARCHAR(255),
        main_centre VARCHAR(255),
        course_line VARCHAR(100),
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS "Full name" VARCHAR(255);
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS "User name" VARCHAR(100);
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS "Work email" VARCHAR(255);
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS "Main centre" VARCHAR(255);
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS "Status" VARCHAR(50) DEFAULT 'Active';
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS "Course Line" VARCHAR(100);

      -- 4. Content & Training Tables
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

      CREATE TABLE IF NOT EXISTS post_comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES communications(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_email TEXT,
        content TEXT NOT NULL,
        parent_id INTEGER REFERENCES post_comments(id) ON DELETE CASCADE,
        is_hidden BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS training_videos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        video_link VARCHAR(1000) NOT NULL,
        start_date DATE NOT NULL,
        duration_minutes INTEGER,
        view_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft',
        description TEXT,
        thumbnail_url VARCHAR(1000),
        lesson_number INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS training_teacher_stats (
        id SERIAL PRIMARY KEY,
        teacher_code VARCHAR(50) NOT NULL UNIQUE,
        full_name VARCHAR(200) NOT NULL,
        username VARCHAR(100),
        work_email VARCHAR(200) NOT NULL,
        phone_number VARCHAR(20),
        status VARCHAR(50) DEFAULT 'Active',
        center VARCHAR(200),
        teaching_block VARCHAR(100),
        position VARCHAR(100),
        total_score DECIMAL(5, 2) DEFAULT 0.00,
        total_videos_assigned INTEGER DEFAULT 0,
        videos_completed INTEGER DEFAULT 0,
        avg_video_score DECIMAL(5, 2) DEFAULT 0.00,
        total_assignments_taken INTEGER DEFAULT 0,
        assignments_passed INTEGER DEFAULT 0,
        avg_assignment_score DECIMAL(5, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE training_teacher_stats ADD COLUMN IF NOT EXISTS total_videos_assigned INTEGER DEFAULT 0;
      ALTER TABLE training_teacher_stats ADD COLUMN IF NOT EXISTS videos_completed INTEGER DEFAULT 0;
      ALTER TABLE training_teacher_stats ADD COLUMN IF NOT EXISTS avg_video_score DECIMAL(5, 2) DEFAULT 0.00;
      ALTER TABLE training_teacher_stats ADD COLUMN IF NOT EXISTS total_assignments_taken INTEGER DEFAULT 0;
      ALTER TABLE training_teacher_stats ADD COLUMN IF NOT EXISTS assignments_passed INTEGER DEFAULT 0;
      ALTER TABLE training_teacher_stats ADD COLUMN IF NOT EXISTS avg_assignment_score DECIMAL(5, 2) DEFAULT 0.00;

      CREATE TABLE IF NOT EXISTS training_teacher_video_scores (
        id SERIAL PRIMARY KEY,
        teacher_code VARCHAR(50) NOT NULL REFERENCES training_teacher_stats(teacher_code) ON DELETE CASCADE,
        video_id INTEGER NOT NULL REFERENCES training_videos(id) ON DELETE CASCADE,
        score DECIMAL(5, 2) DEFAULT 0.00,
        completion_status VARCHAR(20) DEFAULT 'not_started',
        view_count INTEGER DEFAULT 0,
        first_viewed_at TIMESTAMP,
        completed_at TIMESTAMP,
        time_spent_seconds INTEGER DEFAULT 0,
        assigned_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_teacher_video UNIQUE (teacher_code, video_id)
      );

      CREATE TABLE IF NOT EXISTS training_video_assignments (
        id SERIAL PRIMARY KEY,
        video_id INTEGER REFERENCES training_videos(id) ON DELETE CASCADE,
        assignment_title VARCHAR(500) NOT NULL,
        assignment_type VARCHAR(20) DEFAULT 'quiz',
        description TEXT,
        total_points DECIMAL(5, 2) DEFAULT 10.00,
        passing_score DECIMAL(5, 2) DEFAULT 7.00,
        time_limit_minutes INTEGER,
        max_attempts INTEGER DEFAULT 1,
        is_required BOOLEAN DEFAULT TRUE,
        due_date TIMESTAMP,
        status VARCHAR(20) DEFAULT 'published',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS training_assignment_submissions (
        id SERIAL PRIMARY KEY,
        teacher_code VARCHAR(50) NOT NULL,
        assignment_id INTEGER NOT NULL REFERENCES training_video_assignments(id) ON DELETE CASCADE,
        attempt_number INTEGER DEFAULT 1,
        score DECIMAL(5, 2) DEFAULT 0.00,
        total_points DECIMAL(5, 2),
        percentage DECIMAL(5, 2),
        is_passed BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'in_progress',
        started_at TIMESTAMP,
        submitted_at TIMESTAMP,
        graded_at TIMESTAMP,
        time_spent_seconds INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_teacher_assignment_attempt UNIQUE (teacher_code, assignment_id, attempt_number)
      );

      CREATE TABLE IF NOT EXISTS k12_documents (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(400) NOT NULL UNIQUE,
        title VARCHAR(500) NOT NULL,
        relative_path VARCHAR(600) NOT NULL UNIQUE,
        content TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        sort_order INTEGER NOT NULL DEFAULT 0,
        topic VARCHAR(255),
        excerpt TEXT,
        cover_image_url TEXT,
        type VARCHAR(20) NOT NULL DEFAULT 'article',
        section_id INTEGER,
        parent_id INTEGER,
        content_format VARCHAR(20) NOT NULL DEFAULT 'html',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS event_schedules (
        id UUID PRIMARY KEY,
        ten VARCHAR(500),
        chuyen_nganh VARCHAR(255),
        loai_su_kien VARCHAR(50),
        mau_dang_ky VARCHAR(30),
        bat_dau_luc TIMESTAMP,
        ket_thuc_luc TIMESTAMP,
        ghi_chu TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      -- Ensure VN column names exist for event_schedules
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS ten VARCHAR(500);
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS chuyen_nganh VARCHAR(255);
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS loai_su_kien VARCHAR(50);
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS mau_dang_ky VARCHAR(30);
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS bat_dau_luc TIMESTAMP;
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS ket_thuc_luc TIMESTAMP;
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS ghi_chu TEXT;
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      -- 5. Chuyen Sau (Exam System) - Vietnamese Names
      CREATE TABLE IF NOT EXISTS chuyen_sau_monhoc (
        id SERIAL PRIMARY KEY,
        loai_ky_thi VARCHAR(50),
        ma_khoi VARCHAR(50),
        ma_mon VARCHAR(100),
        ten_mon VARCHAR(255),
        khoa_mon VARCHAR(100) UNIQUE,
        thoi_gian_thi_phut INTEGER,
        gio_bat_dau_thi TIMESTAMP,
        gio_ket_thuc_thi TIMESTAMP,
        che_do_chon_de VARCHAR(50) DEFAULT 'mac_dinh',
        dang_hoat_dong BOOLEAN DEFAULT true,
        exam_duration_minutes INTEGER,
        set_selection_mode VARCHAR(50),
        default_set_id INTEGER,
        metadata JSONB,
        display_order INTEGER,
        exam_type VARCHAR(50),
        tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chuyen_sau_bode (
        id SERIAL PRIMARY KEY,
        id_mon INTEGER REFERENCES chuyen_sau_monhoc(id) ON DELETE CASCADE,
        ma_de VARCHAR(100),
        ten_de VARCHAR(255),
        trang_thai VARCHAR(20) DEFAULT 'active',
        diem_dat DECIMAL(5,2),
        tong_diem DECIMAL(5,2),
        che_do_tinh_diem VARCHAR(50),
        trong_so_ngau_nhien INTEGER DEFAULT 1,
        tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chuyen_sau_cauhoi (
        id SERIAL PRIMARY KEY,
        loai_cau_hoi VARCHAR(50),
        noi_dung_cau_hoi TEXT,
        lua_chon_a TEXT,
        lua_chon_b TEXT,
        lua_chon_c TEXT,
        lua_chon_d TEXT,
        dap_an_dung TEXT,
        giai_thich TEXT,
        diem DECIMAL(5,2) DEFAULT 1.0,
        do_kho VARCHAR(20),
        tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chuyen_sau_bode_cauhoi (
        id SERIAL PRIMARY KEY,
        id_de INTEGER REFERENCES chuyen_sau_bode(id) ON DELETE CASCADE,
        id_cau INTEGER REFERENCES chuyen_sau_cauhoi(id) ON DELETE CASCADE,
        thu_tu_hien_thi INTEGER,
        tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id_de, id_cau)
      );

      CREATE TABLE IF NOT EXISTS chuyen_sau_results (
        id SERIAL PRIMARY KEY,
        khu_vuc VARCHAR(100),
        ho_ten VARCHAR(255),
        dia_chi_email VARCHAR(255),
        co_so_lam_viec VARCHAR(255),
        ma_giao_vien VARCHAR(50),
        hinh_thuc VARCHAR(50),
        khoi_giang_day VARCHAR(50),
        thang_dk INTEGER,
        nam_dk INTEGER,
        dot INTEGER,
        thoi_gian_kiem_tra VARCHAR(100),
        cau_dung INTEGER,
        diem DECIMAL(5,2),
        email_giai_trinh VARCHAR(255),
        xu_ly_diem VARCHAR(50),
        id_su_kien UUID REFERENCES event_schedules(id),
        id_mon INTEGER REFERENCES chuyen_sau_monhoc(id),
        id_de_thi INTEGER REFERENCES chuyen_sau_bode(id),
        da_giai_thich BOOLEAN DEFAULT false,
        so_lan_giai_thich INTEGER DEFAULT 0,
        tong_diem_bi_tru DECIMAL(5,2),
        dang_ky_luc TIMESTAMP,
        tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chuyen_sau_bainop (
        id SERIAL PRIMARY KEY,
        id_ket_qua INTEGER REFERENCES chuyen_sau_results(id) ON DELETE CASCADE,
        id_de_thi INTEGER REFERENCES chuyen_sau_bode(id),
        trang_thai_nop VARCHAR(50),
        nop_luc TIMESTAMP,
        bat_dau_luc TIMESTAMP,
        thoi_gian_su_dung_giay INTEGER,
        diem_tho DECIMAL(5,2),
        diem_chuan_hoa DECIMAL(5,2),
        diem_tho_toi_da DECIMAL(5,2),
        phan_tram DECIMAL(5,2),
        trang_thai VARCHAR(50),
        ghi_chu_cham TEXT,
        han_cham_luc TIMESTAMP,
        cham_luc TIMESTAMP,
        assignment_id BIGINT,
        teacher_code VARCHAR(50),
        started_at TIMESTAMP,
        submitted_at TIMESTAMP,
        time_spent_seconds INTEGER,
        raw_score DECIMAL(5,2),
        percentage DECIMAL(5,2),
        is_passed BOOLEAN,
        status VARCHAR(50),
        tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chuyen_sau_bainop_traloi (
        id SERIAL PRIMARY KEY,
        id_bai_nop INTEGER REFERENCES chuyen_sau_bainop(id) ON DELETE CASCADE,
        id_cau INTEGER REFERENCES chuyen_sau_cauhoi(id),
        dap_an_chon TEXT,
        noi_dung_tra_loi TEXT,
        dung BOOLEAN,
        diem_duoc_trao DECIMAL(5,2),
        diem_dat_duoc DECIMAL(5,2),
        tra_loi_luc TIMESTAMP,
        submission_id BIGINT,
        question_id BIGINT,
        answer_text TEXT,
        is_correct BOOLEAN,
        points_earned DECIMAL(5,2),
        answered_at TIMESTAMP,
        tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chuyen_sau_chonde_thang (
        id SERIAL PRIMARY KEY,
        id_mon INTEGER REFERENCES chuyen_sau_monhoc(id) ON DELETE CASCADE,
        nam INTEGER,
        thang INTEGER,
        id_de INTEGER REFERENCES chuyen_sau_bode(id),
        che_do_chon VARCHAR(50),
        tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cap_nhat_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_chonde_thang UNIQUE (id_mon, nam, thang)
      );

      CREATE TABLE IF NOT EXISTS chuyen_sau_giaitrinh (
        id SERIAL PRIMARY KEY,
        id_ket_qua INTEGER REFERENCES chuyen_sau_results(id) ON DELETE CASCADE,
        loai_giai_thich VARCHAR(50),
        noi_dung_giai_thich TEXT,
        html_giai_thich TEXT,
        tru_diem DECIMAL(5,2),
        xu_ly_giai_trinh VARCHAR(50),
        tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 6. English tables for API compatibility
      CREATE TABLE IF NOT EXISTS exam_subject_catalog (
        id SERIAL PRIMARY KEY,
        exam_type VARCHAR(50),
        block_code VARCHAR(50),
        subject_code VARCHAR(100),
        subject_name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS exam_sets (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER REFERENCES exam_subject_catalog(id),
        set_code VARCHAR(100),
        set_name VARCHAR(255),
        duration_minutes INTEGER,
        total_points DECIMAL(5,2),
        passing_score DECIMAL(5,2),
        status VARCHAR(20) DEFAULT 'active',
        valid_from TIMESTAMP,
        valid_to TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS exam_set_questions (
        id SERIAL PRIMARY KEY,
        set_id INTEGER REFERENCES exam_sets(id) ON DELETE CASCADE,
        question_text TEXT,
        question_type VARCHAR(50),
        options JSONB,
        correct_answer TEXT,
        explanation TEXT,
        points DECIMAL(5,2) DEFAULT 1.0,
        order_number INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS exam_registrations (
        id SERIAL PRIMARY KEY,
        teacher_code VARCHAR(50),
        exam_type VARCHAR(50),
        registration_type VARCHAR(50),
        block_code VARCHAR(50),
        subject_code VARCHAR(100),
        center_code VARCHAR(255),
        scheduled_at TIMESTAMP,
        source_form VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS teacher_exam_assignments (
        id SERIAL PRIMARY KEY,
        registration_id INTEGER REFERENCES exam_registrations(id) ON DELETE CASCADE,
        teacher_code VARCHAR(50),
        exam_type VARCHAR(50),
        registration_type VARCHAR(50),
        block_code VARCHAR(50),
        subject_code VARCHAR(100),
        selected_set_id INTEGER REFERENCES exam_sets(id),
        open_at TIMESTAMP,
        close_at TIMESTAMP,
        assignment_status VARCHAR(50) DEFAULT 'assigned',
        score DECIMAL(5,2),
        score_status VARCHAR(20) DEFAULT 'null',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(registration_id)
      );

      CREATE TABLE IF NOT EXISTS teacher_exam_submissions (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER REFERENCES teacher_exam_assignments(id) ON DELETE CASCADE,
        teacher_code VARCHAR(50),
        started_at TIMESTAMP,
        submitted_at TIMESTAMP,
        time_spent_seconds INTEGER DEFAULT 0,
        raw_score DECIMAL(5,2),
        percentage DECIMAL(5,2),
        is_passed BOOLEAN,
        status VARCHAR(20) DEFAULT 'in_progress',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(assignment_id)
      );

      CREATE TABLE IF NOT EXISTS teacher_exam_answers (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER REFERENCES teacher_exam_submissions(id) ON DELETE CASCADE,
        question_id INTEGER REFERENCES exam_set_questions(id),
        answer_text TEXT,
        is_correct BOOLEAN,
        points_earned DECIMAL(5,2) DEFAULT 0,
        answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(submission_id, question_id)
      );

      CREATE TABLE IF NOT EXISTS exam_explanations (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER REFERENCES teacher_exam_assignments(id) ON DELETE CASCADE,
        teacher_code VARCHAR(50),
        teacher_name VARCHAR(255),
        teacher_email VARCHAR(255),
        center_code VARCHAR(255),
        subject_code VARCHAR(100),
        test_date DATE,
        reason TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        admin_note TEXT,
        admin_email VARCHAR(255),
        admin_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(assignment_id)
      );

      -- 7. Salary Deals & HR Tables
      CREATE TABLE IF NOT EXISTS salary_deals (
        id SERIAL PRIMARY KEY,
        deal_type VARCHAR(20) NOT NULL,
        submitter_email VARCHAR(255) NOT NULL,
        submitter_name VARCHAR(255) NOT NULL,
        teacher_name VARCHAR(255) NOT NULL,
        teacher_codename VARCHAR(100),
        teacher_email VARCHAR(255),
        class_code VARCHAR(100),
        bonus_amount INTEGER,
        bonus_reason TEXT,
        deal_salary_amount INTEGER,
        teacher_experience TEXT,
        teacher_certificates TEXT,
        current_rate VARCHAR(10),
        new_rate VARCHAR(10),
        status VARCHAR(30) DEFAULT 'pending',
        tegl_note TEXT,
        tegl_email VARCHAR(255),
        tegl_name VARCHAR(255),
        tegl_decided_at TIMESTAMP,
        admin_note TEXT,
        admin_email VARCHAR(255),
        admin_name VARCHAR(255),
        admin_decided_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_salary_deals_type ON salary_deals(deal_type);
      CREATE INDEX IF NOT EXISTS idx_salary_deals_status ON salary_deals(status);
      CREATE INDEX IF NOT EXISTS idx_salary_deals_submitter ON salary_deals(submitter_email);
      CREATE INDEX IF NOT EXISTS idx_salary_deals_created ON salary_deals(created_at DESC);

      -- Grant super_admin permission for admin deal-luong page
      INSERT INTO app_permissions (user_id, route_path, can_access)
      SELECT u.id, '/admin/deal-luong', true
      FROM app_users u
      WHERE u.role = 'super_admin'
      ON CONFLICT (user_id, route_path) DO NOTHING;

      -- Grant role-based permissions
      INSERT INTO role_permissions (role_code, route_path)
      VALUES ('AD', '/admin/deal-luong')
      ON CONFLICT DO NOTHING;


      -- Only AD and super_admin can access /admin/deal-luong
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V33: Make video_id nullable in training_video_assignments
  // ═══════════════════════════════════════════════════════
  {
    name: 'V33_make_video_id_nullable',
    version: 33,
    sql: `
      ALTER TABLE training_video_assignments ALTER COLUMN video_id DROP NOT NULL;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V34: Fix view counts for training videos
  // ═══════════════════════════════════════════════════════
  {
    name: 'V34_fix_view_counts',
    version: 34,
    sql: `
      UPDATE training_teacher_video_scores
      SET view_count = 1
      WHERE view_count IS NULL OR view_count = 0;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V35: HR Candidate GEN Assignment Management
  // ═══════════════════════════════════════════════════════
  {
    name: 'V35_hr_candidate_gen_assignment',
    version: 35,
    sql: `
      CREATE TABLE IF NOT EXISTS hr_candidate_gen_assignments (
        id SERIAL PRIMARY KEY,
        candidate_key VARCHAR(64) NOT NULL UNIQUE,
        candidate_fingerprint TEXT NOT NULL,
        candidate_name VARCHAR(255),
        candidate_email VARCHAR(255),
        candidate_phone VARCHAR(50),
        assigned_gen VARCHAR(100) NOT NULL,
        assigned_by_email VARCHAR(255) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 8. Triggers for updated_at
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_roles_updated_at') THEN
          CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_app_users_updated_at') THEN
          CREATE TRIGGER trg_app_users_updated_at BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_centers_updated_at') THEN
          CREATE TRIGGER trg_centers_updated_at BEFORE UPDATE ON centers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_teaching_leaders_updated_at') THEN
          CREATE TRIGGER trg_teaching_leaders_updated_at BEFORE UPDATE ON teaching_leaders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_teachers_updated_at') THEN
          CREATE TRIGGER trg_teachers_updated_at BEFORE UPDATE ON teachers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_communications_updated_at') THEN
          CREATE TRIGGER trg_communications_updated_at BEFORE UPDATE ON communications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_training_videos_updated_at') THEN
          CREATE TRIGGER trg_training_videos_updated_at BEFORE UPDATE ON training_videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_training_teacher_stats_updated_at') THEN
          CREATE TRIGGER trg_training_teacher_stats_updated_at BEFORE UPDATE ON training_teacher_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END $$;

      -- 9. Seed super admin
      INSERT INTO app_users (email, username, password_hash, display_name, role, created_by)
      VALUES (
        'hoteaching@mindx.com.vn',
        'hoteaching',
        '$2b$10$wveSDVP2lAmmUVyNuG9foO5olJu.Scj/6Y5c29haEd2aw1SDTYyoG',
        'HO Teaching',
        'super_admin',
        'system'
      )
      ON CONFLICT (email) DO NOTHING;

      -- Seed default roles
      INSERT INTO roles (role_code, role_name, department) VALUES
        ('AD', 'Admin', 'HO'),
        ('TM', 'Teaching Manager', 'HO'),
        ('TC', 'Teaching Coordinator', 'Center'),
        ('TE', 'Teaching Executive', 'Center'),
        ('LEAD', 'Leader', 'Center')
      ON CONFLICT (role_code) DO NOTHING;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V42: K12 docs content management (draft + published)
  // ═══════════════════════════════════════════════════════
  {
    name: 'V42_k12_docs_management',
    version: 42,
    sql: `
      CREATE TABLE IF NOT EXISTS k12_documents (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(400) NOT NULL UNIQUE,
        title VARCHAR(500) NOT NULL,
        relative_path VARCHAR(600) NOT NULL UNIQUE,
        content TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'published')),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_by_email VARCHAR(255),
        updated_by_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_k12_documents_status ON k12_documents(status);
      CREATE INDEX IF NOT EXISTS idx_k12_documents_sort_order ON k12_documents(sort_order);

      DROP TRIGGER IF EXISTS trg_k12_documents_updated_at ON k12_documents;
      CREATE TRIGGER trg_k12_documents_updated_at
      BEFORE UPDATE ON k12_documents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

      INSERT INTO app_permissions (user_id, route_path, can_access)
      SELECT u.id, '/admin/page2/manage', true
      FROM app_users u
      WHERE u.role = 'super_admin'
      ON CONFLICT (user_id, route_path) DO NOTHING;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V43: K12 docs article metadata (topic, excerpt, cover)
  // ═══════════════════════════════════════════════════════
  {
    name: 'V43_k12_docs_article_fields',
    version: 43,
    sql: `
      ALTER TABLE k12_documents
      ADD COLUMN IF NOT EXISTS topic VARCHAR(255),
      ADD COLUMN IF NOT EXISTS excerpt TEXT,
      ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

      CREATE INDEX IF NOT EXISTS idx_k12_documents_topic ON k12_documents(topic);
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V44: K12 CMS hierarchy (section + parent tree)
  // ═══════════════════════════════════════════════════════
  {
    name: 'V44_k12_docs_cms_hierarchy',
    version: 44,
    sql: `
      ALTER TABLE k12_documents
      ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'article',
      ADD COLUMN IF NOT EXISTS section_id INTEGER,
      ADD COLUMN IF NOT EXISTS parent_id INTEGER,
      ADD COLUMN IF NOT EXISTS content_format VARCHAR(20) NOT NULL DEFAULT 'html';

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'k12_documents_type_check'
        ) THEN
          ALTER TABLE k12_documents
          ADD CONSTRAINT k12_documents_type_check CHECK (type IN ('section', 'article'));
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'k12_documents_content_format_check'
        ) THEN
          ALTER TABLE k12_documents
          ADD CONSTRAINT k12_documents_content_format_check CHECK (content_format IN ('html', 'json'));
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_k12_documents_type ON k12_documents(type);
      CREATE INDEX IF NOT EXISTS idx_k12_documents_section_id ON k12_documents(section_id);
      CREATE INDEX IF NOT EXISTS idx_k12_documents_parent_id ON k12_documents(parent_id);

      DO $$
      DECLARE
        root_section_id INTEGER;
      BEGIN
        INSERT INTO k12_documents (
          slug, title, relative_path, content, topic, excerpt, cover_image_url, type, status, sort_order, created_by_email, updated_by_email
        )
        SELECT
          'quy-trinh-quy-dinh-danh-cho-giao-vien',
          'Quy Trình, Quy Định K12 Teaching',
          'quy-trinh-quy-dinh-danh-cho-giao-vien/index.md',
          '',
          'Quy Trình, Quy Định K12 Teaching',
          'Tất cả quy trình, quy định và tài liệu K12 Teaching.',
          NULL,
          'section',
          'published',
          0,
          'system',
          'system'
        WHERE NOT EXISTS (
          SELECT 1 FROM k12_documents WHERE slug = 'quy-trinh-quy-dinh-danh-cho-giao-vien' AND type = 'section'
        );

        SELECT id INTO root_section_id
        FROM k12_documents
        WHERE slug = 'quy-trinh-quy-dinh-danh-cho-giao-vien' AND type = 'section'
        LIMIT 1;

        IF root_section_id IS NOT NULL THEN
          UPDATE k12_documents
          SET section_id = root_section_id
          WHERE type = 'article' AND section_id IS NULL;
        END IF;
      END $$;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V45: K12 publish snapshots (lịch sử phát hành gần nhất)
  // ═══════════════════════════════════════════════════════
  {
    name: 'V45_k12_publish_snapshots',
    version: 45,
    sql: `
      CREATE TABLE IF NOT EXISTS k12_publish_snapshots (
        id SERIAL PRIMARY KEY,
        snapshot_data JSONB NOT NULL,
        document_count INTEGER NOT NULL DEFAULT 0,
        created_by_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_hr_gen_assignment_history_candidate
        ON hr_candidate_gen_assignment_history(candidate_key);
      CREATE INDEX IF NOT EXISTS idx_hr_gen_assignment_history_created
        ON hr_candidate_gen_assignment_history(created_at DESC);

      -- Super admin gets access to the HR candidate management screen.
      INSERT INTO app_permissions (user_id, route_path, can_access)
      SELECT u.id, '/admin/hr-candidates', true
      FROM app_users u
      WHERE u.role = 'super_admin'
      ON CONFLICT (user_id, route_path) DO NOTHING;

      -- Grant role-based access for Admin and HR if those roles exist in DB.
      DO $$
      BEGIN
        IF to_regclass('public.roles') IS NOT NULL AND to_regclass('public.role_permissions') IS NOT NULL THEN
          INSERT INTO role_permissions (role_code, route_path)
          SELECT r.role_code, '/admin/hr-candidates'
          FROM roles r
          WHERE r.role_code IN ('AD', 'HR')
          ON CONFLICT DO NOTHING;
        END IF;
      END $$;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V36: HR GEN catalog for planner page
  // ═══════════════════════════════════════════════════════
  {
    name: 'V36_hr_gen_catalog',
    version: 36,
    sql: `
        CREATE TABLE IF NOT EXISTS hr_gen_catalog (
          id SERIAL PRIMARY KEY,
          gen_name VARCHAR(100) NOT NULL UNIQUE,
          source VARCHAR(30) NOT NULL DEFAULT 'manual',
          created_by_email VARCHAR(255),
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_hr_gen_catalog_active
          ON hr_gen_catalog(is_active, gen_name);

        DROP TRIGGER IF EXISTS trg_hr_gen_catalog_updated_at ON hr_gen_catalog;
        CREATE TRIGGER trg_hr_gen_catalog_updated_at
        BEFORE UPDATE ON hr_gen_catalog
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

        INSERT INTO app_permissions (user_id, route_path, can_access)
        SELECT u.id, '/admin/hr-candidates/gen-planner', true
        FROM app_users u
        WHERE u.role = 'super_admin'
        ON CONFLICT (user_id, route_path) DO NOTHING;

        DO $$
        BEGIN
          IF to_regclass('public.roles') IS NOT NULL AND to_regclass('public.role_permissions') IS NOT NULL THEN
            INSERT INTO role_permissions (role_code, route_path)
            SELECT r.role_code, '/admin/hr-candidates/gen-planner'
            FROM roles r
            WHERE r.role_code IN ('AD', 'HR')
            ON CONFLICT DO NOTHING;
          END IF;
        END $$;
      `,
  },

  // ═══════════════════════════════════════════════════════
  // V37: Group mapping for split training videos
  // ═══════════════════════════════════════════════════════
  {
    name: 'V37_training_videos_groups',
    version: 37,
    sql: `
      CREATE TABLE IF NOT EXISTS training_videos_groups (
        id SERIAL PRIMARY KEY,
        id_group_video VARCHAR(100) NOT NULL,
        id_video INTEGER NOT NULL REFERENCES training_videos(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id_group_video, id_video)
      );

      CREATE INDEX IF NOT EXISTS idx_training_videos_groups_group
        ON training_videos_groups(id_group_video);

      CREATE INDEX IF NOT EXISTS idx_training_videos_groups_video
        ON training_videos_groups(id_video);
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V38: Metadata columns for grouping split videos in training_videos
  // ═══════════════════════════════════════════════════════
  {
    name: 'V38_training_videos_split_columns',
    version: 38,
    sql: `
      ALTER TABLE training_videos
      ADD COLUMN IF NOT EXISTS video_group_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS chunk_index INTEGER,
      ADD COLUMN IF NOT EXISTS chunk_total INTEGER,
      ADD COLUMN IF NOT EXISTS original_filename VARCHAR(500),
      ADD COLUMN IF NOT EXISTS original_size_bytes BIGINT;

      CREATE INDEX IF NOT EXISTS idx_training_videos_group_id
        ON training_videos(video_group_id);

      CREATE INDEX IF NOT EXISTS idx_training_videos_group_chunk
        ON training_videos(video_group_id, chunk_index);
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V39: Unified stream URL for split training videos
  // ═══════════════════════════════════════════════════════
  {
    name: 'V39_training_videos_unified_stream_url',
    version: 39,
    sql: `
      ALTER TABLE training_videos
      ADD COLUMN IF NOT EXISTS unified_stream_url TEXT;

      CREATE INDEX IF NOT EXISTS idx_training_videos_unified_stream
        ON training_videos(video_group_id)
        WHERE unified_stream_url IS NOT NULL;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V40: Add exact duration in seconds for accurate playback tracking
  // ═══════════════════════════════════════════════════════
  {
    name: 'V40_training_videos_duration_seconds',
    version: 40,
    sql: `
      ALTER TABLE training_videos
      ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V41: truyenthong_comments.hidden (admin ẩn bình luận)
  // Trước đây chỉ có trong scripts/add_hidden_column — thiếu migration → PATCH lỗi / UI optimistic lệch DB
  // ═══════════════════════════════════════════════════════
  {
    name: 'V41_truyenthong_comments_hidden',
    version: 41,
    sql: `
      ALTER TABLE truyenthong_comments
      ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE;

      CREATE INDEX IF NOT EXISTS idx_comments_hidden ON truyenthong_comments(hidden);
    `,
  },
  {
    name: 'V42_drop_assignment_unused_columns',
    version: 42,
    sql: `
      ALTER TABLE training_video_assignments
        DROP COLUMN IF EXISTS total_points,
        DROP COLUMN IF EXISTS passing_score,
        DROP COLUMN IF EXISTS time_limit_minutes,
        DROP COLUMN IF EXISTS max_attempts,
        DROP COLUMN IF EXISTS is_required,
        DROP COLUMN IF EXISTS due_date,
        DROP COLUMN IF EXISTS status;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V46: Add thumbnail_position to communications
  // ═══════════════════════════════════════════════════════
  {
    name: 'V46_communications_thumbnail_position',
    version: 46,
    sql: `
      ALTER TABLE communications
        ADD COLUMN IF NOT EXISTS thumbnail_position VARCHAR(20) DEFAULT '50% 50%';
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V47: Server-side time tracking — last_heartbeat_at
  // Server tự tính thời gian xem thực tế, không tin client
  // ═══════════════════════════════════════════════════════
  {
    name: 'V47_training_progress_heartbeat',
    version: 47,
    sql: `
      ALTER TABLE training_teacher_video_scores
        ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS server_time_seconds INTEGER DEFAULT 0;

      UPDATE training_teacher_video_scores
        SET server_time_seconds = COALESCE(time_spent_seconds, 0)
        WHERE server_time_seconds = 0 AND time_spent_seconds > 0;
    `,
  },
  {
    name: 'V46_chuyen_sau_unique_indexes',
    version: 46,
    sql: `
      -- Đảm bảo UNIQUE index trên chuyen_sau_bode.ma_de để ON CONFLICT (ma_de) hoạt động.
      -- Trước khi tạo index, xoá duplicate (giữ bản ghi mới nhất theo id).
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE tablename = 'chuyen_sau_bode' AND indexname = 'idx_bode_ma_de_uq'
        ) THEN
          DELETE FROM chuyen_sau_bode
          WHERE id NOT IN (
            SELECT MAX(id) FROM chuyen_sau_bode WHERE ma_de IS NOT NULL GROUP BY ma_de
          )
          AND ma_de IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM chuyen_sau_bode b2
            WHERE b2.ma_de = chuyen_sau_bode.ma_de AND b2.id <> chuyen_sau_bode.id
          );
          CREATE UNIQUE INDEX idx_bode_ma_de_uq ON chuyen_sau_bode (ma_de)
          WHERE ma_de IS NOT NULL;
        END IF;
      END $$;

      -- Đảm bảo UNIQUE index trên chuyen_sau_monhoc.ma_mon để ON CONFLICT (ma_mon) hoạt động.
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE tablename = 'chuyen_sau_monhoc' AND indexname = 'idx_monhoc_ma_mon_uq'
        ) THEN
          DELETE FROM chuyen_sau_monhoc
          WHERE id NOT IN (
            SELECT MAX(id) FROM chuyen_sau_monhoc WHERE ma_mon IS NOT NULL GROUP BY ma_mon
          )
          AND ma_mon IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM chuyen_sau_monhoc m2
            WHERE m2.ma_mon = chuyen_sau_monhoc.ma_mon AND m2.id <> chuyen_sau_monhoc.id
          );
          CREATE UNIQUE INDEX idx_monhoc_ma_mon_uq ON chuyen_sau_monhoc (ma_mon)
          WHERE ma_mon IS NOT NULL;
        END IF;
      END $$;
    `,
  },
  {
    name: 'V47_process_block_split',
    version: 47,
    sql: `
      -- Chuẩn hóa 3 môn Quy trình & Kỹ năng trải nghiệm thành 3 block riêng để map đề theo id_mon rõ ràng.
      UPDATE chuyen_sau_monhoc
      SET ma_khoi = 'PROCESS-ART',
          loai_ky_thi = 'experience'
      WHERE ma_khoi = 'PROCESS'
        AND (
          lower(COALESCE(ma_mon, '')) LIKE '%[art]%'
          OR lower(COALESCE(ten_mon, '')) LIKE '%[art]%'
          OR lower(COALESCE(ma_mon, '')) LIKE '%my thuat%'
          OR lower(COALESCE(ten_mon, '')) LIKE '%my thuat%'
        );

      UPDATE chuyen_sau_monhoc
      SET ma_khoi = 'PROCESS-COD',
          loai_ky_thi = 'experience'
      WHERE ma_khoi = 'PROCESS'
        AND (
          lower(COALESCE(ma_mon, '')) LIKE '%[coding]%'
          OR lower(COALESCE(ten_mon, '')) LIKE '%[coding]%'
          OR lower(COALESCE(ma_mon, '')) LIKE '%code%'
          OR lower(COALESCE(ten_mon, '')) LIKE '%code%'
        );

      UPDATE chuyen_sau_monhoc
      SET ma_khoi = 'PROCESS-ROB',
          loai_ky_thi = 'experience'
      WHERE ma_khoi = 'PROCESS'
        AND (
          lower(COALESCE(ma_mon, '')) LIKE '%[robotics]%'
          OR lower(COALESCE(ten_mon, '')) LIKE '%[robotics]%'
          OR lower(COALESCE(ma_mon, '')) LIKE '%robot%'
          OR lower(COALESCE(ten_mon, '')) LIKE '%robot%'
        );
    `,
  },
  {
    name: 'V48_feedback_tickets',
    version: 48,
    sql: `
      CREATE TABLE IF NOT EXISTS feedback_tickets (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        user_name VARCHAR(255),
        user_code VARCHAR(100),
        content TEXT NOT NULL,
        suggestion TEXT,
        image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(20) NOT NULL DEFAULT 'new'
          CHECK (status IN ('new', 'in_progress', 'done')),
        admin_note TEXT,
        resolved_by_email VARCHAR(255),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_feedback_tickets_status ON feedback_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_feedback_tickets_user_email ON feedback_tickets(user_email);
      CREATE INDEX IF NOT EXISTS idx_feedback_tickets_created_at ON feedback_tickets(created_at DESC);

      DROP TRIGGER IF EXISTS trg_feedback_tickets_updated_at ON feedback_tickets;
      CREATE TRIGGER trg_feedback_tickets_updated_at
      BEFORE UPDATE ON feedback_tickets
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `,
  },
  {
    name: 'V49_feedback_screen_path',
    version: 49,
    sql: `
      ALTER TABLE feedback_tickets
      ADD COLUMN IF NOT EXISTS screen_path VARCHAR(500);

      CREATE INDEX IF NOT EXISTS idx_feedback_tickets_screen_path ON feedback_tickets(screen_path);
    `,
  },
  {
    name: 'V50_feedback_admin_reply',
    version: 50,
    sql: `
      ALTER TABLE feedback_tickets
      ADD COLUMN IF NOT EXISTS admin_reply TEXT,
      ADD COLUMN IF NOT EXISTS admin_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V51: Center-based access control for managers
  // Mapping manager email → centers được phân công
  // ═══════════════════════════════════════════════════════
  {
    name: 'V51_manager_centers',
    version: 51,
    sql: `
      CREATE TABLE IF NOT EXISTS manager_centers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
        assigned_by_email VARCHAR(255),
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, center_id)
      );

      CREATE INDEX IF NOT EXISTS idx_manager_centers_user_id ON manager_centers(user_id);
      CREATE INDEX IF NOT EXISTS idx_manager_centers_center_id ON manager_centers(center_id);

      DROP TRIGGER IF EXISTS trg_manager_centers_updated_at ON manager_centers;
      CREATE TRIGGER trg_manager_centers_updated_at
      BEFORE UPDATE ON manager_centers
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V48: Add user_name + reaction to communication_likes
  // ═══════════════════════════════════════════════════════
  {
    name: 'V48_communication_likes_user_name_reaction',
    version: 48,
    sql: `
      ALTER TABLE communication_likes
        ADD COLUMN IF NOT EXISTS reaction VARCHAR(20) DEFAULT 'like',
        ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V49: Add birthday columns to teachers
  // ═══════════════════════════════════════════════════════
  {
    name: 'V49_teachers_birthday',
    version: 49,
    sql: `
      ALTER TABLE teachers
        ADD COLUMN IF NOT EXISTS birthday VARCHAR(10),
        ADD COLUMN IF NOT EXISTS birth_day INTEGER,
        ADD COLUMN IF NOT EXISTS birth_month INTEGER;
    `,
  },

  {
    name: 'V52_chuyen_sau_results_lich_thi_dk',
    version: 52,
    sql: `
      ALTER TABLE chuyen_sau_results
        ADD COLUMN IF NOT EXISTS lich_thi_dk TIMESTAMP;
    `,
  },
  {
    name: 'V53_teaching_leaders_areas',
    version: 53,
    sql: `
      ALTER TABLE teaching_leaders
        ADD COLUMN IF NOT EXISTS areas JSONB NOT NULL DEFAULT '[]'::jsonb;

      UPDATE teaching_leaders
      SET areas = jsonb_build_array(trim(area))
      WHERE trim(area) IS NOT NULL
        AND trim(area) <> ''
        AND jsonb_array_length(COALESCE(areas, '[]'::jsonb)) = 0;
    `,
  },
  {
    name: 'V54_teaching_leaders_timestamps',
    version: 54,
    sql: `
      -- Bảng cũ có thể thiếu updated_at nhưng vẫn có trigger -> lỗi "record new has no field updated_at"
      ALTER TABLE teaching_leaders
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE teaching_leaders
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      DROP TRIGGER IF EXISTS trg_teaching_leaders_updated_at ON teaching_leaders;
      CREATE TRIGGER trg_teaching_leaders_updated_at
        BEFORE UPDATE ON teaching_leaders
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `,
  },
  {
    name: 'V63_dangky_lich_lam',
    version: 63,
    sql: `
      CREATE TABLE IF NOT EXISTS dangky_lich_lam (
        id SERIAL PRIMARY KEY,
        ma_gv VARCHAR(100) NOT NULL,
        ngay DATE NOT NULL,
        gio_bat_dau TIME NOT NULL,
        gio_ket_thuc TIME NOT NULL,
        co_so_uu_tien TEXT[] DEFAULT '{}',
        linh_hoat BOOLEAN DEFAULT FALSE,
        lap_lai_tu_ngay DATE,
        lap_lai_den_ngay DATE,
        kieu_lap VARCHAR(10) DEFAULT 'tuan',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_dangky_lich_lam_ma_gv ON dangky_lich_lam(ma_gv);
      CREATE INDEX IF NOT EXISTS idx_dangky_lich_lam_ngay ON dangky_lich_lam(ngay);
      -- Không unique (ma_gv, ngay) vì 1 ngày có thể có nhiều slot giờ
    `,
  },
  {
    name: 'V64_dangky_lich_lam_drop_unique',
    version: 64,
    sql: `
      DROP INDEX IF EXISTS idx_dangky_lich_lam_ma_gv_ngay;
    `,
  },
  {
    name: 'V65_teaching_leaders_email',
    version: 65,
    sql: `
      ALTER TABLE teaching_leaders
        ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    `,
  },
  {
    name: 'V66_hr_onboarding_training',
    version: 66,
    sql: `
      -- Bảng ứng viên đào tạo đầu vào
      CREATE TABLE IF NOT EXISTS hr_candidates (
        id                SERIAL PRIMARY KEY,
        full_name         VARCHAR(255) NOT NULL,
        email             VARCHAR(255) NOT NULL,
        phone             VARCHAR(50),
        region_code       VARCHAR(10),
        desired_campus    VARCHAR(255),
        work_block        VARCHAR(100),
        subject_code      VARCHAR(100),
        gen_id            INTEGER REFERENCES hr_gen_catalog(id) ON DELETE SET NULL,
        status            VARCHAR(20) NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new', 'in_training', 'passed', 'failed', 'dropped')),
        source            VARCHAR(20) NOT NULL DEFAULT 'manual'
                          CHECK (source IN ('manual', 'csv')),
        created_by_email  VARCHAR(255) NOT NULL,
        updated_by_email  VARCHAR(255),
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_hr_candidates_email_gen UNIQUE (email, gen_id)
      );
      CREATE INDEX IF NOT EXISTS idx_hr_candidates_gen_id ON hr_candidates(gen_id);
      CREATE INDEX IF NOT EXISTS idx_hr_candidates_status ON hr_candidates(status);
      CREATE INDEX IF NOT EXISTS idx_hr_candidates_email ON hr_candidates(email);

      -- Bảng buổi training (tối đa 4 buổi/GEN)
      CREATE TABLE IF NOT EXISTS hr_training_sessions (
        id                SERIAL PRIMARY KEY,
        gen_id            INTEGER NOT NULL REFERENCES hr_gen_catalog(id) ON DELETE CASCADE,
        session_number    INTEGER NOT NULL CHECK (session_number BETWEEN 1 AND 4),
        title             VARCHAR(500) NOT NULL,
        session_date      DATE,
        video_id          INTEGER REFERENCES training_videos(id) ON DELETE SET NULL,
        created_by_email  VARCHAR(255) NOT NULL,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_hr_training_sessions_gen_session UNIQUE (gen_id, session_number)
      );
      CREATE INDEX IF NOT EXISTS idx_hr_training_sessions_gen_id ON hr_training_sessions(gen_id);

      -- Bảng điểm danh + điểm kiểm tra từng buổi
      CREATE TABLE IF NOT EXISTS hr_candidate_training_records (
        id                SERIAL PRIMARY KEY,
        candidate_id      INTEGER NOT NULL REFERENCES hr_candidates(id) ON DELETE CASCADE,
        session_id        INTEGER NOT NULL REFERENCES hr_training_sessions(id) ON DELETE CASCADE,
        attendance        BOOLEAN NOT NULL DEFAULT FALSE,
        score             DECIMAL(4,2) CHECK (score >= 0 AND score <= 10),
        recorded_by_email VARCHAR(255) NOT NULL,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_hr_training_record UNIQUE (candidate_id, session_id)
      );
      CREATE INDEX IF NOT EXISTS idx_hr_training_records_candidate ON hr_candidate_training_records(candidate_id);
      CREATE INDEX IF NOT EXISTS idx_hr_training_records_session ON hr_candidate_training_records(session_id);

      -- Thêm cột source vào teachers để ghi nhận nguồn gốc
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS source VARCHAR(50);

      -- Triggers updated_at
      DROP TRIGGER IF EXISTS trg_hr_candidates_updated_at ON hr_candidates;
      CREATE TRIGGER trg_hr_candidates_updated_at
        BEFORE UPDATE ON hr_candidates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS trg_hr_training_sessions_updated_at ON hr_training_sessions;
      CREATE TRIGGER trg_hr_training_sessions_updated_at
        BEFORE UPDATE ON hr_training_sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS trg_hr_candidate_training_records_updated_at ON hr_candidate_training_records;
      CREATE TRIGGER trg_hr_candidate_training_records_updated_at
        BEFORE UPDATE ON hr_candidate_training_records
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      -- Permissions cho route /admin/hr-onboarding
      INSERT INTO app_permissions (user_id, route_path, can_access)
      SELECT u.id, '/admin/hr-onboarding', true
      FROM app_users u
      WHERE u.role = 'super_admin'
      ON CONFLICT (user_id, route_path) DO NOTHING;
    `,
  },
  {
    name: 'V67_app_screens_catalog',
    version: 67,
    sql: `
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

      DROP TRIGGER IF EXISTS trg_app_screens_updated_at ON app_screens;
      CREATE TRIGGER trg_app_screens_updated_at
        BEFORE UPDATE ON app_screens
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `,
  },
  {
    name: 'V68_centers_contact_email',
    version: 68,
    sql: `
      ALTER TABLE centers
        ADD COLUMN IF NOT EXISTS email VARCHAR(255);
      ALTER TABLE centers
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      WITH mappings(short_code, display_name, email) AS (
        VALUES
          ('toky', 'Tô Ký', 'contact.toky@mindx.com.vn'),
          ('phanvantri', 'Phan Văn Trị', 'contact.phanvantri@mindx.com.vn'),
          ('quangtrung', 'Quang Trung', 'contact.quangtrung@mindx.com.vn'),
          ('truongchinh', 'Trường Chinh', 'contact.truongchinh@mindx.com.vn'),
          ('songhanh', 'Song Hành', 'contact.songhanh@mindx.com.vn'),
          ('phanxichlong', 'Phan Xích Long', 'contact.phanxichlong@mindx.com.vn'),
          ('nguyenxi', 'Nguyễn Xí', 'contact.nguyenxi@mindx.com.vn'),
          ('phamvandong', 'Phạm Văn Đồng', 'contact.phamvandong@mindx.com.vn'),
          ('levanviet', 'Lê Văn Việt', 'contact.levanviet@mindx.com.vn'),
          ('phamngulao', 'Phạm Ngũ Lão', 'contact.phamngulao@mindx.com.vn'),
          ('haithuonglanong', 'HTLO (Hải Thượng Lãn Ông)', 'contact.haithuonglanong@mindx.com.vn'),
          ('haithuonglanong', 'Hải Thượng Lãn Ông', 'contact.haithuonglanong@mindx.com.vn'),
          ('3thang2', '3T2 (3 Tháng 2)', 'contact.3thang2@mindx.com.vn'),
          ('3thang2', '3 Tháng 2', 'contact.3thang2@mindx.com.vn'),
          ('3thang2', 'Đường 3/2', 'contact.3thang2@mindx.com.vn'),
          ('phumyhung', 'Phú Mỹ Hưng', 'contact.phumyhung@mindx.com.vn'),
          ('himlam', 'Him Lam', 'contact.himlam@mindx.com.vn'),
          ('18hcm', '18+ HCM', 'contact.18hcm@mindx.com.vn'),
          ('tenlua', 'Tên Lửa', 'contact.tenlua@mindx.com.vn'),
          ('taythanh', 'Tây Thạnh', 'contact.taythanh@mindx.com.vn'),
          ('luybanbich', 'Lũy Bán Bích', 'contact.luybanbich@mindx.com.vn'),
          ('online', 'HCM Online', 'contact.online@mindx.com.vn'),
          ('online', 'MindX - Online', 'contact.online@mindx.com.vn'),
          ('multimedia', 'X Art', 'contact.multimedia@mindx.com.vn'),
          ('multimedia', 'MindX Digital Art', 'contact.multimedia@mindx.com.vn'),
          ('hoangdaothuy', 'Hoàng Đạo Thúy', 'contact.hoangdaothuy@mindx.com.vn'),
          ('nguyenphongsac', 'Nguyễn Phong Sắc', 'contact.nguyenphongsac@mindx.com.vn'),
          ('nguyenchithanh', 'Nguyễn Chí Thanh', 'contact.nguyenchithanh@mindx.com.vn'),
          ('hamnghi', 'Hàm Nghi', 'contact.hamnghi@mindx.com.vn'),
          ('minhkhai', 'Minh Khai', 'contact.minhkhai@mindx.com.vn'),
          ('nguyenhuutho', 'Nguyễn Hữu Thọ', 'contact.nguyenhuutho@mindx.com.vn'),
          ('longbien', 'Long Biên', 'contact.longbien@mindx.com.vn'),
          ('nguyenvancu', 'Nguyễn Văn Cừ', 'contact.nguyenvancu@mindx.com.vn'),
          ('vanphu', 'Văn Phú', 'contact.vanphu@mindx.com.vn'),
          ('tranphu', 'Trần Phú', 'contact.tranphu@mindx.com.vn'),
          ('thanhcong', 'Thành Công', 'contact.thanhcong@mindx.com.vn'),
          ('18hn', '18+ HN', 'contact.18hn@mindx.com.vn'),
          ('bienhoa', 'Biên Hòa', 'contact.bienhoa@mindx.com.vn'),
          ('bienhoa', 'Đồng Nai', 'contact.bienhoa@mindx.com.vn'),
          ('cantho', 'Cần Thơ', 'contact.cantho@mindx.com.vn'),
          ('vungtau', 'Vũng Tàu', 'contact.vungtau@mindx.com.vn'),
          ('dian', 'Dĩ An', 'contact.dian@mindx.com.vn'),
          ('thudaumot', 'Thủ Dầu Một', 'contact.thudaumot@mindx.com.vn'),
          ('halong', 'Hạ Long (Quảng Ninh)', 'contact.halong@mindx.com.vn'),
          ('halong', 'Quảng Ninh', 'contact.halong@mindx.com.vn'),
          ('haiphong', 'Hải Phòng', 'contact.haiphong@mindx.com.vn'),
          ('bacninh', 'Bắc Ninh', 'contact.bacninh@mindx.com.vn'),
          ('vinhphuc', 'Vĩnh Phúc', 'contact.vinhphuc@mindx.com.vn'),
          ('thainguyen', 'Thái Nguyên', 'contact.thainguyen@mindx.com.vn'),
          ('phutho', 'Phú Thọ', 'contact.phutho@mindx.com.vn'),
          ('danang', 'Đà Nẵng', 'contact.danang@mindx.com.vn'),
          ('nghean', 'Nghệ An', 'contact.nghean@mindx.com.vn'),
          ('thanhhoa', 'Thanh Hóa', 'contact.thanhhoa@mindx.com.vn')
      )
      UPDATE centers c
        SET email = m.email
      FROM mappings m
      WHERE LOWER(COALESCE(c.short_code, '')) = LOWER(m.short_code)
         OR LOWER(TRIM(COALESCE(c.display_name, ''))) = LOWER(TRIM(m.display_name))
         OR LOWER(TRIM(COALESCE(c.full_name, ''))) = LOWER(TRIM(m.display_name))
         OR LOWER(COALESCE(c.display_name, '')) LIKE '%' || LOWER(TRIM(m.display_name)) || '%'
         OR LOWER(COALESCE(c.full_name, '')) LIKE '%' || LOWER(TRIM(m.display_name)) || '%';
    `,
  },
  {
    name: 'V69_multiple_select_question_type',
    version: 69,
    sql: `
      -- Thêm loại câu hỏi multiple_select vào constraint
      ALTER TABLE training_assignment_questions
        DROP CONSTRAINT IF EXISTS training_assignment_questions_question_type_check;

      ALTER TABLE training_assignment_questions
        ADD CONSTRAINT training_assignment_questions_question_type_check
        CHECK (question_type IN ('multiple_choice', 'multiple_select', 'true_false', 'short_answer', 'essay'));
    `,
  },
  {
    name: 'V43_add_watched_status_to_training',
    version: 43,
    sql: `
      -- 1. Cập nhật ràng buộc CHECK để hỗ trợ trạng thái 'watched'
      ALTER TABLE training_teacher_video_scores 
      DROP CONSTRAINT IF EXISTS training_teacher_video_scores_completion_status_check;
      
      ALTER TABLE training_teacher_video_scores 
      ADD CONSTRAINT training_teacher_video_scores_completion_status_check 
      CHECK (completion_status IN ('not_started', 'in_progress', 'watched', 'completed'));

      -- 2. Chuyển các bản ghi đang là 'completed' nhưng chưa có điểm (score = 0) sang 'watched'
      -- Điều này giúp sửa dữ liệu cũ bị sai lệch
      UPDATE training_teacher_video_scores
      SET completion_status = 'watched'
      WHERE completion_status = 'completed' AND (score IS NULL OR score < 7);
    `,
  },
  {
    name: 'V70_leave_requests_center_snapshot',
    version: 70,
    sql: `
      DO $$
      BEGIN
        IF to_regclass('public.leave_requests') IS NOT NULL THEN
          ALTER TABLE leave_requests
            ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id);
          ALTER TABLE leave_requests
            ADD COLUMN IF NOT EXISTS campus_bu_email VARCHAR(255);
        END IF;
      END $$;
    `,
  },
  {
    name: 'V70_centers_address_map_link',
    version: 70,
    sql: `
      -- Thêm cột address và map_link vào centers table
      ALTER TABLE centers
        ADD COLUMN IF NOT EXISTS address VARCHAR(500);
      ALTER TABLE centers
        ADD COLUMN IF NOT EXISTS map_link VARCHAR(500);

      -- Cập nhật dữ liệu centers với địa chỉ và Google Maps link từ Hà Nội
      WITH ha_noi_data(full_name, display_name, address, map_link) AS (
        VALUES
          ('MindX Hoàng Đạo Thúy', 'Hoàng Đạo Thúy', 'Tầng 2, Tòa 29T1 Hoàng Đạo Thúy, Cầu Giấy, Hà Nội', 'https://www.google.com/maps/search/MindX+Hoàng+Đạo+Thúy'),
          ('MindX Nguyễn Chí Thanh', 'Nguyễn Chí Thanh', 'Tầng 5, 71 Nguyễn Chí Thanh, Đống Đa, Hà Nội', 'https://www.google.com/maps/search/MindX+71+Nguyễn+Chí+Thanh'),
          ('MindX Thành Công', 'Thành Công', 'Tầng 6, Toà C, 22 Thành Công, Ba Đình, Hà Nội', 'https://www.google.com/maps/search/MindX+22+Thành+Công'),
          ('MindX Nguyễn Phong Sắc', 'Nguyễn Phong Sắc', 'Tầng 6, 107 Nguyễn Phong Sắc, Cầu Giấy, Hà Nội', 'https://www.google.com/maps/search/MindX+107+Nguyễn+Phong+Sắc'),
          ('MindX Minh Khai', 'Minh Khai', 'Tầng 4, 505 Minh Khai, Hai Bà Trưng, Hà Nội', 'https://www.google.com/maps/search/MindX+505+Minh+Khai'),
          ('MindX Hà Đông', 'Hà Đông', 'Tầng 7, tòa nhà Mac Plaza, Số 10 Trần Phú, Hà Đông, Hà Nội', 'https://www.google.com/maps/search/MindX+Mac+Plaza+Trần+Phú'),
          ('MindX Nguyễn Hoàng', 'Nguyễn Hoàng', 'Tầng 3, Dolphin Plaza, 28 Trần Bình, Nam Từ Liêm, Hà Nội', 'https://www.google.com/maps/search/MindX+Dolphin+Plaza'),
          ('MindX Nguyễn Tuân', 'Nguyễn Tuân', 'Tòa FS - GoldSeason, 47 Nguyễn Tuân, Thanh Xuân, Hà Nội', 'https://www.google.com/maps/search/MindX+47+Nguyễn+Tuân'),
          ('MindX Ocean Park', 'Ocean Park', 'Lô HD03 - SP.BH90, Vinhomes Ocean Park 1, Gia Lâm, Hà Nội', 'https://www.google.com/maps/search/MindX+Ocean+Park'),
          ('MindX Linh Đàm', 'Linh Đàm', 'Tầng 5, Hudland Tower, Nguyễn Hữu Thọ, Hoàng Mai, Hà Nội', 'https://www.google.com/maps/search/MindX+Hudland+Tower')
      )
      UPDATE centers c
      SET address = d.address, map_link = d.map_link
      FROM ha_noi_data d
      WHERE c.full_name = d.full_name
        OR c.display_name = d.display_name
        OR LOWER(c.full_name) LIKE '%' || LOWER(d.display_name) || '%';

      -- Cập nhật dữ liệu centers với địa chỉ và Google Maps link từ TP. Hồ Chí Minh
      WITH hcm_data(full_name, display_name, address, map_link) AS (
        VALUES
          ('MindX Điện Biên Phủ', 'Điện Biên Phủ', 'Lầu 2, 253 Điện Biên Phủ, Quận 3, TP. Hồ Chí Minh', 'https://www.google.com/maps/search/MindX+253+Điện+Biên+Phủ'),
          ('MindX Phan Văn Trị', 'Phan Văn Trị', '672A28 Phan Văn Trị, Gò Vấp, TP. Hồ Chí Minh', 'https://www.google.com/maps/search/MindX+Phan+Văn+Trị'),
          ('MindX Hoàng Văn Thụ', 'Hoàng Văn Thụ', 'Lầu 2, 431A Hoàng Văn Thụ, Tân Bình, TP. Hồ Chí Minh', 'https://www.google.com/maps/search/MindX+431A+Hoàng+Văn+Thụ'),
          ('MindX Thảo Điền', 'Thảo Điền', 'Lầu 2, 19 Đường 46, Thảo Điền, Quận 2, TP. Hồ Chí Minh', 'https://www.google.com/maps/search/MindX+Thảo+Điền'),
          ('MindX Trung Sơn', 'Trung Sơn', 'Lầu 2, 195 Đường 9A, KDC Trung Sơn, Bình Chánh, TP. Hồ Chí Minh', 'https://www.google.com/maps/search/MindX+Trung+Sơn'),
          ('MindX Phan Đăng Lưu', 'Phan Đăng Lưu', 'Tòa nhà Dali, 24C Phan Đăng Lưu, Bình Thạnh, TP. Hồ Chí Minh', 'https://www.google.com/maps/search/MindX+24C+Phan+Đăng+Lưu'),
          ('MindX Tây Thạnh', 'Tây Thạnh', 'Tầng 4, 322 Tây Thạnh, Tân Phú, TP. Hồ Chí Minh', 'https://www.google.com/maps/search/MindX+322+Tây+Thạnh'),
          ('MindX Thủ Đức', 'Thủ Đức', 'Lê Văn Việt, Quận 9, TP. Hồ Chí Minh', 'https://www.google.com/maps/search/MindX+Lê+Văn+Việt'),
          ('MindX Phú Mỹ Hưng', 'Phú Mỹ Hưng', 'Quận 7, TP. Hồ Chí Minh', 'https://www.google.com/maps/search/MindX+Phú+Mỹ+Hưng')
      )
      UPDATE centers c
      SET address = d.address, map_link = d.map_link
      FROM hcm_data d
      WHERE c.full_name = d.full_name
        OR c.display_name = d.display_name
        OR LOWER(c.full_name) LIKE '%' || LOWER(d.display_name) || '%';

      -- Cập nhật dữ liệu centers tại các tỉnh khác
      WITH other_provinces(display_name, region, address, map_link) AS (
        VALUES
          ('Đà Nẵng', 'Đà Nẵng', 'Quận Hải Châu, Đà Nẵng', 'https://www.google.com/maps/search/MindX+Đà+Nẵng'),
          ('Hải Phòng', 'Hải Phòng', 'Quận Ngô Quyền, Hải Phòng', 'https://www.google.com/maps/search/MindX+Hải+Phòng'),
          ('Bình Dương', 'Bình Dương', 'Thủ Dầu Một, Bình Dương', 'https://www.google.com/maps/search/MindX+Bình+Dương'),
          ('Cần Thơ', 'Cần Thơ', 'Ninh Kiều, Cần Thơ', 'https://www.google.com/maps/search/MindX+Cần+Thơ'),
          ('Vũng Tàu', 'Vũng Tàu', 'TP. Vũng Tàu', 'https://www.google.com/maps/search/MindX+Vũng+Tàu')
      )
      UPDATE centers c
      SET address = d.address, map_link = d.map_link
      FROM other_provinces d
      WHERE LOWER(c.display_name) = LOWER(d.display_name)
        OR LOWER(c.region) = LOWER(d.region)
        OR LOWER(c.full_name) LIKE '%' || LOWER(d.display_name) || '%';
    `,
  },
  {
    name: 'V71_centers_complete_address_update',
    version: 71,
    sql: `
      -- V71: Cập nhật địa chỉ chi tiết từ website chính thức mindx.edu.vn
      -- Bao gồm 44 cơ sở tại Việt Nam

      -- Hà Nội (8 cơ sở)
      WITH hanoi_centers(display_name, address, map_link) AS (
        VALUES
          ('Hoàng Đạo Thúy', 'Tầng 2, Toà nhà 29T1 Hoàng Đạo Thuý, Phường Yên Hoà, Quận Cầu Giấy, Hà Nội', 'https://www.google.com/maps/search/29T1+Hoàng+Đạo+Thúy+Hà+Nội'),
          ('Nguyễn Chí Thanh', 'Tầng 5, Số 71 Nguyễn Chí Thanh, Phường Giảng Võ, Quận Ba Đình, Hà Nội', 'https://www.google.com/maps/search/71+Nguyễn+Chí+Thanh+Hà+Nội'),
          ('Thành Công', 'Tầng 2, Toà nhà Nhà Sách Nhân Văn, 1 Trường Chinh, Phường Bảy Hiền, Quận Tân Bình, Hà Nội', 'https://www.google.com/maps/search/Thành+Công+Hà+Nội'),
          ('Nguyễn Phong Sắc', 'Tầng 6, Số 107 Nguyễn Phong Sắc, Phường Cầu Giấy, Quận Cầu Giấy, Hà Nội', 'https://www.google.com/maps/search/107+Nguyễn+Phong+Sắc+Cầu+Giấy+Hà+Nội'),
          ('Minh Khai', 'Tầng 4, Số 505 Minh Khai, Phường Vĩnh Tuy, Quận Hai Bà Trưng, Hà Nội', 'https://www.google.com/maps/search/505+Minh+Khai+Hà+Nội'),
          ('Hà Đông', 'Tầng 3, Toà nhà Cao cấp Westa, 102 Trần Phú, Phường Hà Đông, Quận Hà Đông, Hà Nội', 'https://www.google.com/maps/search/102+Trần+Phú+Hà+Đông+Hà+Nội'),
          ('Ocean Park', 'Lô thương mại số HD03 - SP.BH90, Vinhome Ocean Park 1, xã Gia Lâm, Hà Nội', 'https://www.google.com/maps/search/Vinhome+Ocean+Park+1+Gia+Lâm+Hà+Nội'),
          ('Linh Đàm', 'Tầng 5, Toà Hudland Tower, Lô A-CC7, Nguyễn Hữu Thọ, Phường Định Công, Hoàng Mai, Hà Nội', 'https://www.google.com/maps/search/Nguyễn+Hữu+Thọ+Định+Công+Hà+Nội')
      )
      UPDATE centers c
      SET address = d.address, map_link = d.map_link
      FROM hanoi_centers d
      WHERE LOWER(c.display_name) = LOWER(d.display_name)
        OR LOWER(c.full_name) LIKE '%' || LOWER(d.display_name) || '%';

      -- TP. Hồ Chí Minh (19 cơ sở)
      WITH hcm_centers(display_name, address, map_link) AS (
        VALUES
          ('Nguyễn Xí', 'Tầng trệt và Tầng 1, Số 223 Nguyễn Xí, Phường Bình Lợi Trung, Quận Bình Thạnh, TP HCM', 'https://www.google.com/maps/search/223+Nguyễn+Xí+TPHCM'),
          ('Tên Lửa', 'Số 174-176, Đường số 1, Khu đô thị Tên Lửa, Phường An Lạc, Quận Bình Tân, TP HCM', 'https://www.google.com/maps/search/174+Tên+Lửa+TPHCM'),
          ('Tây Thạnh', 'Tầng 4, Toà nhà số 322 Tây Thạnh, Phường Tây Thạnh, Quận Tân Phú, TP HCM', 'https://www.google.com/maps/search/322+Tây+Thạnh+TPHCM'),
          ('Him Lam', 'Số 165-167 Nguyễn Thị Thập, Khu Đô Thị Mới Him Lam, Phường Tân Hưng, Quận 7, TP HCM', 'https://www.google.com/maps/search/165-167+Nguyễn+Thị+Thập+TPHCM'),
          ('Song Hành', 'Tầng 2, số 02 Song Hành, Phường Bình Trưng, Quận 2, TP HCM', 'https://www.google.com/maps/search/02+Song+Hành+TPHCM'),
          ('Hải Thượng Lãn Ông', 'Tầng trệt và lầu 1, Tòa nhà số 39 Hải Thượng Lãn Ông, Phường Chợ Lớn, Quận 5, TP HCM', 'https://www.google.com/maps/search/39+Hải+Thượng+Lãn+Ông+TPHCM'),
          ('Quang Trung', 'Lầu 1, số 1 Quang Trung, phường 10, Quận Gò Vấp, TP HCM', 'https://www.google.com/maps/search/1+Quang+Trung+Gò+Vấp+TPHCM'),
          ('Luỹ Bán Bích', 'Tầng 3-4, 414 Luỹ Bán Bích, Phường Tân Phú, Quận Tân Phú, TP HCM', 'https://www.google.com/maps/search/414+Lũy+Bán+Bích+TPHCM'),
          ('Trường Chinh', 'Tầng 2, Toà nhà Nhà Sách Nhân Văn, 1 Trường Chinh, Phường Bảy Hiền, Quận Tân Bình, TP HCM', 'https://www.google.com/maps/search/1+Trường+Chinh+TPHCM'),
          ('Phan Văn Trị', 'Tầng 1, 3 & 5, 672A28 Phan Văn Trị, Phường Gò Vấp, Quận Gò Vấp, TP HCM', 'https://www.google.com/maps/search/672A28+Phan+Văn+Trị+Gò+Vấp+TPHCM'),
          ('Tô Ký', 'Tầng 4, Công Viên Phần Mềm Quang Trung, 1 Tô Ký, phường Trung Mỹ Tây, Quận 12, TP HCM', 'https://www.google.com/maps/search/1+Tô+Ký+Công+Viên+Phần+Mềm+Quang+Trung+TPHCM'),
          ('Phú Mỹ Hưng', 'Số 490, Phường Tân Hưng, Quận 7, TP HCM', 'https://www.google.com/maps/search/490+Phạm+Thái+Bường+TPHCM'),
          ('Phạm Ngũ Lão', 'Tầng 9, Tòa nhà International Plaza, 343 Phạm Ngũ Lão, Phường Bến Thành, Quận 1, TP HCM', 'https://www.google.com/maps/search/343+Phạm+Ngũ+Lão+TPHCM'),
          ('Thủ Đức', 'Căn A23-A25, Khu A, dự án Saigon Villas Hill, 99 Lê Văn Việt, Phường Tăng Nhơn Phú, Thủ Đức, TP HCM', 'https://www.google.com/maps/search/99+Lê+Văn+Việt+TPHCM'),
          ('Phạm Văn Đồng', 'Lầu 2, 120-122 Kha Vạn Cân, Phường Hiệp Bình, Thủ Đức, TP HCM', 'https://www.google.com/maps/search/120-122+Phạm+Văn+Đồng+TPHCM'),
          ('Phan Xích Long', 'Tầng 8, Tòa nhà 261-263 Phan Xích Long, Phường Cầu Kiệu, Quận Phú Nhuận, TP HCM', 'https://www.google.com/maps/search/261-263+Phan+Xích+Long+TPHCM'),
          ('Ba Tháng Hai', 'Tầng trệt và lầu 1, 614-616-618 đường Ba Tháng Hai, Phường Diên Hồng, Quận 10, TP HCM', 'https://www.google.com/maps/search/618+Đường+3/2+TPHCM'),
          ('Nguyễn Duy Trinh', 'Tầng trệt và tầng lửng L.01, 383 Nguyễn Duy Trinh, Phường Bình Trưng, Quận 2, TP HCM', 'https://www.google.com/maps/search/383+Nguyễn+Duy+Trinh+Bình+Trưng+TPHCM'),
          ('Hoàng Văn Thụ', 'Lầu 2, Tòa nhà Dali, 431A Hoàng Văn Thụ, Phường Tân Bình, Quận Tân Bình, TP HCM', 'https://www.google.com/maps/search/MindX+431A+Hoàng+Văn+Thụ')
      )
      UPDATE centers c
      SET address = d.address, map_link = d.map_link
      FROM hcm_centers d
      WHERE LOWER(c.display_name) = LOWER(d.display_name)
        OR LOWER(c.full_name) LIKE '%' || LOWER(d.display_name) || '%';

      -- Các tỉnh khác (17 cơ sở)
      WITH other_provinces_data(display_name, region, address, map_link) AS (
        VALUES
          ('Bắc Ninh', 'Bắc Ninh', 'Tầng 4, toà nhà Dương Tuấn, Đường Lê Thái Tổ, Phường Võ Cường, Bắc Ninh', 'https://www.google.com/maps/search/Lê+Thái+Tổ+Bắc+Ninh'),
          ('Đà Nẵng', 'Đà Nẵng', 'Tầng 5, Khu A1, Tòa nhà Vĩnh Trung Plaza, 255-257 Hùng Vương, Phường Thanh Khê, Đà Nẵng', 'https://www.google.com/maps/search/255-257+Hùng+Vương+Đà+Nẵng'),
          ('Hải Phòng', 'Hải Phòng', 'Tầng 2, toà nhà Bạch Đằng, 268 Trần Nguyên Hãn, Phường An Biên, Hải Phòng', 'https://www.google.com/maps/search/268+Trần+Nguyên+Hãn+Hải+Phòng'),
          ('Cần Thơ', 'Cần Thơ', 'Tầng 01, 153Q Trần Hưng Đạo, Phường Ninh Kiều, Cần Thơ', 'https://www.google.com/maps/search/153Q+Trần+Hưng+Đạo+Ninh+Kiều+Cần+Thơ'),
          ('Vũng Tàu', 'Vũng Tàu', 'Tầng 4, toà nhà Viettel Vũng Tàu, 205A Lê Hồng Phong, Phường Tam Thắng, Vũng Tàu', 'https://www.google.com/maps/search/205A+Lê+Hồng+Phong+Vũng+Tàu'),
          ('Bình Dương', 'Bình Dương', 'Tầng 2, toà nhà Becamex Tower, 230 Đại Lộ Bình Dương, Phường Phú Lợi, Thủ Dầu Một, Bình Dương', 'https://www.google.com/maps/search/230+Đại+Lộ+Bình+Dương+Thủ+Dầu+Một'),
          ('Đồng Nai', 'Đồng Nai', 'Tầng 2, Tòa nhà Nguyễn Kim, 253 Phạm Văn Thuận, Phường Tam Hiệp, Biên Hòa, Đồng Nai', 'https://www.google.com/maps/search/253+Phạm+Văn+Thuận+Biên+Hòa'),
          ('Phú Thọ', 'Phú Thọ', 'Tầng 2, TTTM Happy Land, 1606A Hùng Vương, Việt Trì, Phú Thọ', 'https://www.google.com/maps/search/1606A+Hùng+Vương+Việt+Trì+Phú+Thọ'),
          ('Vĩnh Phúc', 'Vĩnh Phúc', 'Tầng 2, Tòa nhà Viettel Vĩnh Phúc, Lô S1, Khu đô thị chùa Hà Tiên, Vĩnh Yên, Vĩnh Phúc', 'https://www.google.com/maps/search/Tòa+Viettel+Vĩnh+Phúc+Trần+Phú+Vĩnh+Yên'),
          ('Thái Nguyên', 'Thái Nguyên', 'Tầng 3, Tòa nhà Viettel, Số 4 Hoàng Văn Thụ, Phường Phan Đình Phùng, Thái Nguyên', 'https://www.google.com/maps/search/4+Hoàng+Văn+Thụ+Thái+Nguyên'),
          ('Thanh Hóa', 'Thanh Hóa', 'Tầng 3, Tòa nhà Viettel, Nam Đại Lộ Lê Lợi, Phường Hạc Thành, Thanh Hóa', 'https://www.google.com/maps/search/Đại+Lộ+Lê+Lợi+Thanh+Hóa'),
          ('Nghệ An', 'Nghệ An', 'Tầng 2, toà nhà Viettel, Số 67 Đại Lộ Lê Nin, Phường Vinh Phú, Vinh, Nghệ An', 'https://www.google.com/maps/search/67+Đại+Lộ+Lê+Nin+Vinh+Nghệ+An'),
          ('Quảng Ninh', 'Quảng Ninh', 'Tầng 2, số 70 Nguyễn Văn Cừ, Phường Hạ Long, Hạ Long, Quảng Ninh', 'https://www.google.com/maps/search/70+Nguyễn+Văn+Cừ+Hạ+Long+Quảng+Ninh'),
          ('Dĩ An', 'Bình Dương', 'Tầng 3, 76 Nguyễn An Ninh, Phường Dĩ An, Dĩ An, Bình Dương', 'https://www.google.com/maps/search/76+Nguyễn+An+Ninh+Dĩ+An'),
          ('Lái Thiêu', 'Bình Dương', 'Tầng 2, số 40 Lái Thiêu 1, phường Lái Thiêu, Thuận An, Bình Dương', 'https://www.google.com/maps/search/40+Lái+Thiêu+1+Thuận+An+Bình+Dương'),
          ('Đình Bảng', 'Bắc Ninh', 'Số 1 Nguyễn Văn Trỗi, Đình Bảng, Từ Sơn, Bắc Ninh', 'https://www.google.com/maps/search/Số+1+Nguyễn+Văn+Trỗi+Đình+Bảng+Từ+Sơn')
      )
      UPDATE centers c
      SET address = d.address, map_link = d.map_link
      FROM other_provinces_data d
      WHERE LOWER(c.display_name) = LOWER(d.display_name)
        OR LOWER(c.full_name) LIKE '%' || LOWER(d.display_name) || '%'
        OR LOWER(c.region) = LOWER(d.region);
    `,
  },
  {
    name: 'V72_centers_address_corrections',
    version: 72,
    sql: `
      -- V72: Cập nhật địa chỉ chính xác hơn và Google Maps direct links từ user feedback

      -- Hà Nội corrections (5 centers)
      UPDATE centers
      SET address = 'Tầng 1 và tầng 2, Tòa A3 Vinhomes Gardenia Hàm Nghi, Quận Nam Từ Liêm, Hà Nội',
          map_link = 'https://maps.app.goo.gl/5BEAocQ5yEtwYnfA9'
      WHERE LOWER(display_name) LIKE '%hàm nghi%' OR LOWER(full_name) LIKE '%hàm nghi%';

      UPDATE centers
      SET address = 'Tầng 5, Toà nhà Hudland, 06 Nguyễn Hữu Thọ, Phường Hoàng Liệt, Quận Hoàng Mai, Hà Nội',
          map_link = 'https://maps.app.goo.gl/gMpTg8cjeeUtLo5W8'
      WHERE LOWER(display_name) LIKE '%nguyễn hữu thọ%' OR LOWER(display_name) LIKE '%linh đàm%' OR LOWER(full_name) LIKE '%hữu thọ%';

      UPDATE centers
      SET address = 'Tầng 2, 98 Nguyễn Văn Cừ, Phường Bồ Đề, Quận Long Biên, Hà Nội',
          map_link = 'https://maps.app.goo.gl/mnCmPmMfVihCrFic8'
      WHERE LOWER(display_name) LIKE '%nguyễn văn cừ%' OR LOWER(full_name) LIKE '%cừ%';

      UPDATE centers
      SET address = 'Tầng 2, Tòa V1 Văn Phú Victoria, Khu đô thị Văn Phú, Phường Phú La, Quận Hà Đông, Hà Nội',
          map_link = 'https://maps.app.goo.gl/EwXen2QSHzShwxG16'
      WHERE LOWER(display_name) LIKE '%văn phú%' OR LOWER(full_name) LIKE '%văn phú%';

      UPDATE centers
      SET address = 'Tầng 7, Toà nhà MAC Plaza, 10 Trần Phú, Phường Mộ Lao, Quận Hà Đông, Hà Nội',
          map_link = 'https://maps.app.goo.gl/U7MfFTByCc7Zu6x3A'
      WHERE LOWER(display_name) LIKE '%trần phú%' OR LOWER(display_name) LIKE '%hà đông%' OR LOWER(full_name) LIKE '%trần phú%';

      -- TP. Hồ Chí Minh corrections (2 centers)
      UPDATE centers
      SET address = 'Tầng 3&4, 414 Lũy Bán Bích, Phường Hòa Thạnh, Quận Tân Phú, TP HCM',
          map_link = 'https://maps.app.goo.gl/7xsjJ6P46CGj3zt77'
      WHERE LOWER(display_name) LIKE '%luỹ%' OR LOWER(display_name) LIKE '%lũy%' OR LOWER(full_name) LIKE '%bán bích%';

      UPDATE centers
      SET address = 'Tầng trệt và tầng 2, 618 đường 3/2, Phường 14, Quận 10, TP HCM',
          map_link = 'https://maps.app.goo.gl/mwCvsHx1Kw67gGFz6'
      WHERE LOWER(display_name) LIKE '%3/2%' OR LOWER(display_name) LIKE '%ba tháng hai%' OR LOWER(display_name) LIKE '%đường 3%' OR LOWER(full_name) LIKE '%ba tháng%';
    `,
  },
  {
    name: 'V73_centers_long_bien_hanoi',
    version: 73,
    sql: `
      -- V73: Thêm/cập nhật Long Biên center - Vinhomes Riverside

      UPDATE centers
      SET address = 'Số 8, Shophouse, Nguyệt Quế 25, Khu đô thị Vinhomes Riverside, Phúc Lợi, Hà Nội, Việt Nam',
          map_link = 'https://maps.app.goo.gl/aJ8wrf23PBT1ckR98'
      WHERE LOWER(display_name) LIKE '%long biên%' OR LOWER(full_name) LIKE '%long biên%' OR LOWER(full_name) LIKE '%vinhomes riverside%';

      -- Nếu center chưa tồn tại, có thể thêm mới (uncomment if needed)
      -- INSERT INTO centers (region, short_code, full_name, display_name, address, map_link, status)
      -- VALUES ('Hà Nội', 'longbien', 'MindX Long Biên', 'Long Biên', 'Số 8, Shophouse, Nguyệt Quế 25, Khu đô thị Vinhomes Riverside, Phúc Lợi, Hà Nội, Việt Nam', 'https://maps.app.goo.gl/aJ8wrf23PBT1ckR98', 'Active')
      -- ON CONFLICT (short_code) DO UPDATE SET address = EXCLUDED.address, map_link = EXCLUDED.map_link;
    `,
  },
  {
    name: 'V74_event_schedule_upgrade_hybrid_teams',
    version: 74,
    sql: `
      -- V74: Nâng cấp lịch sự kiện chung để hỗ trợ online/offline + hybrid Teams + duyệt giảng

      -- 1) Chuẩn hóa dữ liệu centers cho use-case hiển thị địa chỉ + bản đồ
      ALTER TABLE centers ADD COLUMN IF NOT EXISTS full_address TEXT;
      ALTER TABLE centers ADD COLUMN IF NOT EXISTS map_url TEXT;
      ALTER TABLE centers ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7);
      ALTER TABLE centers ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);
      ALTER TABLE centers ADD COLUMN IF NOT EXISTS hotline VARCHAR(50);

      UPDATE centers
      SET
        full_address = COALESCE(NULLIF(full_address, ''), address),
        map_url = COALESCE(NULLIF(map_url, ''), map_link)
      WHERE full_address IS NULL
         OR map_url IS NULL;

      -- 2) Mở rộng event_schedules cho online/offline/hybrid + teams + participants + status
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'online';
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id) ON DELETE SET NULL;
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS room VARCHAR(255);
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS dia_chi_su_kien TEXT;
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS map_url TEXT;
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS meeting_url TEXT;
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS meeting_id VARCHAR(255);
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS lecture_reviewer VARCHAR(255);
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS trang_thai VARCHAR(30) DEFAULT 'scheduled';
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS reminder_offsets INT[] DEFAULT ARRAY[5, 15, 30, 60];
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS reminder_channels TEXT[] DEFAULT ARRAY['in_app', 'email'];
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS allow_registration BOOLEAN DEFAULT false;
      ALTER TABLE event_schedules ADD COLUMN IF NOT EXISTS slot_limit INTEGER;

      -- Đồng bộ mode/address/map từ dữ liệu cũ nếu có
      UPDATE event_schedules
      SET mode = COALESCE(NULLIF(mode, ''), 'online')
      WHERE mode IS NULL OR mode = '';

      UPDATE event_schedules es
      SET
        dia_chi_su_kien = COALESCE(es.dia_chi_su_kien, c.full_address, c.address),
        map_url = COALESCE(es.map_url, c.map_url, c.map_link)
      FROM centers c
      WHERE es.center_id = c.id
        AND (es.dia_chi_su_kien IS NULL OR es.map_url IS NULL);

      ALTER TABLE event_schedules DROP CONSTRAINT IF EXISTS event_schedules_mode_check;
      ALTER TABLE event_schedules
        ADD CONSTRAINT event_schedules_mode_check
        CHECK (LOWER(mode) IN ('online', 'offline'));

      ALTER TABLE event_schedules DROP CONSTRAINT IF EXISTS event_schedules_status_check;
      ALTER TABLE event_schedules
        ADD CONSTRAINT event_schedules_status_check
        CHECK (LOWER(trang_thai) IN ('scheduled', 'completed', 'cancelled', 'rescheduled'));

      CREATE INDEX IF NOT EXISTS idx_event_schedules_mode ON event_schedules(mode);
      CREATE INDEX IF NOT EXISTS idx_event_schedules_center_id ON event_schedules(center_id);
      CREATE INDEX IF NOT EXISTS idx_event_schedules_status ON event_schedules(trang_thai);
      CREATE INDEX IF NOT EXISTS idx_event_schedules_start_end ON event_schedules(bat_dau_luc, ket_thuc_luc);

      -- 3) Bảng đăng ký duyệt giảng
      CREATE TABLE IF NOT EXISTS lecture_review_registrations (
        id BIGSERIAL PRIMARY KEY,
        event_id UUID NOT NULL REFERENCES event_schedules(id) ON DELETE CASCADE,
        te_leader_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        teacher_code VARCHAR(50) NOT NULL REFERENCES teachers(code) ON DELETE RESTRICT,
        lecture_reviewer VARCHAR(255),
        date_regist TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_lecture_review_registrations_event_teacher UNIQUE (event_id, teacher_code),
        CONSTRAINT lecture_review_registrations_status_check CHECK (LOWER(status) IN ('pending', 'approved', 'rejected', 'cancelled'))
      );

      CREATE INDEX IF NOT EXISTS idx_lrr_event_id ON lecture_review_registrations(event_id);
      CREATE INDEX IF NOT EXISTS idx_lrr_te_leader_id ON lecture_review_registrations(te_leader_id);
      CREATE INDEX IF NOT EXISTS idx_lrr_teacher_code ON lecture_review_registrations(teacher_code);
      CREATE INDEX IF NOT EXISTS idx_lrr_status ON lecture_review_registrations(status);

      DROP TRIGGER IF EXISTS trg_lecture_review_registrations_updated_at ON lecture_review_registrations;
      CREATE TRIGGER trg_lecture_review_registrations_updated_at
        BEFORE UPDATE ON lecture_review_registrations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `,
  },
  {
    name: 'V75_lecture_reviewer_meetings',
    version: 75,
    sql: `
      -- V75: Lưu meeting link riêng cho từng reviewer để không cần auto-create Teams meeting
      CREATE TABLE IF NOT EXISTS lecture_reviewer_meetings (
        id BIGSERIAL PRIMARY KEY,
        reviewer_name VARCHAR(255) NOT NULL UNIQUE,
        meeting_url TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT lecture_reviewer_meetings_status_check CHECK (LOWER(status) IN ('active', 'inactive'))
      );

      CREATE INDEX IF NOT EXISTS idx_lecture_reviewer_meetings_reviewer_name
        ON lecture_reviewer_meetings(reviewer_name);

      DROP TRIGGER IF EXISTS trg_lecture_reviewer_meetings_updated_at ON lecture_reviewer_meetings;
      CREATE TRIGGER trg_lecture_reviewer_meetings_updated_at
        BEFORE UPDATE ON lecture_reviewer_meetings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `,
  },
  {
    name: 'V76_add_review_lesson_to_lrr',
    version: 76,
    sql: `
      -- V76: Add review_lesson column to lecture_review_registrations
      ALTER TABLE lecture_review_registrations
        ADD COLUMN IF NOT EXISTS review_lesson TEXT;

      -- Ensure column exists if table already created in older environments
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lecture_review_registrations' AND column_name = 'review_lesson'
        ) THEN
          ALTER TABLE lecture_review_registrations ADD COLUMN review_lesson TEXT;
        END IF;
      END
      $$;
    `,
  },
  {
    name: 'V77_system_events_tracking',
    version: 77,
    sql: `
      -- V77: Core tracking table used by metrics endpoints and client-side event batching
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
    `,
  },
  {
    name: 'V78_teacher_avatars',
    version: 78,
    sql: `
      CREATE TABLE IF NOT EXISTS teacher_avatars (
        teacher_email VARCHAR(255) PRIMARY KEY,
        avatar_url TEXT NOT NULL,
        avatar_storage_key TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      DROP TRIGGER IF EXISTS trg_teacher_avatars_updated_at ON teacher_avatars;
      CREATE TRIGGER trg_teacher_avatars_updated_at
        BEFORE UPDATE ON teacher_avatars
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `,
  },
]

// ========== HÀM CHẠY MIGRATIONS ==========

let migrationRan = false

export async function runMigrations(
  pool: Pool,
): Promise<{ success: boolean; applied: string[]; errors: string[] }> {
  const applied: string[] = []
  const errors: string[] = []
  let client
  try {
    client = await pool.connect()
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          version INTEGER NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `)
      const result = await client.query('SELECT name FROM _migrations')
      const appliedMigrations = new Set(
        result.rows.map((r: { name: string }) => r.name),
      )
      for (const migration of migrations) {
        if (appliedMigrations.has(migration.name)) continue
        try {
          await client.query('BEGIN')
          await client.query(migration.sql)
          await client.query(
            'INSERT INTO _migrations (name, version) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
            [migration.name, migration.version],
          )
          await client.query('COMMIT')
          applied.push(migration.name)
          console.log(
            `  ✅ Migration applied: ${migration.name} (v${migration.version})`,
          )
        } catch (err: unknown) {
          await client.query('ROLLBACK')
          const errorMessage = err instanceof Error ? err.message : String(err)
          const errorMsg = `Migration ${migration.name} failed: ${errorMessage}`
          errors.push(errorMsg)
          console.error(`  ❌ ${errorMsg}`)
        }
      }
      return { success: errors.length === 0, applied, errors }
    } finally {
      client.release()
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('❌ Migration system error:', errorMessage)
    return { success: false, applied, errors: [errorMessage] }
  }
}

export async function initDatabase(pool: Pool): Promise<void> {
  if (migrationRan) return
  migrationRan = true
  console.log('\n🔄 Running database migrations...')
  const result = await runMigrations(pool)
  if (result.applied.length === 0) {
    console.log('✅ Database is up to date. No new migrations.\n')
  } else {
    console.log(`✅ Applied ${result.applied.length} migration(s).\n`)
  }
  if (result.errors.length > 0) {
    console.warn(`⚠️ ${result.errors.length} migration(s) had errors.\n`)
  }
}

export { migrations }
