const { Pool } = require('pg');

function loadEnvFromFile(fileName) {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || /^\s*#/.test(line)) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvFromFile('.env.local');
  loadEnvFromFile('.env');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:
      process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
        : undefined,
  });

  try {
    const roles = (
      await pool.query(
        'SELECT role_code, role_name, department, description FROM roles ORDER BY department, role_name LIMIT 100'
      )
    ).rows;

    const centers = (
      await pool.query(
        'SELECT id, region, short_code, full_name, display_name, status FROM centers ORDER BY region, full_name LIMIT 200'
      )
    ).rows;

    const areas = (
      await pool.query(
        "WITH leader_areas AS (SELECT DISTINCT trim(x) AS area FROM (SELECT area AS x FROM teaching_leaders WHERE area IS NOT NULL AND trim(area) <> '' UNION ALL SELECT jsonb_array_elements_text(areas) AS x FROM teaching_leaders WHERE areas IS NOT NULL AND jsonb_typeof(areas) = 'array' AND jsonb_array_length(areas) > 0) t WHERE trim(x) <> ''), center_regions AS (SELECT DISTINCT trim(region) AS area FROM centers WHERE region IS NOT NULL AND trim(region) <> '') SELECT DISTINCT area FROM (SELECT area FROM leader_areas UNION SELECT area FROM center_regions) u ORDER BY area"
      )
    ).rows.map((r) => r.area);

    const users = (
      await pool.query(
        "SELECT id, email, display_name, role, is_active, COALESCE(auth_type, 'app') AS auth_type, created_at FROM app_users ORDER BY created_at DESC LIMIT 100"
      )
    ).rows;

    console.log(
      JSON.stringify(
        {
          success: true,
          counts: {
            roles: roles.length,
            centers: centers.length,
            areas: areas.length,
            users: users.length,
          },
          sample: {
            roles: roles.slice(0, 10),
            centers: centers.slice(0, 10),
            areas: areas.slice(0, 20),
            users: users.slice(0, 10),
          },
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
