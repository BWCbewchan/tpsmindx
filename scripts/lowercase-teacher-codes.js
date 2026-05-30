const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 1. Tự parse file .env để lấy cấu hình kết nối DB
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    console.error('File .env không tồn tại tại:', envPath);
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  const config = {};
  envContent.split('\n').forEach(line => {
    // Bỏ qua dòng comment hoặc trống
    if (line.trim().startsWith('#') || line.trim() === '') return;
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
    if (match) {
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      config[match[1]] = value;
    }
  });
  return config;
}

const env = loadEnv();

const dbConfig = {
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT || '5432', 10),
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false // Supabase yêu cầu SSL
  }
};

const pool = new Pool(dbConfig);

async function runMigration() {
  const client = await pool.connect();
  console.log('=== BẮT ĐẦU DATABASE MIGRATION: CHUẨN HÓA TEACHER CODES ===');
  console.log(`Đang kết nối tới DB Host: ${dbConfig.host}`);

  try {
    await client.query('BEGIN');

    // ─── 1. BẢNG training_teacher_video_scores ─────────────────────────────
    console.log('\n--- 1. Xử lý bảng training_teacher_video_scores ---');
    
    // Tìm các bản ghi viết hoa hoặc chứa khoảng trắng
    const scoresQuery = `
      SELECT id, teacher_code, video_id, server_time_seconds, time_spent_seconds, score, completion_status, completed_at, last_heartbeat_at
      FROM training_teacher_video_scores
      WHERE teacher_code != LOWER(TRIM(teacher_code))
    `;
    const scoresRes = await client.query(scoresQuery);
    console.log(`Tìm thấy ${scoresRes.rows.length} bản ghi cần chuẩn hóa.`);

    let scoresUpdated = 0;
    let scoresMerged = 0;

    for (const row of scoresRes.rows) {
      const lowerCode = row.teacher_code.toLowerCase().trim();
      
      // Kiểm tra xem đã có bản ghi lowercase tương ứng chưa (unique constraint trên teacher_code, video_id)
      const checkLowerQuery = `
        SELECT id, server_time_seconds, time_spent_seconds, score, completion_status, completed_at, last_heartbeat_at
        FROM training_teacher_video_scores
        WHERE teacher_code = $1 AND video_id = $2
      `;
      const checkLowerRes = await client.query(checkLowerQuery, [lowerCode, row.video_id]);

      if (checkLowerRes.rows.length === 0) {
        // CHƯA CÓ bản ghi lowercase -> Chỉ cần update bản ghi hiện tại
        const updateQuery = `
          UPDATE training_teacher_video_scores
          SET teacher_code = $1, updated_at = NOW()
          WHERE id = $2
        `;
        await client.query(updateQuery, [lowerCode, row.id]);
        scoresUpdated++;
      } else {
        // ĐÃ CÓ bản ghi lowercase -> Tiến hành gộp dữ liệu
        const lowerRow = checkLowerRes.rows[0];
        
        // Tính toán giá trị gộp
        const mergedServerTime = Math.max(Number(row.server_time_seconds) || 0, Number(lowerRow.server_time_seconds) || 0);
        const mergedTimeSpent = Math.max(Number(row.time_spent_seconds) || 0, Number(lowerRow.time_spent_seconds) || 0);
        const mergedScore = Math.max(parseFloat(row.score) || 0, parseFloat(lowerRow.score) || 0);
        
        // Trạng thái hoàn thành ưu tiên: completed > watched > in_progress > not_started
        const statusPriority = (status) => {
          if (status === 'completed') return 3;
          if (status === 'watched') return 2;
          if (status === 'in_progress') return 1;
          return 0;
        };
        const mergedStatus = statusPriority(row.completion_status) > statusPriority(lowerRow.completion_status)
          ? row.completion_status
          : lowerRow.completion_status;

        // Ngày hoàn thành
        const mergedCompletedAt = lowerRow.completed_at || row.completed_at || null;
        
        // Heartbeat gần nhất
        const getLatestHeartbeat = () => {
          if (!row.last_heartbeat_at) return lowerRow.last_heartbeat_at;
          if (!lowerRow.last_heartbeat_at) return row.last_heartbeat_at;
          return new Date(row.last_heartbeat_at) > new Date(lowerRow.last_heartbeat_at)
            ? row.last_heartbeat_at
            : lowerRow.last_heartbeat_at;
        };
        const mergedHeartbeat = getLatestHeartbeat();

        // Cập nhật bản ghi lowercase hiện tại
        const updateLowerQuery = `
          UPDATE training_teacher_video_scores
          SET 
            server_time_seconds = $1,
            time_spent_seconds = $2,
            score = $3,
            completion_status = $4,
            completed_at = $5,
            last_heartbeat_at = $6,
            updated_at = NOW()
          WHERE id = $7
        `;
        await client.query(updateLowerQuery, [
          mergedServerTime,
          mergedTimeSpent,
          mergedScore,
          mergedStatus,
          mergedCompletedAt,
          mergedHeartbeat,
          lowerRow.id
        ]);

        // Xóa bản ghi viết hoa thừa
        const deleteQuery = `
          DELETE FROM training_teacher_video_scores
          WHERE id = $1
        `;
        await client.query(deleteQuery, [row.id]);
        scoresMerged++;
      }
    }
    console.log(`Đã cập nhật: ${scoresUpdated} bản ghi.`);
    console.log(`Đã gộp & Xóa trùng: ${scoresMerged} bản ghi.`);

    // ─── 2. BẢNG training_teacher_stats ──────────────────────────────────
    console.log('\n--- 2. Xử lý bảng training_teacher_stats ---');
    const statsQuery = `
      SELECT id, teacher_code, total_score
      FROM training_teacher_stats
      WHERE teacher_code != LOWER(TRIM(teacher_code))
    `;
    const statsRes = await client.query(statsQuery);
    console.log(`Tìm thấy ${statsRes.rows.length} bản ghi cần chuẩn hóa.`);

    let statsUpdated = 0;
    let statsMerged = 0;

    for (const row of statsRes.rows) {
      const lowerCode = row.teacher_code.toLowerCase().trim();
      const checkLowerQuery = `
        SELECT id, total_score
        FROM training_teacher_stats
        WHERE teacher_code = $1
      `;
      const checkLowerRes = await client.query(checkLowerQuery, [lowerCode]);

      if (checkLowerRes.rows.length === 0) {
        // CHƯA CÓ -> Chỉ cần đổi thành lowercase
        const updateQuery = `
          UPDATE training_teacher_stats
          SET teacher_code = $1, updated_at = NOW()
          WHERE id = $2
        `;
        await client.query(updateQuery, [lowerCode, row.id]);
        statsUpdated++;
      } else {
        // ĐÃ CÓ -> Gộp total_score (lấy max) và xóa bản ghi viết hoa
        const lowerRow = checkLowerRes.rows[0];
        const mergedTotalScore = Math.max(parseFloat(row.total_score) || 0, parseFloat(lowerRow.total_score) || 0);

        const updateLowerQuery = `
          UPDATE training_teacher_stats
          SET total_score = $1, updated_at = NOW()
          WHERE id = $2
        `;
        await client.query(updateLowerQuery, [mergedTotalScore, lowerRow.id]);

        const deleteQuery = `
          DELETE FROM training_teacher_stats
          WHERE id = $1
        `;
        await client.query(deleteQuery, [row.id]);
        statsMerged++;
      }
    }
    console.log(`Đã cập nhật: ${statsUpdated} bản ghi.`);
    console.log(`Đã gộp & Xóa trùng: ${statsMerged} bản ghi.`);

    // ─── 3. BẢNG training_assignment_submissions ─────────────────────────
    console.log('\n--- 3. Xử lý bảng training_assignment_submissions ---');
    const submissionsQuery = `
      SELECT COUNT(*) as count 
      FROM training_assignment_submissions
      WHERE teacher_code != LOWER(TRIM(teacher_code))
    `;
    const subRes = await client.query(submissionsQuery);
    const subCount = parseInt(subRes.rows[0].count, 10);
    console.log(`Tìm thấy ${subCount} dòng cần chuẩn hóa.`);

    if (subCount > 0) {
      const updateSubQuery = `
        UPDATE training_assignment_submissions
        SET teacher_code = LOWER(TRIM(teacher_code))
        WHERE teacher_code != LOWER(TRIM(teacher_code))
      `;
      const updateRes = await client.query(updateSubQuery);
      console.log(`Đã cập nhật thành công ${updateRes.rowCount} dòng.`);
    }

    // ─── 4. BẢNG training_teacher_answers ─────────────────────────────────
    console.log('\n--- 4. Xử lý bảng training_teacher_answers ---');
    const answersQuery = `
      SELECT COUNT(*) as count 
      FROM training_teacher_answers
      WHERE teacher_code != LOWER(TRIM(teacher_code))
    `;
    const ansRes = await client.query(answersQuery);
    const ansCount = parseInt(ansRes.rows[0].count, 10);
    console.log(`Tìm thấy ${ansCount} dòng cần chuẩn hóa.`);

    if (ansCount > 0) {
      const updateAnsQuery = `
        UPDATE training_teacher_answers
        SET teacher_code = LOWER(TRIM(teacher_code))
        WHERE teacher_code != LOWER(TRIM(teacher_code))
      `;
      const updateRes = await client.query(updateAnsQuery);
      console.log(`Đã cập nhật thành công ${updateRes.rowCount} dòng.`);
    }

    await client.query('COMMIT');
    console.log('\n=== MIGRATION THÀNH CÔNG RỰC RỠ! TOÀN BỘ DỮ LIỆU ĐÃ ĐƯỢC CHUẨN HÓA ===');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\nLỖI KHI MIGRATION DB. ĐÃ ROLLBACK GIAO DỊCH.', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
