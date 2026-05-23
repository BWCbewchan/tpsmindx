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

async function runPrivacyMigration() {
  const fs = require("fs");
  const path = require("path");

  try {
    console.log("🔍 Testing database connection...");
    const testResult = await pool.query("SELECT NOW()");
    console.log("✅ Database connection successful!");
    console.log(`Time: ${testResult.rows[0].now}\n`);

    console.log("📦 Creating teacher_privacy_settings table...");

    const sqlFile = fs.readFileSync(
      path.join(__dirname, "create_teacher_privacy_settings_table.sql"),
      "utf8",
    );

    await pool.query(sqlFile);

    console.log("✅ Table created successfully!\n");

    // Verify table structure
    const checkTable = await pool.query(`
            SELECT column_name, data_type, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'teacher_privacy_settings'
            ORDER BY ordinal_position;
        `);

    console.log("📋 Table structure:");
    checkTable.rows.forEach((col) => {
      const nullable = col.is_nullable === "NO" ? "* required" : "optional";
      const defaultVal = col.column_default
        ? ` (default: ${col.column_default})`
        : "";
      console.log(
        `  - ${col.column_name} (${col.data_type}) ${nullable}${defaultVal}`,
      );
    });

    // Check indexes
    const checkIndexes = await pool.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'teacher_privacy_settings';
        `);

    console.log("\n🔍 Indexes:");
    checkIndexes.rows.forEach((idx) => {
      console.log(`  - ${idx.indexname}`);
    });

    console.log("\n✨ Privacy settings table ready!");
    console.log("\n📝 Features:");
    console.log("   - Control birthday visibility on communications page");
    console.log("   - Manage public profile visibility");
    console.log("   - Control phone number display");
    console.log("   - Control personal email visibility");

    console.log("\n💡 Usage:");
    console.log("   - Go to /user/profile");
    console.log("   - Toggle privacy settings as needed");
    console.log("   - Changes apply immediately to public pages");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    if (error.code === "42P07") {
      console.log("\n⚠️  Table already exists. No action needed.");
      process.exit(0);
    }
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`Detail: ${error.detail}`);
    }
    process.exit(1);
  }
}

runPrivacyMigration();
