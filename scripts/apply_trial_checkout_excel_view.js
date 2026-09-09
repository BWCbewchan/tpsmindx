const fs = require('fs')
const path = require('path')

require('dotenv').config()

const { Pool } = require('pg')

const MIGRATION_NAME = 'V108_trial_checkout_excel_view'
const MIGRATION_VERSION = 108
const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'migrations',
  'V108_trial_checkout_excel_view.sql',
)

function buildPoolConfig() {
  const databaseUrl = (process.env.DATABASE_URL || '').trim()
  const dbHost = (process.env.DB_HOST || '').trim()
  const dbUser = (process.env.DB_USER || '').trim()
  const dbName = (process.env.DB_NAME || '').trim()

  const hostLooksHosted =
    /supabase\.co|neon\.tech|aiven\.io|aivencloud\.com|amazonaws\.com|render\.com|railway\.app/i.test(
      dbHost,
    )
  const urlLooksHosted =
    /supabase\.co|neon\.tech|aiven\.io|aivencloud\.com|amazonaws\.com|render\.com|railway\.app/i.test(
      databaseUrl,
    )
  const looksLikeAivenDefaults = dbUser === 'avnadmin' || dbName === 'defaultdb'
  const useSsl =
    hostLooksHosted ||
    urlLooksHosted ||
    looksLikeAivenDefaults ||
    process.env.DB_SSL === 'true'

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: 1,
    }
  }

  return {
    host: dbHost,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: dbName,
    user: dbUser,
    password: process.env.DB_PASSWORD,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 1,
  }
}

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8')
  const pool = new Pool(buildPoolConfig())
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        version INTEGER NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    await client.query(sql)
    await client.query(
      `INSERT INTO _migrations (name, version)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET applied_at = CURRENT_TIMESTAMP`,
      [MIGRATION_NAME, MIGRATION_VERSION],
    )

    const countResult = await client.query(
      'SELECT COUNT(*)::integer AS row_count FROM trial_checkout',
    )
    const columnsResult = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'trial_checkout'
       ORDER BY ordinal_position`,
    )

    await client.query('COMMIT')

    console.log(
      JSON.stringify(
        {
          migration: MIGRATION_NAME,
          rowCount: countResult.rows[0]?.row_count ?? 0,
          columns: columnsResult.rows.map((row) => row.column_name),
        },
        null,
        2,
      ),
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
