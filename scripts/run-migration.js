const { Pool } = require("pg");
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

async function testConnection() {
  try {
    console.log("🔍 Testing database connection...");
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`User: ${process.env.DB_USER}`);

    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database connection successful!");
    console.log(`Time: ${result.rows[0].now}`);

    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    return false;
  }
}

async function runMigration() {
  const fs = require("fs");
  const path = require("path");

  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      console.error(
        "\n❌ Cannot proceed with migration. Please check database credentials.",
      );
      process.exit(1);
    }

    console.log("\n📦 Running migration...");

    const sqlFile = fs.readFileSync(
      path.join(__dirname, "create_teacher_certificates_table.sql"),
      "utf8",
    );

    await pool.query(sqlFile);

    console.log("✅ Migration completed successfully!");
    console.log("\n📊 Verifying table structure...");

    // Verify table was created
    const checkTable = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'teacher_certificates'
            ORDER BY ordinal_position;
        `);

    console.log("\n📋 Table columns:");
    checkTable.rows.forEach((col) => {
      console.log(
        `  - ${col.column_name} (${col.data_type}) ${col.is_nullable === "NO" ? "* required" : ""}`,
      );
    });

    // Check indexes
    const checkIndexes = await pool.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'teacher_certificates';
        `);

    console.log("\n🔍 Table indexes:");
    checkIndexes.rows.forEach((idx) => {
      console.log(`  - ${idx.indexname}`);
    });

    console.log("\n✨ All done! You can now use the teacher profile feature.");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    process.exit(1);
  }
}

runMigration();
