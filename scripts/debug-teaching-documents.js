/**
 * Script để debug teaching documents trong database
 * Chạy: node scripts/debug-teaching-documents.js
 */

const { Pool } = require('pg');

// Load environment variables
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_HOST?.includes('supabase') ? { rejectUnauthorized: false } : false,
});

async function debugTeachingDocuments() {
  try {
    console.log('🔍 Đang kết nối database...\n');

    // 1. Kiểm tra cấu trúc bảng
    console.log('📋 CẤU TRÚC BẢNG teaching_documents:');
    console.log('='.repeat(80));
    const schemaResult = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'teaching_documents'
      ORDER BY ordinal_position
    `);
    
    console.table(schemaResult.rows);

    // 2. Đếm tổng số tài liệu
    console.log('\n📊 THỐNG KÊ:');
    console.log('='.repeat(80));
    const countResult = await pool.query('SELECT COUNT(*) as total FROM teaching_documents');
    console.log(`Tổng số tài liệu: ${countResult.rows[0].total}`);

    // 3. Thống kê theo subject
    const subjectStats = await pool.query(`
      SELECT 
        subject_name,
        COUNT(*) as count
      FROM teaching_documents
      GROUP BY subject_name
      ORDER BY count DESC
    `);
    console.log('\nThống kê theo môn học:');
    console.table(subjectStats.rows);

    // 4. Thống kê theo course_name
    const courseStats = await pool.query(`
      SELECT 
        course_name,
        COUNT(*) as count
      FROM teaching_documents
      WHERE course_name IS NOT NULL
      GROUP BY course_name
      ORDER BY count DESC
    `);
    console.log('\nThống kê theo khóa học:');
    console.table(courseStats.rows);

    // 5. Thống kê theo document_level
    const levelStats = await pool.query(`
      SELECT 
        document_level,
        COUNT(*) as count
      FROM teaching_documents
      GROUP BY document_level
      ORDER BY count DESC
    `);
    console.log('\nThống kê theo level:');
    console.table(levelStats.rows);

    // 6. Lấy tất cả tài liệu Scratch Advance
    console.log('\n📚 TÀI LIỆU SCRATCH ADVANCE:');
    console.log('='.repeat(80));
    const scratchDocs = await pool.query(`
      SELECT 
        id,
        title,
        subject_name,
        course_name,
        document_level,
        lesson_number,
        document_status,
        file_name
      FROM teaching_documents
      WHERE 
        (LOWER(course_name) LIKE '%scratch%' AND LOWER(course_name) LIKE '%advance%')
        OR (LOWER(subject_name) LIKE '%scratch%' AND document_level = 'Advance')
      ORDER BY lesson_number
    `);
    
    if (scratchDocs.rows.length > 0) {
      console.table(scratchDocs.rows);
    } else {
      console.log('❌ Không tìm thấy tài liệu Scratch Advance');
    }

    // 7. Tìm tài liệu có "Buổi 4" hoặc "4" trong lesson_number
    console.log('\n📚 TÀI LIỆU CÓ BUỔI 4:');
    console.log('='.repeat(80));
    const lesson4Docs = await pool.query(`
      SELECT 
        id,
        title,
        subject_name,
        course_name,
        document_level,
        lesson_number,
        document_status
      FROM teaching_documents
      WHERE 
        lesson_number ILIKE '%4%'
        OR lesson_number ILIKE '%buổi 4%'
      ORDER BY subject_name, course_name, lesson_number
    `);
    
    if (lesson4Docs.rows.length > 0) {
      console.table(lesson4Docs.rows);
    } else {
      console.log('❌ Không tìm thấy tài liệu buổi 4');
    }

    // 8. Lấy 10 tài liệu mẫu
    console.log('\n📚 10 TÀI LIỆU MẪU:');
    console.log('='.repeat(80));
    const sampleDocs = await pool.query(`
      SELECT 
        id,
        title,
        subject_name,
        course_name,
        document_level,
        lesson_number,
        document_status
      FROM teaching_documents
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.table(sampleDocs.rows);

    // 9. Kiểm tra pattern matching
    console.log('\n🔍 KIỂM TRA MATCHING CHO "1:1 C4K-SA - Buổi 4":');
    console.log('='.repeat(80));
    
    const testCourse = '1:1 C4K-SA';
    const testSession = 4;
    
    console.log(`Tìm kiếm: course="${testCourse}", session=${testSession}`);
    console.log('\nCác pattern sẽ thử:');
    console.log('- course_name ILIKE "%scratch%advance%"');
    console.log('- course_name ILIKE "%sa%"');
    console.log('- course_name ILIKE "%c4k%"');
    console.log('- lesson_number ILIKE "%4%"');
    
    const matchTest = await pool.query(`
      SELECT 
        id,
        title,
        subject_name,
        course_name,
        document_level,
        lesson_number,
        document_status,
        CASE 
          WHEN LOWER(course_name) LIKE '%scratch%' THEN '✓ Scratch'
          ELSE '✗'
        END as has_scratch,
        CASE 
          WHEN LOWER(course_name) LIKE '%advance%' THEN '✓ Advance'
          ELSE '✗'
        END as has_advance,
        CASE 
          WHEN lesson_number ILIKE '%4%' THEN '✓ Buổi 4'
          ELSE '✗'
        END as has_lesson_4
      FROM teaching_documents
      WHERE 
        document_status = 'published'
        AND (
          LOWER(course_name) LIKE '%scratch%'
          OR LOWER(subject_name) LIKE '%scratch%'
          OR LOWER(course_name) LIKE '%sa%'
          OR LOWER(course_name) LIKE '%c4k%'
        )
      ORDER BY 
        (LOWER(course_name) LIKE '%scratch%' AND LOWER(course_name) LIKE '%advance%') DESC,
        (lesson_number ILIKE '%4%') DESC
      LIMIT 20
    `);
    
    if (matchTest.rows.length > 0) {
      console.table(matchTest.rows);
    } else {
      console.log('❌ Không tìm thấy tài liệu phù hợp');
    }

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    console.error(error);
  } finally {
    await pool.end();
    console.log('\n✅ Đã đóng kết nối database');
  }
}

debugTeachingDocuments();
