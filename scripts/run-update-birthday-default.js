#!/usr/bin/env node

/**
 * Migration script to update show_birthday default value from true to false
 * 
 * Usage:
 *   node scripts/run-update-birthday-default.js
 * 
 * This script will:
 * 1. Update the column default value in the database schema
 * 2. Optionally update existing records (commented out by default)
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  console.log("🔄 Starting show_birthday default value migration...\n");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    // Test connection
    console.log("📡 Testing database connection...");
    const testResult = await pool.query("SELECT NOW()");
    console.log(`✅ Connected to database`);
    console.log(`Time: ${testResult.rows[0].now}\n`);

    // Read and execute migration SQL
    console.log("📦 Updating show_birthday default value...");
    const sqlFile = fs.readFileSync(
      path.join(__dirname, "update_show_birthday_default.sql"),
      "utf8",
    );

    await pool.query(sqlFile);
    console.log("✅ Migration executed successfully\n");

    // Verify the change
    console.log("🔍 Verifying column default value...");
    const verifyResult = await pool.query(`
      SELECT column_name, column_default, data_type
      FROM information_schema.columns
      WHERE table_name = 'teacher_privacy_settings' 
        AND column_name = 'show_birthday';
    `);

    if (verifyResult.rows.length > 0) {
      console.log("Column details:");
      console.table(verifyResult.rows);
    }

    // Show statistics
    console.log("\n📊 Current statistics:");
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE show_birthday = true) as birthday_enabled,
        COUNT(*) FILTER (WHERE show_birthday = false) as birthday_disabled
      FROM teacher_privacy_settings;
    `);

    if (statsResult.rows.length > 0) {
      const stats = statsResult.rows[0];
      console.log(`Total records: ${stats.total_records}`);
      console.log(`Birthday enabled: ${stats.birthday_enabled}`);
      console.log(`Birthday disabled: ${stats.birthday_disabled}`);
    }

    console.log("\n✨ Migration completed successfully!");
    console.log("\n📝 Note:");
    console.log("   - New users will now have show_birthday = false by default");
    console.log("   - Existing users' settings remain unchanged");
    console.log("   - To update existing users, uncomment the UPDATE statement in the SQL file");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
