// PostgreSQL integration test: EXPLAIN against real schema, execute on temp tables only.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('app/api/app-auth/reference-data/route.ts', 'utf8');
const sql = source.match(/await pool\.query\(`([\s\S]*?)`\);/)[1];
const client = new Client({
  ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  }),
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
  connectionTimeoutMillis: 15000,
});

async function main() {
  try {
    await client.connect();
    // EXPLAIN without ANALYZE validates names/types without executing the INSERT.
    await client.query('EXPLAIN ' + sql);
    console.log('PASS: sync query compiles against configured PostgreSQL schema (no production writes).');
    await client.query('BEGIN');
    await client.query(`
      CREATE TEMP TABLE teaching_leaders (code text PRIMARY KEY, email text, full_name text, status text, role_code text) ON COMMIT DROP;
      CREATE TEMP TABLE app_users (id serial PRIMARY KEY, email text UNIQUE, display_name text, role text, auth_type text, is_active boolean, created_by text) ON COMMIT DROP;
      CREATE TEMP TABLE roles (role_code text PRIMARY KEY) ON COMMIT DROP;
      CREATE TEMP TABLE user_roles (user_id integer REFERENCES pg_temp.app_users(id), role_code text REFERENCES pg_temp.roles(role_code), UNIQUE(user_id, role_code)) ON COMMIT DROP;
      INSERT INTO pg_temp.roles VALUES ('TE'), ('TC');
      INSERT INTO pg_temp.app_users (email, role, is_active) VALUES ('existing@example.test', 'super_admin', false);
      INSERT INTO pg_temp.teaching_leaders VALUES
        ('L1', ' NEW@example.test ', 'New leader', 'Active', 'TE'),
        ('L2', 'new@example.test', 'Duplicate email', 'Active', 'TC'),
        ('L3', 'existing@example.test', 'Existing leader', 'Active', 'TE'),
        ('L4', NULL, 'No email', 'Active', 'TE');
    `);
    // Prove the original bug on a table whose actual primary key is code.
    await client.query('SAVEPOINT old_query');
    await assert.rejects(client.query(sql.replace('tl.code\n', 'tl.id\n')), { code: '42703' });
    await client.query('ROLLBACK TO SAVEPOINT old_query');
    await client.query(sql);
    const users = (await client.query('SELECT email, role, is_active FROM pg_temp.app_users ORDER BY email')).rows;
    assert.deepEqual(users, [
      { email: 'existing@example.test', role: 'super_admin', is_active: false },
      { email: 'new@example.test', role: 'manager', is_active: true },
    ]);
    assert.equal((await client.query('SELECT * FROM pg_temp.user_roles')).rowCount, 2);
    await client.query('DELETE FROM pg_temp.user_roles');
    await client.query(sql);
    assert.equal((await client.query('SELECT * FROM pg_temp.user_roles')).rowCount, 0, 'Revoked roles stay revoked');
    console.log('PASS: original 42703 reproduced; fix handles duplicate emails, preserves existing accounts and does not restore revoked roles.');
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}
main().catch((error) => { console.error('FAIL:', error.code || '', error.message); process.exitCode = 1; });
