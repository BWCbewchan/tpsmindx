const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: '.env' });

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

if (!dbConfig.host || !dbConfig.user || !dbConfig.password) {
  console.error('❌ Missing database credentials in .env file.');
  process.exit(1);
}

const pool = new Pool(dbConfig);

async function clearTrainingData() {
  const client = await pool.connect();
  try {
    console.log('🔄 Bắt đầu xóa dữ liệu người dùng đào tạo (để test lại)...');
    
    await client.query('BEGIN');

    // 1. Xóa answers (liên kết với submission, nhưng xóa explicit cho chắc nếu cascade chưa chuẩn)
    // Thực tế migration V16 có ON DELETE CASCADE, nên xóa submission là đủ.
    // Tuy nhiên migration V19 training_teacher_answers ko dính tới submission nào cụ thể (nó link to video/question)
    
    console.log('1️⃣  Đang xóa training_teacher_answers...');
    const res1 = await client.query('DELETE FROM training_teacher_answers');
    console.log(`   -> Đã xóa ${res1.rowCount} dòng.`);

    console.log('2️⃣  Đang xóa training_assignment_submissions (sẽ cascade xóa answers bài tập)...');
    const res2 = await client.query('DELETE FROM training_assignment_submissions');
    console.log(`   -> Đã xóa ${res2.rowCount} bài nộp.`);

    console.log('3️⃣  Đang xóa training_teacher_video_scores (tiến độ xem video)...');
    const res3 = await client.query('DELETE FROM training_teacher_video_scores');
    console.log(`   -> Đã xóa ${res3.rowCount} dòng tiến độ.`);

    console.log('3.5️⃣  Đang xóa exam_registrations (đăng ký thi liên kết với giáo viên)...');
    // Check if table exists first to avoid error if it doesn't
    const checkTable = await client.query("SELECT to_regclass('public.exam_registrations')");
    if (checkTable.rows[0].to_regclass) {
       const resExam = await client.query('DELETE FROM exam_registrations');
       console.log(`   -> Đã xóa ${resExam.rowCount} đăng ký thi.`);
    } else {
       console.log('   -> Bảng exam_registrations không tồn tại, bỏ qua.');
    }

    console.log('4️⃣  Đang xóa hoàn toàn danh sách trong training_teacher_stats...');
    const res4 = await client.query('DELETE FROM training_teacher_stats');
    console.log(`   -> Đã xóa ${res4.rowCount} giáo viên khỏi danh sách thống kê.`);

    await client.query('COMMIT');
    console.log('✅ Đã xóa hoàn tất dữ liệu đào tạo của người dùng (bao gồm danh sách giáo viên)!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi xóa dữ liệu:', err);
  } finally {
    client.release();
    pool.end();
  }
}

clearTrainingData();
