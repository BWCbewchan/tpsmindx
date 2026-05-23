const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables found:', res.rows.map(r => r.table_name));

    const migrationRes = await pool.query('SELECT * FROM _migrations ORDER BY version');
    console.log('Migrations applied:', migrationRes.rows.map(r => `${r.version}:${r.name}`));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

main();