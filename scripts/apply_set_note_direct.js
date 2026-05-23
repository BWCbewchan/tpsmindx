const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function run() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 1,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  });

  let client;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      client = await pool.connect();
      break;
    } catch (error) {
      if (error?.code === '53300' && attempt < 20) {
        console.log(`DB busy (53300), retry ${attempt}/20...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }
      throw error;
    }
  }

  if (!client) {
    throw new Error('Could not acquire a DB connection after retries.');
  }

  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE chuyen_sau_bode
      ADD COLUMN IF NOT EXISTS set_note TEXT
    `);

    const updateResult = await client.query(`
      UPDATE chuyen_sau_bode
      SET set_note = set_name
      WHERE (set_note IS NULL OR BTRIM(set_note) = '')
        AND set_name IS NOT NULL
        AND BTRIM(set_name) <> ''
    `);

    await client.query('COMMIT');
    console.log(`DONE: set_note ready, backfilled rows = ${updateResult.rowCount}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
