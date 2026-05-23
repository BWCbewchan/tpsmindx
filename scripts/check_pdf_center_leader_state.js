require('dotenv').config()
const { Client } = require('pg')

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  const centers = await client.query(
    `SELECT id, short_code, full_name, display_name, region, status
     FROM centers
     ORDER BY region, full_name`,
  )

  const leaders = await client.query(
    `SELECT code, full_name, role_code, center, area, areas, status
     FROM teaching_leaders
     WHERE LOWER(full_name) LIKE '%vũ%'
        OR LOWER(full_name) LIKE '%anh%'
        OR LOWER(full_name) LIKE '%sơn%'
        OR LOWER(full_name) LIKE '%hùng%'
     ORDER BY full_name`,
  )

  const users = await client.query(
    `SELECT id, email, display_name, role, is_active
     FROM app_users
     WHERE LOWER(email) IN (
       'vuth@mindx.com.vn',
       'anhpnh@mindx.com.vn',
       'soncq@mindx.com.vn',
       'hunghv@mindx.com.vn'
     )
     ORDER BY email`,
  )

  const mappings = await client.query(
    `SELECT au.email, c.short_code, c.full_name, mc.assigned_at
     FROM manager_centers mc
     JOIN app_users au ON au.id = mc.user_id
     JOIN centers c ON c.id = mc.center_id
     WHERE LOWER(au.email) IN (
       'vuth@mindx.com.vn',
       'anhpnh@mindx.com.vn',
       'soncq@mindx.com.vn',
       'hunghv@mindx.com.vn'
     )
     ORDER BY au.email, c.full_name`,
  )

  console.log('=== CENTERS ===')
  console.log(JSON.stringify(centers.rows, null, 2))

  console.log('=== LEADERS (name matched) ===')
  console.log(JSON.stringify(leaders.rows, null, 2))

  console.log('=== APP USERS (PDF emails) ===')
  console.log(JSON.stringify(users.rows, null, 2))

  console.log('=== MANAGER_CENTERS (PDF emails) ===')
  console.log(JSON.stringify(mappings.rows, null, 2))

  await client.end()
}

main().catch((error) => {
  console.error('check_pdf_center_leader_state failed:', error)
  process.exit(1)
})
