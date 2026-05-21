require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { Pool } = require('pg');
const databaseUrl = process.env.DATABASE_URL?.trim();
const config = databaseUrl
  ? { connectionString: databaseUrl, max: 1, ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } }
  : { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 1, ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } };
const pool = new Pool(config);
(async()=>{
  const setId = Number(process.argv[2]);
  const subjectId = Number(process.argv[3]);
  const result = await pool.query(`INSERT INTO chuyen_sau_results (
    khu_vuc, ho_ten, dia_chi_email, ma_giao_vien, hinh_thuc, khoi_giang_day,
    thang_dk, nam_dk, id_mon, id_de_thi, ma_de, dang_ky_luc, tao_luc
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW()) RETURNING id`, [
    'QA', 'Codex Image QA', 'hoteaching@mindx.com.vn', 'hoteaching', 'official', 'ROBOTICS', 5, 2026, subjectId, setId, 'ROB-01-01'
  ]);
  console.log(JSON.stringify({ resultId: result.rows[0].id }));
  await pool.end();
})();
