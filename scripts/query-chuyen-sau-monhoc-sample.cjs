/**
 * In ra ma_khoi, ma_mon, ten_mon từ DB (chạy local khi có .env).
 * node scripts/query-chuyen-sau-monhoc-sample.cjs
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });
const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL?.trim();
const cfg = databaseUrl
  ? { connectionString: databaseUrl }
  : {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl:
        process.env.DB_SSL === "true" || process.env.DB_SSL === "1"
          ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" }
          : undefined,
    };

async function main() {
  if (!databaseUrl && !cfg.host) {
    console.error("Thiếu DATABASE_URL hoặc DB_HOST trong .env");
    process.exit(1);
  }
  const pool = new Pool(cfg);
  try {
    const r = await pool.query(
      `SELECT ma_khoi, ma_mon, ten_mon, dang_hoat_dong
       FROM chuyen_sau_monhoc
       WHERE ma_mon IS NOT NULL AND TRIM(ma_mon) <> ''
       ORDER BY ma_khoi NULLS LAST, ma_mon
       LIMIT 80`
    );
    console.log(JSON.stringify(r.rows, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
