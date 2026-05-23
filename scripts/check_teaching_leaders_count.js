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

  const count = await client.query(
    'SELECT COUNT(*)::int AS total FROM teaching_leaders',
  )
  const sample = await client.query(
    `SELECT code, full_name, role_code, center, area, status
     FROM teaching_leaders
     ORDER BY full_name
     LIMIT 20`,
  )

  console.log('TOTAL', count.rows[0].total)
  console.log(JSON.stringify(sample.rows, null, 2))

  await client.end()
}

main().catch((error) => {
  console.error('check_teaching_leaders_count failed:', error)
  process.exit(1)
})
