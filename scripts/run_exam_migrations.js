const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
});

const MIGRATIONS = [
  "create_exam_registration_system_tables_postgres.sql",
  "create_exam_random_assignment_procedure_postgres.sql",
  "migrate_exam_registration_backfill_postgres.sql",
];

const VERIFY_TABLES = [
  "exam_subject_catalog",
  "exam_sets",
  "exam_set_questions",
  "exam_registrations",
  "teacher_exam_assignments",
  "teacher_exam_submissions",
  "teacher_exam_answers",
  "exam_explanations",
  "exam_assignment_events",
];

async function testConnection() {
  try {
    console.log("🔍 Testing database connection...");
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database connection successful:", result.rows[0].now);
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    return false;
  }
}

async function runMigrationFile(fileName) {
  const filePath = path.join(__dirname, fileName);
  console.log(`\n📦 Running: ${fileName}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file not found: ${fileName}`);
  }

  const sql = fs.readFileSync(filePath, "utf8");
  await pool.query({ text: sql, simple: true });
  console.log(`✅ Completed: ${fileName}`);
}

async function verifyTables() {
  console.log("\n📊 Verifying created tables...");

  const result = await pool.query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1)
    ORDER BY table_name
    `,
    [VERIFY_TABLES],
  );

  const existing = new Set(result.rows.map((r) => r.table_name));
  const missing = VERIFY_TABLES.filter((name) => !existing.has(name));

  console.log("\n📋 Tables found:");
  VERIFY_TABLES.filter((name) => existing.has(name)).forEach((name) => {
    console.log(`  - ${name}`);
  });

  if (missing.length > 0) {
    console.log("\n⚠️ Missing tables:");
    missing.forEach((name) => console.log(`  - ${name}`));
  } else {
    console.log("\n✅ All expected tables are present.");
  }

  const fnCheck = await pool.query(
    `
    SELECT proname
    FROM pg_proc
    WHERE proname IN ('assign_random_set_on_registration', 'expire_overdue_exam_assignments')
    ORDER BY proname;
    `,
  );

  console.log("\n🧠 Functions found:");
  fnCheck.rows.forEach((row) => console.log(`  - ${row.proname}`));
}

async function run() {
  try {
    const connected = await testConnection();
    if (!connected) process.exit(1);

    for (const migration of MIGRATIONS) {
      await runMigrationFile(migration);
    }

    await verifyTables();

    console.log("\n✨ Exam migration sequence completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration sequence failed:", error.message);
    if (error.code) console.error("Error code:", error.code);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
